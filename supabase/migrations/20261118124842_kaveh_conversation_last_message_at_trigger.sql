-- Keep conversation inbox ordering and activity metadata synchronized with messages.
-- This trigger runs only after a message insert, soft-delete update, or hard delete.
-- It only updates the last_message_at summary field; it does not expose message data.

create or replace function private.refresh_conversation_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    target_conversation_id uuid;
begin
    if tg_op = 'DELETE' then
        target_conversation_id := old.conversation_id;
    else
        target_conversation_id := new.conversation_id;
    end if;

    -- Serialize concurrent message writes in one conversation so that the
    -- summary is calculated against the latest committed message set.
    perform 1
    from public.conversations as c
    where c.id = target_conversation_id
    for update;

    update public.conversations as c
    set
        last_message_at = (
            select max(m.created_at)
            from public.messages as m
            where m.conversation_id = target_conversation_id
              and m.deleted_at is null
        ),
        updated_at = now()
    where c.id = target_conversation_id;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$function$;

revoke all on function private.refresh_conversation_last_message_at()
from public, anon, authenticated;

drop trigger if exists messages_refresh_conversation_activity on public.messages;

create trigger messages_refresh_conversation_activity
after insert or update of deleted_at or delete
on public.messages
for each row
execute function private.refresh_conversation_last_message_at();
