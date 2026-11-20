-- Restore authenticated profile editing and make playlist admin checks use the
-- existing SECURITY DEFINER admin-role resolver instead of directly reading
-- the service-role-only site_access_admins table from RLS expressions.
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists playlists_insert_own on public.playlists;
create policy playlists_insert_own on public.playlists for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and (
    is_public = false
    or coalesce(public.my_admin_role() ->> 'role','') in ('owner','admin')
  )
);

drop policy if exists playlists_update_own on public.playlists;
create policy playlists_update_own on public.playlists for update to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and (
    is_public = false
    or coalesce(public.my_admin_role() ->> 'role','') in ('owner','admin')
  )
);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('profile-media','profile-media',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists profile_media_public_read on storage.objects;
create policy profile_media_public_read on storage.objects for select to public
using (bucket_id='profile-media');
drop policy if exists profile_media_insert_own on storage.objects;
create policy profile_media_insert_own on storage.objects for insert to authenticated
with check (bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists profile_media_update_own on storage.objects;
create policy profile_media_update_own on storage.objects for update to authenticated
using (bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists profile_media_delete_own on storage.objects;
create policy profile_media_delete_own on storage.objects for delete to authenticated
using (bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
