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

drop policy if exists user_presence_select_admin on public.user_presence;
create policy user_presence_select_admin on public.user_presence
for select to authenticated
using (
  exists (
    select 1 from public.site_access_admins a
    where a.user_id = (select auth.uid())
      and a.role in ('owner', 'admin')
  )
);

grant select, insert, update on public.user_presence to authenticated;
revoke all on public.user_presence from anon;

commit;
