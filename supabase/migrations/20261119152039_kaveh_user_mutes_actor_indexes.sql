-- Cover both moderator/administrator foreign-key lookups on mute history.
create index if not exists user_mutes_created_by_idx
  on public.user_mutes (created_by);

create index if not exists user_mutes_revoked_by_idx
  on public.user_mutes (revoked_by);
