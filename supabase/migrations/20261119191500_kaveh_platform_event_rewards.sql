-- Award event points exactly once when an administrator completes (archives) an event.
create table if not exists private.platform_event_reward_ledger (
 event_id uuid not null references public.platform_events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 points_awarded integer not null check(points_awarded>0),
 created_at timestamptz not null default now(),
 primary key(event_id,user_id)
);
revoke all on private.platform_event_reward_ledger from public,anon,authenticated;
create or replace function private.distribute_platform_event_rewards()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_participant record; v_score bigint; v_rank text;
begin
 if new.status='archived' and old.status is distinct from 'archived' and new.points_reward>0 then
  for v_participant in select user_id from public.platform_event_participants where event_id=new.id loop
   insert into private.platform_event_reward_ledger(event_id,user_id,points_awarded) values(new.id,v_participant.user_id,new.points_reward) on conflict do nothing;
   if found then
    insert into public.user_rank_state(user_id,score,rank_code,updated_at) values(v_participant.user_id,new.points_reward,'newcomer',now())
    on conflict(user_id) do update set score=public.user_rank_state.score+excluded.score,updated_at=now();
    select score into v_score from public.user_rank_state where user_id=v_participant.user_id;
    select code into v_rank from public.rank_levels where min_score<=v_score order by min_score desc limit 1;
    if v_rank is not null then update public.user_rank_state set rank_code=v_rank,updated_at=now() where user_id=v_participant.user_id; end if;
   end if;
  end loop;
 end if;
 return new;
end; $$;
revoke all on function private.distribute_platform_event_rewards() from public,anon,authenticated;
create trigger trg_distribute_platform_event_rewards after update of status on public.platform_events for each row execute function private.distribute_platform_event_rewards();
