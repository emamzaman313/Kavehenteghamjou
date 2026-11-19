create index if not exists global_audio_settings_track_id_idx on public.global_audio_settings(track_id) where track_id is not null;
create index if not exists global_audio_settings_updated_by_idx on public.global_audio_settings(updated_by) where updated_by is not null;
create index if not exists support_tickets_assigned_to_idx on public.support_tickets(assigned_to) where assigned_to is not null;
