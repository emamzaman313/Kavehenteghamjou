drop policy if exists kaveh_storage_insert_own on storage.objects;
create policy kaveh_storage_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id='user-files'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce((select enabled from public.platform_feature_flags where key='uploads'),true)
  and not exists (
    select 1 from public.user_mutes m
    where m.user_id=(select auth.uid()) and m.restriction='file_upload'
      and m.revoked_at is null and m.starts_at<=now()
      and (m.expires_at is null or m.expires_at>now())
  )
);
drop policy if exists kaveh_storage_update_own on storage.objects;
create policy kaveh_storage_update_own on storage.objects for update to authenticated
using (
  bucket_id='user-files'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce((select enabled from public.platform_feature_flags where key='uploads'),true)
  and not exists (
    select 1 from public.user_mutes m
    where m.user_id=(select auth.uid()) and m.restriction='file_upload'
      and m.revoked_at is null and m.starts_at<=now()
      and (m.expires_at is null or m.expires_at>now())
  )
)
with check (
  bucket_id='user-files'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce((select enabled from public.platform_feature_flags where key='uploads'),true)
  and not exists (
    select 1 from public.user_mutes m
    where m.user_id=(select auth.uid()) and m.restriction='file_upload'
      and m.revoked_at is null and m.starts_at<=now()
      and (m.expires_at is null or m.expires_at>now())
  )
);
drop policy if exists post_media_insert_own on storage.objects;
create policy post_media_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id='post-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce((select enabled from public.platform_feature_flags where key='uploads'),true)
  and not exists (
    select 1 from public.user_mutes m
    where m.user_id=(select auth.uid()) and m.restriction='file_upload'
      and m.revoked_at is null and m.starts_at<=now()
      and (m.expires_at is null or m.expires_at>now())
  )
);
drop policy if exists profile_media_insert_own on storage.objects;
create policy profile_media_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id='profile-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce((select enabled from public.platform_feature_flags where key='uploads'),true)
);
drop policy if exists profile_media_update_own on storage.objects;
create policy profile_media_update_own on storage.objects for update to authenticated
using (
  bucket_id='profile-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce((select enabled from public.platform_feature_flags where key='uploads'),true)
)
with check (
  bucket_id='profile-media'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and coalesce((select enabled from public.platform_feature_flags where key='uploads'),true)
);