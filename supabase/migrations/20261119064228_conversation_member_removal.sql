drop policy if exists members_delete_managed on public.conversation_members;
create policy members_delete_managed
on public.conversation_members
for delete
to authenticated
using (
  user_id <> (select auth.uid())
  and member_role = 'member'
  and private.is_conversation_manager(conversation_id)
);
