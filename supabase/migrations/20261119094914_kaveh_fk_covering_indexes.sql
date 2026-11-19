-- Add covering indexes for foreign keys flagged by the live Supabase performance advisor.
-- These indexes are additive and do not alter or remove user data.
create index if not exists audio_tracks_created_by_idx
  on public.audio_tracks (created_by);

create index if not exists conversation_join_requests_requester_idx
  on public.conversation_join_requests (requester_id);

create index if not exists conversation_join_requests_reviewed_by_idx
  on public.conversation_join_requests (reviewed_by);

create index if not exists daily_titles_created_by_idx
  on public.daily_titles (created_by);

create index if not exists playlist_tracks_track_idx
  on public.playlist_tracks (track_id);

create index if not exists playlists_owner_idx
  on public.playlists (owner_id);

create index if not exists reel_comments_author_idx
  on public.reel_comments (author_id);

create index if not exists reel_reactions_user_idx
  on public.reel_reactions (user_id);

create index if not exists reel_views_viewer_idx
  on public.reel_views (viewer_id);

create index if not exists scheduled_notifications_created_by_idx
  on public.scheduled_notifications (created_by);
