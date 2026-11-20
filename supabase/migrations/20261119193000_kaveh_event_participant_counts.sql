alter table public.platform_events add column if not exists participant_count integer not null default 0 check(participant_count>=0);
update public.platform_events e set participant_count=(select count(*)::integer from public.platform_event_participants p where p.event_id=e.id);
create or replace function private.sync_platform_event_participant_count() returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
 if tg_op='INSERT' then update public.platform_events set participant_count=participant_count+1,updated_at=now() where id=new.event_id; return new;
 else update public.platform_events set participant_count=greatest(0,participant_count-1),updated_at=now() where id=old.event_id; return old; end if;
end; $$;
revoke all on function private.sync_platform_event_participant_count() from public,anon,authenticated;
create trigger trg_platform_event_participant_count after insert or delete on public.platform_event_participants for each row execute function private.sync_platform_event_participant_count();
