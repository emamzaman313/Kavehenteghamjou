create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated;

create or replace function private.my_admin_role_internal()
returns jsonb language sql stable security definer set search_path=''
as $$
  select jsonb_build_object(
    'role',
    (select saa.role from public.site_access_admins saa where saa.user_id=(select auth.uid()) limit 1)
  );
$$;
revoke all on function private.my_admin_role_internal() from public,anon;
grant execute on function private.my_admin_role_internal() to authenticated;

create or replace function public.my_admin_role()
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.my_admin_role_internal(); $$;
revoke all on function public.my_admin_role() from public,anon;
grant execute on function public.my_admin_role() to authenticated;
