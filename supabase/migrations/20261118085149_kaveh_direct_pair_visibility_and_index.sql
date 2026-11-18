create policy direct_pairs_select_participant
on public.direct_conversation_pairs
for select to authenticated
using (user_a = (select auth.uid()) or user_b = (select auth.uid()));
grant select on public.direct_conversation_pairs to authenticated;
create index if not exists direct_pairs_user_b_idx
on public.direct_conversation_pairs(user_b);
