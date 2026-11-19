-- Kaveh Universe: secure missions, points, badges and platform events.
create table if not exists public.daily_missions (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 title text not null check(char_length(title) between 3 and 120), description text not null default '',
 action_key text not null check(action_key in ('publish_post','react_post','comment_post','publish_reel')),
 target_count integer not null default 1 check(target_count between 1 and 100),
 reward_points integer not null default 10 check(reward_points between 0 and 10000),
 active boolean not null default true, starts_at timestamptz not null default now(), ends_at timestamptz,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), check(ends_at is null or ends_at>starts_at)
);
create index if not exists daily_missions_active_window_idx on public.daily_missions(active,starts_at,ends_at);
create table if not exists public.mission_progress (
 mission_id uuid not null references public.daily_missions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 progress_count integer not null default 0 check(progress_count>=0), completed_at timestamptz,
 reward_claimed_at timestamptz, updated_at timestamptz not null default now(), primary key(mission_id,user_id)
);
create index if not exists mission_progress_user_updated_idx on public.mission_progress(user_id,updated_at desc);
create table if not exists public.mission_activity_events (
 id bigint generated always as identity primary key, mission_id uuid not null references public.daily_missions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, action_key text not null, source_id uuid not null,
 created_at timestamptz not null default now(), unique(mission_id,user_id,action_key,source_id)
);
create index if not exists mission_activity_events_user_idx on public.mission_activity_events(user_id,created_at desc);
create table if not exists public.platform_events (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 3 and 160),
 summary text not null default '', body text not null default '',
 category text not null default 'community' check(category in ('community','competition','announcement','challenge','live')),
 banner_path text, status text not null default 'draft' check(status in ('draft','published','archived')),
 starts_at timestamptz not null default now(), ends_at timestamptz, points_reward integer not null default 0 check(points_reward between 0 and 100000),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), check(ends_at is null or ends_at>starts_at)
);
create index if not exists platform_events_public_window_idx on public.platform_events(status,starts_at,ends_at);
create table if not exists public.platform_event_participants (
 event_id uuid not null references public.platform_events(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(), primary key(event_id,user_id)
);
create index if not exists platform_event_participants_user_idx on public.platform_event_participants(user_id,joined_at desc);
alter table public.daily_missions enable row level security;
alter table public.mission_progress enable row level security;
alter table public.mission_activity_events enable row level security;
alter table public.platform_events enable row level security;
alter table public.platform_event_participants enable row level security;
create policy daily_missions_read_active on public.daily_missions for select to authenticated using((active and starts_at<=now() and (ends_at is null or ends_at>now())) or exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy daily_missions_admin_insert on public.daily_missions for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy daily_missions_admin_update on public.daily_missions for update to authenticated using(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator'))) with check(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy daily_missions_admin_delete on public.daily_missions for delete to authenticated using(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy mission_progress_read_self_or_admin on public.mission_progress for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy mission_activity_admin_read on public.mission_activity_events for select to authenticated using(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy platform_events_read_public_or_admin on public.platform_events for select to authenticated using((status='published' and (ends_at is null or ends_at>now())) or exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy platform_events_admin_insert on public.platform_events for insert to authenticated with check(created_by=(select auth.uid()) and exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy platform_events_admin_update on public.platform_events for update to authenticated using(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator'))) with check(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy platform_events_admin_delete on public.platform_events for delete to authenticated using(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy platform_event_participants_read on public.platform_event_participants for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin','moderator')));
create policy platform_event_participants_join on public.platform_event_participants for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.platform_events e where e.id=event_id and e.status='published' and (e.ends_at is null or e.ends_at>now())));
create policy platform_event_participants_leave on public.platform_event_participants for delete to authenticated using(user_id=(select auth.uid()));
create or replace function private.record_mission_activity() returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_user_id uuid; v_action text; v_source_id uuid; v_mission record; v_progress integer; v_score bigint; v_rank text;
begin
 if tg_table_name='posts' then v_user_id:=new.author_id; v_action:='publish_post'; v_source_id:=new.id;
 elsif tg_table_name='post_reactions' then v_user_id:=new.user_id; v_action:='react_post'; v_source_id:=new.post_id;
 elsif tg_table_name='comments' then v_user_id:=new.author_id; v_action:='comment_post'; v_source_id:=new.id;
 elsif tg_table_name='reels' then v_user_id:=new.author_id; v_action:='publish_reel'; v_source_id:=new.id; else return new; end if;
 if v_user_id is null or v_source_id is null then return new; end if;
 for v_mission in select id,target_count,reward_points from public.daily_missions where action_key=v_action and active=true and starts_at<=now() and (ends_at is null or ends_at>now()) loop
  v_progress:=null;
  insert into public.mission_activity_events(mission_id,user_id,action_key,source_id) values(v_mission.id,v_user_id,v_action,v_source_id) on conflict do nothing;
  if not found then continue; end if;
  insert into public.mission_progress(mission_id,user_id,progress_count,updated_at) values(v_mission.id,v_user_id,1,now())
  on conflict(mission_id,user_id) do update set progress_count=least(public.mission_progress.progress_count+1,v_mission.target_count),updated_at=now()
  where public.mission_progress.completed_at is null returning progress_count into v_progress;
  if v_progress is not null and v_progress>=v_mission.target_count then
   update public.mission_progress set completed_at=now(),reward_claimed_at=now() where mission_id=v_mission.id and user_id=v_user_id and reward_claimed_at is null;
   if found and v_mission.reward_points>0 then
    insert into public.user_rank_state(user_id,score,rank_code,updated_at) values(v_user_id,v_mission.reward_points,'newcomer',now())
    on conflict(user_id) do update set score=public.user_rank_state.score+excluded.score,updated_at=now();
    select score into v_score from public.user_rank_state where user_id=v_user_id;
    select code into v_rank from public.rank_levels where min_score<=v_score order by min_score desc limit 1;
    if v_rank is not null then update public.user_rank_state set rank_code=v_rank,updated_at=now() where user_id=v_user_id; end if;
   end if;
  end if;
 end loop;
 return new;
end; $$;
revoke all on function private.record_mission_activity() from public,anon,authenticated;
create trigger trg_mission_posts after insert on public.posts for each row execute function private.record_mission_activity();
create trigger trg_mission_reactions after insert on public.post_reactions for each row execute function private.record_mission_activity();
create trigger trg_mission_comments after insert on public.comments for each row execute function private.record_mission_activity();
create trigger trg_mission_reels after insert on public.reels for each row execute function private.record_mission_activity();
insert into public.daily_missions(code,title,description,action_key,target_count,reward_points,active) values
('first-post','اولین قدم','یک پست منتشر کن.','publish_post',1,25,true),
('community-voice','صدای جامعه','به سه پست واکنش بده.','react_post',3,15,true),
('kind-comment','گفت‌وگوی سازنده','سه دیدگاه ثبت کن.','comment_post',3,30,true),
('short-creator','سازنده ویدئو','یک ریلز منتشر کن.','publish_reel',1,40,true) on conflict(code) do nothing;
create policy badges_admin_insert on public.badges for insert to authenticated with check(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin')));
create policy badges_admin_update on public.badges for update to authenticated using(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin'))) with check(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin')));
create policy badges_admin_delete on public.badges for delete to authenticated using(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin')));
create policy user_badges_admin_insert on public.user_badges for insert to authenticated with check(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin')));
create policy user_badges_admin_delete on public.user_badges for delete to authenticated using(exists(select 1 from public.site_access_admins a where a.user_id=(select auth.uid()) and a.role in('owner','admin')));
