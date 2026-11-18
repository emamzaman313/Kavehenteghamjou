-- ARCHIVED DRAFT — NOT A REPRODUCIBLE OR DEPLOYABLE MIGRATION.
-- The live project has subsequent RLS and privilege hardening migrations.
-- Do not apply this file; it contains the early policy draft, not the final remote schema.

-- Schema foundation deployed to Supabase project slwzjufipavuwcbwoyro.
-- The database was provisioned with this logical schema, RLS policies and private Storage bucket.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text, display_name text not null default 'کاربر', bio text not null default '',
 avatar_url text, avatar_path text, cover_path text,
 profile_visibility text not null default 'public' check(profile_visibility in ('public','followers','private')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index profiles_username_ci_idx on public.profiles(lower(username)) where username is not null;
create table public.user_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 theme_preference text not null default 'system' check(theme_preference in ('system','dark','light')),
 locale text not null default 'fa', privacy jsonb not null default '{}'::jsonb,
 notifications jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table public.rank_levels (
 code text primary key, title text not null, min_score bigint not null unique check(min_score>=0),
 sort_order integer not null unique, accent_token text not null default 'neutral'
);
insert into public.rank_levels(code,title,min_score,sort_order,accent_token) values
('newcomer','تازه‌وارد',0,1,'neutral'),('member','عضو',100,2,'silver'),('active','کاربر فعال',500,3,'blue'),
('professional','کاربر حرفه‌ای',1500,4,'violet'),('special','کاربر ویژه',4000,5,'gold'),('trusted','معتبر',9000,6,'emerald'),
('veteran','پیشکسوت',18000,7,'amber'),('expert','کاردرست',35000,8,'orange'),('master','استاد',65000,9,'crimson')
on conflict(code) do nothing;
create table public.user_rank_state (
 user_id uuid primary key references auth.users(id) on delete cascade, score bigint not null default 0 check(score>=0),
 rank_code text not null default 'newcomer' references public.rank_levels(code), updated_at timestamptz not null default now()
);
create table public.badges (code text primary key,title text not null,description text not null default '',icon_key text not null,accent_token text not null default 'neutral');
create table public.user_badges (
 user_id uuid not null references auth.users(id) on delete cascade,
 badge_code text not null references public.badges(code) on delete cascade,
 awarded_at timestamptz not null default now(), awarded_by uuid references auth.users(id) on delete set null,
 primary key(user_id,badge_code)
);
create table public.follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 following_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'accepted' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(), primary key(follower_id,following_id), check(follower_id<>following_id)
);
create index follows_target_idx on public.follows(following_id,status);
create table public.conversations (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('direct','group','channel','saved')),
 title text, created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), last_message_at timestamptz
);
create table public.conversation_members (
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 member_role text not null default 'member' check(member_role in ('owner','admin','moderator','member')),
 joined_at timestamptz not null default now(), last_read_at timestamptz, muted_until timestamptz,
 notifications_enabled boolean not null default true, primary key(conversation_id,user_id)
);
create index conversation_members_user_idx on public.conversation_members(user_id,conversation_id);
create table public.group_spaces (
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete restrict, description text not null default '',
 join_approval_required boolean not null default false, created_at timestamptz not null default now()
);
create table public.channel_spaces (
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete restrict, username text, description text not null default '',
 visibility text not null default 'public' check(visibility in ('public','private')), created_at timestamptz not null default now()
);
create unique index channel_username_ci_idx on public.channel_spaces(lower(username)) where username is not null;
create table public.chat_topics (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.group_spaces(conversation_id) on delete cascade,
 title text not null, icon_key text, is_closed boolean not null default false,
 created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
 topic_id uuid references public.chat_topics(id) on delete set null, sender_id uuid not null references auth.users(id) on delete restrict,
 body text not null default '', format text not null default 'plain' check(format in ('plain','markdown','rich')),
 entities jsonb not null default '[]'::jsonb check(jsonb_typeof(entities)='array'),
 reply_to uuid references public.messages(id) on delete set null, forwarded_from uuid references public.messages(id) on delete set null,
 edited_at timestamptz, deleted_at timestamptz, scheduled_at timestamptz, created_at timestamptz not null default now()
);
create index messages_conversation_time_idx on public.messages(conversation_id,created_at desc);
create table public.file_assets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 bucket_id text not null default 'user-files' check(bucket_id='user-files'), object_path text not null,
 original_name text not null, mime_type text, byte_size bigint not null check(byte_size between 0 and 50000000),
 sha256_hex text, status text not null default 'pending' check(status in ('pending','ready','failed','deleted')),
 created_at timestamptz not null default now(), unique(bucket_id,object_path), check(object_path like owner_id::text || '/%')
);
create index file_assets_owner_time_idx on public.file_assets(owner_id,created_at desc);
create table public.message_attachments (
 message_id uuid not null references public.messages(id) on delete cascade,
 file_asset_id uuid not null references public.file_assets(id) on delete restrict,
 display_order integer not null default 0, caption text, primary key(message_id,file_asset_id)
);
create table public.posts (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id) on delete cascade,
 body text not null default '', visibility text not null default 'public' check(visibility in ('public','followers','private')),
 comments_enabled boolean not null default true, published_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index posts_feed_time_idx on public.posts(published_at desc,id);
create table public.post_media (
 post_id uuid not null references public.posts(id) on delete cascade,
 file_asset_id uuid not null references public.file_assets(id) on delete restrict,
 position integer not null default 0, primary key(post_id,file_asset_id)
);
create table public.post_reactions (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 reaction text not null check(length(reaction) between 1 and 32), created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 parent_comment_id uuid references public.comments(id) on delete cascade,
 body text not null check(length(body) between 1 and 10000), created_at timestamptz not null default now(), edited_at timestamptz
);
create table public.stories (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 file_asset_id uuid references public.file_assets(id) on delete set null, text_overlay text,
 audience text not null default 'followers' check(audience in ('public','followers','close_friends','selected','private')),
 expires_at timestamptz not null default now()+interval '24 hours', created_at timestamptz not null default now()
);
create table public.story_views (
 story_id uuid not null references public.stories(id) on delete cascade,
 viewer_id uuid not null references auth.users(id) on delete cascade,
 viewed_at timestamptz not null default now(), primary key(story_id,viewer_id)
);
create table public.saved_items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 item_type text not null check(item_type in ('message','post','file','link')), item_id uuid not null,
 note text, labels text[] not null default '{}', created_at timestamptz not null default now(), unique(user_id,item_type,item_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, kind text not null, entity_type text, entity_id uuid,
 payload jsonb not null default '{}'::jsonb, read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_inbox_time_idx on public.notifications(recipient_id,created_at desc);
create table public.reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id) on delete cascade,
 target_type text not null check(target_type in ('user','message','post','comment','group','channel','file')),
 target_id uuid not null, reason text not null, details text,
 status text not null default 'open' check(status in ('open','reviewing','resolved','rejected')),
 created_at timestamptz not null default now()
);
create table public.device_tokens (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 platform text not null default 'android' check(platform='android'), token text not null unique,
 device_label text, last_seen_at timestamptz not null default now(), created_at timestamptz not null default now()
);

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path=''
as $$ declare v_name text; begin
 v_name:=coalesce(nullif(new.raw_user_meta_data->>'full_name',''),nullif(new.raw_user_meta_data->>'name',''),nullif(split_part(coalesce(new.email,''),'@',1),''),'کاربر');
 insert into public.profiles(id,display_name,avatar_url) values(new.id,v_name,new.raw_user_meta_data->>'avatar_url') on conflict(id) do nothing;
 insert into public.user_settings(user_id) values(new.id) on conflict(user_id) do nothing;
 insert into public.user_rank_state(user_id) values(new.id) on conflict(user_id) do nothing;
 return new; end $$;
revoke all on function private.handle_new_user() from public;
create trigger on_auth_user_created_kaveh after insert on auth.users for each row execute function private.handle_new_user();

-- RLS is enabled on all 25 product tables (policies are defined in the deployed migration).
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.rank_levels enable row level security;
alter table public.user_rank_state enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.follows enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.group_spaces enable row level security;
alter table public.channel_spaces enable row level security;
alter table public.chat_topics enable row level security;
alter table public.messages enable row level security;
alter table public.file_assets enable row level security;
alter table public.message_attachments enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_reactions enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.saved_items enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.device_tokens enable row level security;

-- Owner-isolation policies for the foundational profile/settings/files/saved/notification surfaces.
create policy profiles_select on public.profiles for select to authenticated using(id=(select auth.uid()) or profile_visibility='public');
create policy profiles_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy settings_select on public.user_settings for select to authenticated using(user_id=(select auth.uid()));
create policy settings_insert on public.user_settings for insert to authenticated with check(user_id=(select auth.uid()));
create policy settings_update on public.user_settings for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy rank_levels_select on public.rank_levels for select to authenticated using(true);
create policy rank_state_select on public.user_rank_state for select to authenticated using(true);
create policy badges_select on public.badges for select to authenticated using(true);
create policy user_badges_select on public.user_badges for select to authenticated using(true);
create policy follows_select on public.follows for select to authenticated using(follower_id=(select auth.uid()) or following_id=(select auth.uid()));
create policy follows_insert on public.follows for insert to authenticated with check(follower_id=(select auth.uid()) and follower_id<>following_id);
create policy follows_update on public.follows for update to authenticated using(following_id=(select auth.uid())) with check(following_id=(select auth.uid()));
create policy follows_delete on public.follows for delete to authenticated using(follower_id=(select auth.uid()) or following_id=(select auth.uid()));
create policy conversations_select on public.conversations for select to authenticated using(exists(select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=(select auth.uid())));
create policy conversations_insert on public.conversations for insert to authenticated with check(created_by=(select auth.uid()));
create policy members_select on public.conversation_members for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.conversation_members m where m.conversation_id=conversation_members.conversation_id and m.user_id=(select auth.uid())));
create policy members_insert_self on public.conversation_members for insert to authenticated with check(user_id=(select auth.uid()) and member_role='owner' and exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=(select auth.uid())));
create policy messages_select on public.messages for select to authenticated using(exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=(select auth.uid())));
create policy messages_insert on public.messages for insert to authenticated with check(sender_id=(select auth.uid()) and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=(select auth.uid())));
create policy messages_update on public.messages for update to authenticated using(sender_id=(select auth.uid())) with check(sender_id=(select auth.uid()));
create policy messages_delete on public.messages for delete to authenticated using(sender_id=(select auth.uid()));
create policy files_select_own on public.file_assets for select to authenticated using(owner_id=(select auth.uid()));
create policy files_insert_own on public.file_assets for insert to authenticated with check(owner_id=(select auth.uid()) and byte_size<=50000000 and object_path like (select auth.uid())::text||'/%');
create policy files_update_own on public.file_assets for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and byte_size<=50000000);
create policy files_delete_own on public.file_assets for delete to authenticated using(owner_id=(select auth.uid()));
create policy posts_select on public.posts for select to authenticated using(author_id=(select auth.uid()) or visibility='public');
create policy posts_insert on public.posts for insert to authenticated with check(author_id=(select auth.uid()));
create policy posts_update on public.posts for update to authenticated using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()));
create policy posts_delete on public.posts for delete to authenticated using(author_id=(select auth.uid()));
create policy saved_items_all on public.saved_items for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy notifications_select on public.notifications for select to authenticated using(recipient_id=(select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using(recipient_id=(select auth.uid()));
create policy reports_select on public.reports for select to authenticated using(reporter_id=(select auth.uid()));
create policy reports_insert on public.reports for insert to authenticated with check(reporter_id=(select auth.uid()));
create policy device_tokens_all on public.device_tokens for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant update(display_name,username,bio,avatar_url,avatar_path,cover_path,profile_visibility) on public.profiles to authenticated;
grant insert,update,delete on public.user_settings,public.follows,public.saved_items,public.device_tokens to authenticated;
grant insert,update,delete on public.posts to authenticated;
grant insert,update(body,format,entities,edited_at,deleted_at),delete on public.messages to authenticated;
revoke all on all tables in schema public from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('user-files','user-files',false,50000000,null)
on conflict(id) do update set public=false,file_size_limit=50000000,allowed_mime_types=null;
create policy kaveh_storage_insert_own on storage.objects for insert to authenticated with check(bucket_id='user-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kaveh_storage_select_own on storage.objects for select to authenticated using(bucket_id='user-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kaveh_storage_update_own on storage.objects for update to authenticated using(bucket_id='user-files' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='user-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy kaveh_storage_delete_own on storage.objects for delete to authenticated using(bucket_id='user-files' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- The live publication includes messages, notifications and posts.
