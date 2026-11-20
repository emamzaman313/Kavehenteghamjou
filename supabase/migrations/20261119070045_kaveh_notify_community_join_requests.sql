create or replace function private.notify_community_join_request()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_owner uuid;
begin
 select coalesce(gs.owner_id,cs.owner_id) into v_owner
 from public.conversations c
 left join public.group_spaces gs on gs.conversation_id=c.id
 left join public.channel_spaces cs on cs.conversation_id=c.id
 where c.id=new.conversation_id;
 if v_owner is not null then
   insert into public.notifications(recipient_id,actor_id,kind,entity_type,entity_id,payload)
   values(v_owner,new.requester_id,'group_join_request','conversation',new.conversation_id,'{}'::jsonb);
 end if;
 return new;
end;
$$;
revoke all on function private.notify_community_join_request() from public,anon,authenticated;
drop trigger if exists notify_community_join_request_trigger on public.conversation_join_requests;
create trigger notify_community_join_request_trigger after insert on public.conversation_join_requests
for each row execute function private.notify_community_join_request();
