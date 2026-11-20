-- Lightweight heartbeat for live administrator online-user metrics.
begin;

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists user_presence_last_seen_at_idx
  on public.user_presence(last_seen_at desc);

alter table public.user_presence enable row level security;

drop policy if exists user_presence_insert_own on public.user_presence;
create policy user_presence_insert_own on public.user_presence
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists user_presence_update_own on public.user_presence;
create policy user_presence_update_own on public.user_presence
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists user_presence_select_own on public.user_presence;
create policy user_presence_select_own on public.user_presence
for select to authenticated
using (user_id = (select auth.uid()));

create or replace function public.touch_user_presence()
returns void
language sql
security invoker
set search_path = pg_catalog, public
as $
  insert into public.user_presence(user_id, last_seen_at)
  values ((select auth.uid()), now())
  on conflict (user_id)
  do update set last_seen_at = now();
$;

revoke all on function public.touch_user_presence() from public, anon;
grant execute on function public.touch_user_presence() to authenticated;

create or replace function private.touch_user_presence()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $
begin
  new.last_seen_at := now();
  return new;
end;
$;

drop trigger if exists trg_touch_user_presence on public.user_presence;
create trigger trg_touch_user_presence
before insert or update on public.user_presence
for each row execute function private.touch_user_presence();

grant select, insert, update on public.user_presence to authenticated;
revoke all on public.user_presence from anon;

commit;
