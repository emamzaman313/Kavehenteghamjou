-- Allow group/channel owners and admins to add regular members.
-- Owners cannot be granted through this policy; owner creation remains self-only.
create or replace function private.is_conversation_manager(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = (select auth.uid())
      and cm.member_role in ('owner','admin')
  );
$function$;

revoke all on function private.is_conversation_manager(uuid) from public;
grant execute on function private.is_conversation_manager(uuid) to authenticated;

drop policy if exists members_insert_managed on public.conversation_members;
create policy members_insert_managed
on public.conversation_members
for insert
to authenticated
with check (
  user_id <> (select auth.uid())
  and member_role = 'member'
  and private.is_conversation_manager(conversation_id)
);
