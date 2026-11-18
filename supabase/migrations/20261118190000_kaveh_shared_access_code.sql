-- Shared access-code login. The code itself is stored only as a bcrypt hash in the live database.
create table if not exists public.site_access_settings (
  id smallint primary key check (id = 1),
  enabled boolean not null default true,
  code_hash text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_access_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_access_attempts (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz
);

alter table public.site_access_settings enable row level security;
alter table public.site_access_admins enable row level security;
alter table public.site_access_attempts enable row level security;

revoke all on table public.site_access_settings from public, anon, authenticated;
revoke all on table public.site_access_admins from public, anon, authenticated;
revoke all on table public.site_access_attempts from public, anon, authenticated;
grant all on table public.site_access_settings to service_role;
grant all on table public.site_access_admins to service_role;
grant all on table public.site_access_attempts to service_role;

-- The initial site owner is the only account permitted to manage the shared access code.
insert into public.site_access_admins (user_id)
values ('e934b4f2-8116-44ce-8847-e6d19bedb29a'::uuid)
on conflict (user_id) do nothing;

create or replace function public.site_access_code_matches(p_code text)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, extensions
as $$
  select coalesce((
    select enabled and extensions.crypt(p_code, code_hash) = code_hash
    from public.site_access_settings
    where id = 1
  ), false);
$$;

create or replace function public.site_access_update_settings(
  p_enabled boolean,
  p_new_code text,
  p_updated_by uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if p_new_code is not null and p_new_code !~ '^[A-Za-z0-9]{6}$' then
    raise exception 'access code must be exactly six letters or digits';
  end if;

  update public.site_access_settings
  set enabled = p_enabled,
      code_hash = case
        when p_new_code is null then code_hash
        else extensions.crypt(p_new_code, extensions.gen_salt('bf', 12))
      end,
      updated_by = p_updated_by,
      updated_at = now()
  where id = 1;

  if not found then
    raise exception 'site access settings have not been initialized';
  end if;
end;
$$;

create or replace function public.site_access_register_failure(p_ip_hash text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempts integer;
  v_locked_until timestamptz;
begin
  insert into public.site_access_attempts (ip_hash, window_started_at, failed_attempts, locked_until)
  values (p_ip_hash, now(), 1, null)
  on conflict (ip_hash) do update
  set window_started_at = case
        when public.site_access_attempts.window_started_at <= now() - interval '15 minutes'
          then now()
        else public.site_access_attempts.window_started_at
      end,
      failed_attempts = case
        when public.site_access_attempts.window_started_at <= now() - interval '15 minutes'
          then 1
        else public.site_access_attempts.failed_attempts + 1
      end,
      locked_until = case
        when (
          case
            when public.site_access_attempts.window_started_at <= now() - interval '15 minutes'
              then 1
            else public.site_access_attempts.failed_attempts + 1
          end
        ) >= 5
          then now() + interval '15 minutes'
        else null
      end
  returning failed_attempts, locked_until
  into v_attempts, v_locked_until;

  if v_locked_until is not null and v_locked_until > now() then
    return greatest(1, ceil(extract(epoch from (v_locked_until - now())))::integer);
  end if;

  return 0;
end;
$$;

revoke all on function public.site_access_code_matches(text) from public, anon, authenticated;
revoke all on function public.site_access_update_settings(boolean, text, uuid) from public, anon, authenticated;
revoke all on function public.site_access_register_failure(text) from public, anon, authenticated;
grant execute on function public.site_access_code_matches(text) to service_role;
grant execute on function public.site_access_update_settings(boolean, text, uuid) to service_role;
grant execute on function public.site_access_register_failure(text) to service_role;
