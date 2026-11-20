-- Central user mutes with server-side enforcement for social and messaging writes.
-- Existing posts, comments, messages, files and media are preserved.

create table if not exists public.user_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restriction text not null check (restriction in (
    'message_send',
    'group_message_send',
    'comment',
    'post_publish',
    'reel_publish',
    'file_upload'
  )),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_by uuid not null references auth.users(id) on delete restrict,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_mutes_expiry_after_start check (expires_at is null or expires_at > starts_at),
  constraint user_mutes_revocation_pair check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by is not null)
  )
);

create index if not exists user_mutes_active_user_action_idx
  on public.user_mutes (user_id, restriction, starts_at, expires_at)
  where revoked_at is null;

alter table public.user_mutes enable row level security;
revoke all on table public.user_mutes from anon, authenticated;
grant select on table public.user_mutes to authenticated;
grant all on table public.user_mutes to service_role;

drop policy if exists user_mutes_select_own on public.user_mutes;
create policy user_mutes_select_own
  on public.user_mutes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create schema if not exists private;

create or replace function private.reject_muted_user_writes()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $function$
declare
  v_user_id uuid;
  v_restriction text;
  v_group_conversation boolean := false;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return new;
  end if;

  case tg_table_name
    when 'messages' then v_restriction := 'message_send';
    when 'comments' then v_restriction := 'comment';
    when 'reel_comments' then v_restriction := 'comment';
    when 'posts' then v_restriction := 'post_publish';
    when 'reels' then v_restriction := 'reel_publish';
    when 'file_assets' then v_restriction := 'file_upload';
    when 'post_attachments' then v_restriction := 'file_upload';
    when 'message_attachments' then v_restriction := 'file_upload';
    else return new;
  end case;

  if exists (
    select 1
    from public.user_mutes m
    where m.user_id = v_user_id
      and m.restriction = v_restriction
      and m.revoked_at is null
      and m.starts_at <= now()
      and (m.expires_at is null or m.expires_at > now())
  ) then
    raise exception using
      errcode = '42501',
      message = 'user_muted',
      detail = 'This action is temporarily restricted by a platform moderation decision.';
  end if;

  if tg_table_name = 'messages' then
    select exists (
      select 1
      from public.conversations c
      where c.id = new.conversation_id
        and c.kind = 'group'
    ) into v_group_conversation;

    if v_group_conversation and exists (
      select 1
      from public.user_mutes m
      where m.user_id = v_user_id
        and m.restriction = 'group_message_send'
        and m.revoked_at is null
        and m.starts_at <= now()
        and (m.expires_at is null or m.expires_at > now())
    ) then
      raise exception using
        errcode = '42501',
        message = 'user_muted',
        detail = 'Group message sending is restricted by a platform moderation decision.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists user_mutes_guard_messages on public.messages;
create trigger user_mutes_guard_messages
  before insert on public.messages
  for each row execute function private.reject_muted_user_writes();

drop trigger if exists user_mutes_guard_comments on public.comments;
create trigger user_mutes_guard_comments
  before insert on public.comments
  for each row execute function private.reject_muted_user_writes();

drop trigger if exists user_mutes_guard_reel_comments on public.reel_comments;
create trigger user_mutes_guard_reel_comments
  before insert on public.reel_comments
  for each row execute function private.reject_muted_user_writes();

drop trigger if exists user_mutes_guard_posts on public.posts;
create trigger user_mutes_guard_posts
  before insert on public.posts
  for each row execute function private.reject_muted_user_writes();

drop trigger if exists user_mutes_guard_reels on public.reels;
create trigger user_mutes_guard_reels
  before insert on public.reels
  for each row execute function private.reject_muted_user_writes();

drop trigger if exists user_mutes_guard_file_assets on public.file_assets;
create trigger user_mutes_guard_file_assets
  before insert on public.file_assets
  for each row execute function private.reject_muted_user_writes();

drop trigger if exists user_mutes_guard_post_attachments on public.post_attachments;
create trigger user_mutes_guard_post_attachments
  before insert on public.post_attachments
  for each row execute function private.reject_muted_user_writes();

drop trigger if exists user_mutes_guard_message_attachments on public.message_attachments;
create trigger user_mutes_guard_message_attachments
  before insert on public.message_attachments
  for each row execute function private.reject_muted_user_writes();

alter policy kaveh_storage_insert_own on storage.objects
  with check (
    bucket_id = 'user-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.user_mutes m
      where m.user_id = (select auth.uid())
        and m.restriction = 'file_upload'
        and m.revoked_at is null
        and m.starts_at <= now()
        and (m.expires_at is null or m.expires_at > now())
    )
  );

alter policy post_media_insert_own on storage.objects
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.user_mutes m
      where m.user_id = (select auth.uid())
        and m.restriction = 'file_upload'
        and m.revoked_at is null
        and m.starts_at <= now()
        and (m.expires_at is null or m.expires_at > now())
    )
  );

alter policy kaveh_storage_update_own on storage.objects
  using (
    bucket_id = 'user-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.user_mutes m
      where m.user_id = (select auth.uid())
        and m.restriction = 'file_upload'
        and m.revoked_at is null
        and m.starts_at <= now()
        and (m.expires_at is null or m.expires_at > now())
    )
  )
  with check (
    bucket_id = 'user-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.user_mutes m
      where m.user_id = (select auth.uid())
        and m.restriction = 'file_upload'
        and m.revoked_at is null
        and m.starts_at <= now()
        and (m.expires_at is null or m.expires_at > now())
    )
  );

alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_action_check
  check (action in (
    'moderate_post',
    'delete_post',
    'delete_reel',
    'set_audio_track_active',
    'warn_user',
    'ban_user',
    'unban_user',
    'mute_user',
    'unmute_user',
    'set_admin_role',
    'remove_admin_role',
    'review_report',
    'appearance_publish',
    'appearance_rollback'
  ));

comment on table public.user_mutes is
  'Server-enforced per-user action restrictions; writes are managed by the privileged admin-console Edge Function.';
