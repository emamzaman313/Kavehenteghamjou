create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2200),
  video_path text not null,
  cover_path text,
  mime_type text not null default 'video/mp4',
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 600),
  visibility text not null default 'public' check (visibility in ('public','followers','private')),
  allow_comments boolean not null default true,
  views_count bigint not null default 0 check (views_count >= 0),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists reels_published_idx on public.reels(published_at desc);
create index if not exists reels_author_idx on public.reels(author_id,published_at desc);
create table if not exists public.reel_reactions (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null default '❤️' check (char_length(reaction) <= 16),
  created_at timestamptz not null default now(),
  primary key(reel_id,user_id)
);
create table if not exists public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index if not exists reel_comments_reel_idx on public.reel_comments(reel_id,created_at);
create table if not exists public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  artist text not null default '' check (char_length(artist) <= 160),
  audio_path text not null,
  cover_path text,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 3600),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.audio_tracks(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  added_at timestamptz not null default now(),
  primary key(playlist_id,track_id)
);
create index if not exists playlist_tracks_order_idx on public.playlist_tracks(playlist_id,position);
create table if not exists public.daily_titles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  body text not null default '' check (char_length(body) <= 5000),
  category text not null default 'announcement' check (category in ('announcement','daily_title','maintenance','event')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists daily_titles_schedule_idx on public.daily_titles(is_published,starts_at desc);
create table if not exists public.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 180),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  audience text not null default 'all' check (audience in ('all','admins','specific')),
  recipient_ids uuid[] not null default '{}',
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  sent_at timestamptz,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_notifications_due_idx on public.scheduled_notifications(status,scheduled_at);
alter table public.reels enable row level security;
alter table public.reel_reactions enable row level security;
alter table public.reel_comments enable row level security;
alter table public.audio_tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.daily_titles enable row level security;
alter table public.scheduled_notifications enable row level security;
create policy reels_select_visible on public.reels for select to authenticated using (
 author_id = (select auth.uid()) or visibility = 'public'
 or (visibility = 'followers' and exists (
   select 1 from public.follows f where f.follower_id=(select auth.uid()) and f.following_id=reels.author_id and f.status='accepted'
 ))
);
create policy reels_insert_own on public.reels for insert to authenticated with check (author_id = (select auth.uid()));
create policy reels_update_own on public.reels for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy reels_delete_own on public.reels for delete to authenticated using (author_id = (select auth.uid()));
create policy reel_reactions_select_visible on public.reel_reactions for select to authenticated using (exists(select 1 from public.reels r where r.id=reel_id));
create policy reel_reactions_insert_self on public.reel_reactions for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.reels r where r.id=reel_id));
create policy reel_reactions_delete_self on public.reel_reactions for delete to authenticated using (user_id=(select auth.uid()));
create policy reel_comments_select_visible on public.reel_comments for select to authenticated using (exists(select 1 from public.reels r where r.id=reel_id));
create policy reel_comments_insert_self on public.reel_comments for insert to authenticated with check (author_id=(select auth.uid()) and exists(select 1 from public.reels r where r.id=reel_id and r.allow_comments));
create policy reel_comments_delete_self on public.reel_comments for delete to authenticated using (author_id=(select auth.uid()));
create policy audio_tracks_select_active on public.audio_tracks for select to authenticated using (is_active);
create policy audio_tracks_admin_insert on public.audio_tracks for insert to authenticated with check (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
create policy audio_tracks_admin_update on public.audio_tracks for update to authenticated using (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))) with check (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
create policy audio_tracks_admin_delete on public.audio_tracks for delete to authenticated using (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
create policy playlists_select_visible on public.playlists for select to authenticated using (owner_id=(select auth.uid()) or is_public);
create policy playlists_insert_own on public.playlists for insert to authenticated with check (owner_id=(select auth.uid()));
create policy playlists_update_own on public.playlists for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy playlists_delete_own on public.playlists for delete to authenticated using (owner_id=(select auth.uid()));
create policy playlist_tracks_select_visible on public.playlist_tracks for select to authenticated using (exists(select 1 from public.playlists p where p.id=playlist_id and (p.owner_id=(select auth.uid()) or p.is_public)));
create policy playlist_tracks_manage_own on public.playlist_tracks for all to authenticated using (exists(select 1 from public.playlists p where p.id=playlist_id and p.owner_id=(select auth.uid()))) with check (exists(select 1 from public.playlists p where p.id=playlist_id and p.owner_id=(select auth.uid())));
create policy daily_titles_select_published on public.daily_titles for select to authenticated using (is_published and starts_at <= now() and (ends_at is null or ends_at > now()));
create policy daily_titles_admin_insert on public.daily_titles for insert to authenticated with check (created_by=(select auth.uid()) and exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin','moderator')));
create policy daily_titles_admin_update on public.daily_titles for update to authenticated using (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin','moderator'))) with check (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin','moderator')));
create policy daily_titles_admin_delete on public.daily_titles for delete to authenticated using (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin','moderator')));
create policy scheduled_notifications_admin_select on public.scheduled_notifications for select to authenticated using (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
create policy scheduled_notifications_admin_insert on public.scheduled_notifications for insert to authenticated with check (created_by=(select auth.uid()) and exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
create policy scheduled_notifications_admin_update on public.scheduled_notifications for update to authenticated using (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin'))) with check (exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in ('owner','admin')));
grant select, insert, update, delete on public.reels, public.reel_reactions, public.reel_comments, public.audio_tracks, public.playlists, public.playlist_tracks, public.daily_titles, public.scheduled_notifications to authenticated;
