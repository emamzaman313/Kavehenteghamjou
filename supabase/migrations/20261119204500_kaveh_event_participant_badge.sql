create or replace function private.sync_platform_event_participant_count()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
 if tg_op='INSERT' then
  update public.platform_events set participant_count=participant_count+1,updated_at=now() where id=new.event_id;
  insert into public.user_badges(user_id,badge_code,awarded_by) values(new.user_id,'event_member',null) on conflict do nothing;
  return new;
 else
  update public.platform_events set participant_count=greatest(0,participant_count-1),updated_at=now() where id=old.event_id;
  return old;
 end if;
end; $$;
revoke all on function private.sync_platform_event_participant_count() from public,anon,authenticated;