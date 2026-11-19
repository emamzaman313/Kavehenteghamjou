-- Split write-only ownership checks from public/owner SELECT visibility.
-- This removes duplicate permissive SELECT evaluation without changing who can mutate a playlist.

drop policy if exists playlist_tracks_manage_own on public.playlist_tracks;

drop policy if exists playlist_tracks_insert_own on public.playlist_tracks;
create policy playlist_tracks_insert_own
  on public.playlist_tracks
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.playlists p
      where p.id = playlist_tracks.playlist_id
        and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists playlist_tracks_update_own on public.playlist_tracks;
create policy playlist_tracks_update_own
  on public.playlist_tracks
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.playlists p
      where p.id = playlist_tracks.playlist_id
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.playlists p
      where p.id = playlist_tracks.playlist_id
        and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists playlist_tracks_delete_own on public.playlist_tracks;
create policy playlist_tracks_delete_own
  on public.playlist_tracks
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.playlists p
      where p.id = playlist_tracks.playlist_id
        and p.owner_id = (select auth.uid())
    )
  );
