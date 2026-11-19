create policy join_requests_retry_own on public.conversation_join_requests
for update to authenticated
using (requester_id=(select auth.uid()) and status in ('rejected','cancelled'))
with check (requester_id=(select auth.uid()) and status='pending');
