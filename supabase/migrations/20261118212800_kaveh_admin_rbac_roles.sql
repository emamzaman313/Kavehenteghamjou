-- Add explicit server-enforced roles to the existing admin allowlist.
-- Existing trusted administrators are promoted to owner to preserve current access.
alter table public.site_access_admins
  add column if not exists role text not null default 'admin';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.site_access_admins'::regclass
      and conname = 'site_access_admins_role_check'
  ) then
    alter table public.site_access_admins
      add constraint site_access_admins_role_check
      check (role in ('owner', 'admin', 'moderator', 'support'));
  end if;
end
$$;

update public.site_access_admins
set role = 'owner'
where role = 'admin';
