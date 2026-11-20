-- Allow signed-in users to read only their own administrative role row.
-- Several RLS policies across the application check site_access_admins
-- with user_id = auth.uid(). Without table SELECT privilege, PostgreSQL
-- rejects those policies before row-level filtering can run.
-- RLS remains enabled; no anon access and no visibility into other admins.

grant select on table public.site_access_admins to authenticated;

drop policy if exists site_access_admins_read_self on public.site_access_admins;
create policy site_access_admins_read_self
on public.site_access_admins
for select
to authenticated
using (user_id = (select auth.uid()));
