create or replace function private.notify_conversation_members_of_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_preview text;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  if new.scheduled_at is not null and new.scheduled_at > now() then
    return new;
  end if;

  v_preview := left(coalesce(nullif(new.body, ''), 'پیام جدید'), 140);

  insert into public.notifications (
    recipient_id, actor_id, kind, entity_type, entity_id, payload
  )
  select
    cm.user_id, new.sender_id, 'chat_message', 'conversation',
    new.conversation_id,
    jsonb_build_object('message', v_preview, 'conversation_id', new.conversation_id, 'message_id', new.id)
  from public.conversation_members cm
  where cm.conversation_id = new.conversation_id
    and cm.user_id <> new.sender_id
    and cm.notifications_enabled = true
    and (cm.muted_until is null or cm.muted_until <= now());

  return new;
end;
$function$;

revoke all on function private.notify_conversation_members_of_message() from public;

drop trigger if exists messages_notify_conversation_members on public.messages;
create trigger messages_notify_conversation_members
after insert on public.messages
for each row
execute function private.notify_conversation_members_of_message();
