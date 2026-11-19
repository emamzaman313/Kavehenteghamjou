create or replace function public.touch_support_ticket_from_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_is_staff boolean;
begin
 select exists(select 1 from public.site_access_admins a where a.user_id=new.sender_id and a.role in ('owner','admin','support')) into v_is_staff;
 update public.support_tickets
 set last_message_at=new.created_at,updated_at=now(),
 assigned_to=case when v_is_staff then new.sender_id else assigned_to end,
 status=case
  when new.sender_id=requester_id and status in ('waiting_user','resolved','closed') then 'in_progress'
  when v_is_staff and status in ('open','in_progress') then 'waiting_user'
  else status end,
 resolved_at=case when new.sender_id=requester_id and status in ('waiting_user','resolved','closed') then null else resolved_at end
 where conversation_id=new.conversation_id;
 return new;
end;
$$;