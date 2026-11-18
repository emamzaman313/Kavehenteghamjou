create or replace function private.can_read_file_asset(p_file_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.file_assets fa
    where fa.id = p_file_asset_id
      and (
        fa.owner_id = (select auth.uid())
        or exists (
          select 1 from public.message_attachments ma
          join public.messages m on m.id = ma.message_id
          join public.conversation_members cm on cm.conversation_id = m.conversation_id
          where ma.file_asset_id = fa.id and cm.user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.post_media pm
          join public.posts p on p.id = pm.post_id
          where pm.file_asset_id = fa.id and (
            p.author_id = (select auth.uid()) or p.visibility = 'public'
            or (p.visibility = 'followers' and exists (
              select 1 from public.follows f
              where f.follower_id = (select auth.uid())
                and f.following_id = p.author_id and f.status = 'accepted'
            ))
          )
        )
        or exists (
          select 1 from public.stories s
          where s.file_asset_id = fa.id and s.expires_at > now() and (
            s.owner_id = (select auth.uid()) or s.audience = 'public'
            or (s.audience = 'followers' and exists (
              select 1 from public.follows f
              where f.follower_id = (select auth.uid())
                and f.following_id = s.owner_id and f.status = 'accepted'
            ))
          )
        )
      )
  );
$$;
revoke all on function private.can_read_file_asset(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.can_read_file_asset(uuid) to authenticated;

create policy files_select_shared
on public.file_assets
for select to authenticated
using (private.can_read_file_asset(id));

create policy kaveh_storage_select_shared
on storage.objects
for select to authenticated
using (
  bucket_id = 'user-files'
  and exists (
    select 1 from public.file_assets fa
    where fa.bucket_id = storage.objects.bucket_id
      and fa.object_path = storage.objects.name
      and private.can_read_file_asset(fa.id)
  )
);
comment on function private.can_read_file_asset(uuid) is
'Private authorization helper for file metadata and private Storage read access; checks owner, conversation membership, post audience and active story audience.';
