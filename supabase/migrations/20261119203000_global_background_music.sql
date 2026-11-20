-- Global background music: one server-controlled track for all clients.
create table if not exists public.global_audio_settings (
  id smallint primary key default 1 check (id = 1),
  track_id uuid references public.audio_tracks(id) on delete set null,
  enabled boolean not null default false,
  volume numeric(3,2) not null default 0.35 check (volume >= 0 and volume <= 1),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.global_audio_settings(id, enabled, volume)
values (1, false, 0.35) on conflict (id) do nothing;

alter table public.global_audio_settings enable row level security;
grant select on public.global_audio_settings to anon, authenticated;
grant update on public.global_audio_settings to authenticated;

drop policy if exists global_audio_settings_public_read on public.global_audio_settings;
create policy global_audio_settings_public_read
on public.global_audio_settings for select to anon, authenticated using (true);

drop policy if exists global_audio_settings_admin_update on public.global_audio_settings;
create policy global_audio_settings_admin_update
on public.global_audio_settings for update to authenticated
using (coalesce(public.my_admin_role()->>'role', '') in ('owner', 'admin'))
with check (coalesce(public.my_admin_role()->>'role', '') in ('owner', 'admin'));

-- Allow common audio formats and unrecognized extensions to be stored.
-- Actual playback still depends on browser/device codec support.
update storage.buckets
set file_size_limit = 104857600, allowed_mime_types = null
where id = 'music-library';
