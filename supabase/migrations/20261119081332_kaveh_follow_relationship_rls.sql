-- Restrict follow relationships to the two participants.
-- New requests can only be created by the follower and begin pending.
-- Only the followed user can accept a pending request; status is the only
-- column they are allowed to update.

create policy follows_select_participants
on public.follows for select to authenticated
using ((select auth.uid()) = follower_id or (select auth.uid()) = following_id);

create policy follows_insert_own_request
on public.follows for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and following_id <> (select auth.uid())
  and status = 'pending'
);

create policy follows_accept_incoming
on public.follows for update to authenticated
using (following_id = (select auth.uid()) and status = 'pending')
with check (following_id = (select auth.uid()) and status = 'accepted');

create policy follows_delete_participant
on public.follows for delete to authenticated
using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

grant select, insert, delete on public.follows to authenticated;
grant update (status) on public.follows to authenticated;
