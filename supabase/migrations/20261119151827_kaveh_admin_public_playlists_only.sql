-- Only platform owner/admin accounts may publish or edit public playlists.
-- Playlist ownership remains unchanged; users keep full control of their private lists.

drop policy if exists playlists_insert_own on public.playlists;
create policy playlists_insert_own
  on public.playlists
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      is_public = false
      or exists (
        select 1
        from public.site_access_admins a
        where a.user_id = (select auth.uid())
          and a.role in ('owner', 'admin')
      )
    )
  );

drop policy if exists playlists_update_own on public.playlists;
create policy playlists_update_own
  on public.playlists
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (
      is_public = false
      or exists (
        select 1
        from public.site_access_admins a
        where a.user_id = (select auth.uid())
          and a.role in ('owner', 'admin')
      )
    )
  );
