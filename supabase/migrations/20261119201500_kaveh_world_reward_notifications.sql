-- Emit in-app notifications when a mission is completed or event points are distributed.
create or replace function private.record_mission_activity()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_user_id uuid; v_action text; v_source_id uuid; v_mission record; v_progress integer; v_score bigint; v_rank text;
begin
 if tg_table_name='posts' then v_user_id:=new.author_id; v_action:='publish_post'; v_source_id:=new.id;
 elsif tg_table_name='post_reactions' then v_user_id:=new.user_id; v_action:='react_post'; v_source_id:=new.post_id;
 elsif tg_table_name='comments' then v_user_id:=new.author_id; v_action:='comment_post'; v_source_id:=new.id;
 elsif tg_table_name='reels' then v_user_id:=new.author_id; v_action:='publish_reel'; v_source_id:=new.id; else return new; end if;
 if v_user_id is null or v_source_id is null then return new; end if;
 for v_mission in select id,title,target_count,reward_points from public.daily_missions where action_key=v_action and active=true and starts_at<=now() and (ends_at is null or ends_at>now()) loop
  v_progress:=null;
  insert into public.mission_activity_events(mission_id,user_id,action_key,source_id) values(v_mission.id,v_user_id,v_action,v_source_id) on conflict do nothing;
  if not found then continue; end if;
  insert into public.mission_progress(mission_id,user_id,progress_count,updated_at) values(v_mission.id,v_user_id,1,now())
  on conflict(mission_id,user_id) do update set progress_count=least(public.mission_progress.progress_count+1,v_mission.target_count),updated_at=now()
  where public.mission_progress.completed_at is null returning progress_count into v_progress;
  if v_progress is not null and v_progress>=v_mission.target_count then
   update public.mission_progress set completed_at=now(),reward_claimed_at=now() where mission_id=v_mission.id and user_id=v_user_id and reward_claimed_at is null;
   if found then
    insert into public.notifications(recipient_id,kind,entity_type,entity_id,payload) values(v_user_id,'mission_completed','daily_mission',v_mission.id,jsonb_build_object('title','مأموریت تکمیل شد','message','مأموریت «'||v_mission.title||'» را کامل کردی و '||v_mission.reward_points||' امتیاز دریافت کردی.','points',v_mission.reward_points));
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
create or replace function private.distribute_platform_event_rewards()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_participant record; v_score bigint; v_rank text;
begin
 if new.status='archived' and old.status is distinct from 'archived' and new.points_reward>0 then
  for v_participant in select user_id from public.platform_event_participants where event_id=new.id loop
   insert into private.platform_event_reward_ledger(event_id,user_id,points_awarded) values(new.id,v_participant.user_id,new.points_reward) on conflict do nothing;
   if found then
    insert into public.user_rank_state(user_id,score,rank_code,updated_at) values(v_participant.user_id,new.points_reward,'newcomer',now()) on conflict(user_id) do update set score=public.user_rank_state.score+excluded.score,updated_at=now();
    select score into v_score from public.user_rank_state where user_id=v_participant.user_id;
    select code into v_rank from public.rank_levels where min_score<=v_score order by min_score desc limit 1;
    if v_rank is not null then update public.user_rank_state set rank_code=v_rank,updated_at=now() where user_id=v_participant.user_id; end if;
    insert into public.notifications(recipient_id,kind,entity_type,entity_id,payload) values(v_participant.user_id,'event_reward','platform_event',new.id,jsonb_build_object('title','جایزه رویداد','message','رویداد «'||new.title||'» به پایان رسید و '||new.points_reward||' امتیاز به تو تعلق گرفت.','points',new.points_reward));
   end if;
  end loop;
 end if;
 return new;
end; $$;
revoke all on function private.distribute_platform_event_rewards() from public,anon,authenticated;
