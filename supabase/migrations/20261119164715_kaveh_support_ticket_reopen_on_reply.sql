create or replace function public.touch_support_ticket_from_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 update public.support_tickets set last_message_at=new.created_at,updated_at=now(),
 status=case
 when new.sender_id=requester_id and status in ('waiting_user','resolved','closed') then 'in_progress'
 when new.sender_id=assigned_to and status in ('open','in_progress') then 'waiting_user'
 else status end,
 resolved_at=case when new.sender_id=requester_id and status in ('waiting_user','resolved','closed') then null else resolved_at end
 where conversation_id=new.conversation_id;
 return new;
end;
$$;