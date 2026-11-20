alter table public.daily_missions add column if not exists reward_badge_code text references public.badges(code) on delete set null;
insert into public.badges(code,title,description,icon_key,accent_token) values
 ('first_post','اولین انتشار','اولین پست خود را در کاوه منتشر کردی.','pen-line','blue'),
 ('community_voice','صدای جامعه','با واکنش‌های سازنده در جامعه مشارکت کردی.','heart','rose'),
 ('conversation_starter','هم‌صحبت','در گفتگوهای کاوه دیدگاه‌های سازنده ثبت کردی.','message-circle','violet'),
 ('reel_creator','سازنده ویدئو','اولین ریلز خود را منتشر کردی.','clapperboard','gold'),
 ('event_member','همراه رویداد','در یک رویداد سراسری کاوه شرکت کردی.','calendar-check','teal')
on conflict(code) do nothing;
update public.daily_missions set reward_badge_code='first_post' where code='first-post' and reward_badge_code is null;
update public.daily_missions set reward_badge_code='community_voice' where code='community-voice' and reward_badge_code is null;
update public.daily_missions set reward_badge_code='conversation_starter' where code='kind-comment' and reward_badge_code is null;
update public.daily_missions set reward_badge_code='reel_creator' where code='short-creator' and reward_badge_code is null;
create or replace function private.record_mission_activity()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_user_id uuid; v_action text; v_source_id uuid; v_mission record; v_progress integer; v_score bigint; v_rank text;
begin
 if tg_table_name='posts' then v_user_id:=new.author_id; v_action:='publish_post'; v_source_id:=new.id;
 elsif tg_table_name='post_reactions' then v_user_id:=new.user_id; v_action:='react_post'; v_source_id:=new.post_id;
 elsif tg_table_name='comments' then v_user_id:=new.author_id; v_action:='comment_post'; v_source_id:=new.id;
 elsif tg_table_name='reels' then v_user_id:=new.author_id; v_action:='publish_reel'; v_source_id:=new.id; else return new; end if;
 if v_user_id is null or v_source_id is null then return new; end if;
 for v_mission in select id,title,target_count,reward_points,reward_badge_code from public.daily_missions where action_key=v_action and active=true and starts_at<=now() and (ends_at is null or ends_at>now()) loop
  v_progress:=null;
  insert into public.mission_activity_events(mission_id,user_id,action_key,source_id) values(v_mission.id,v_user_id,v_action,v_source_id) on conflict do nothing;
  if not found then continue; end if;
  insert into public.mission_progress(mission_id,user_id,progress_count,updated_at) values(v_mission.id,v_user_id,1,now())
  on conflict(mission_id,user_id) do update set progress_count=least(public.mission_progress.progress_count+1,v_mission.target_count),updated_at=now()
  where public.mission_progress.completed_at is null returning progress_count into v_progress;
  if v_progress is not null and v_progress>=v_mission.target_count then
   update public.mission_progress set completed_at=now(),reward_claimed_at=now() where mission_id=v_mission.id and user_id=v_user_id and reward_claimed_at is null;
   if found then
    if v_mission.reward_badge_code is not null then insert into public.user_badges(user_id,badge_code,awarded_by) values(v_user_id,v_mission.reward_badge_code,null) on conflict do nothing; end if;
    insert into public.notifications(recipient_id,kind,entity_type,entity_id,payload) values(v_user_id,'mission_completed','daily_mission',v_mission.id,jsonb_build_object('title','مأموریت تکمیل شد','message','مأموریت «'||v_mission.title||'» را کامل کردی و '||v_mission.reward_points||' امتیاز دریافت کردی.','points',v_mission.reward_points,'badge_code',v_mission.reward_badge_code));
    if v_mission.reward_points>0 then
     insert into public.user_rank_state(user_id,score,rank_code,updated_at) values(v_user_id,v_mission.reward_points,'newcomer',now()) on conflict(user_id) do update set score=public.user_rank_state.score+excluded.score,updated_at=now();
     select score into v_score from public.user_rank_state where user_id=v_user_id;
     select code into v_rank from public.rank_levels where min_score<=v_score order by min_score desc limit 1;
     if v_rank is not null then update public.user_rank_state set rank_code=v_rank,updated_at=now() where user_id=v_user_id; end if;
    end if;
   end if;
  end if;
 end loop;
 return new;
end; $$;
revoke all on function private.record_mission_activity() from public,anon,authenticated;
