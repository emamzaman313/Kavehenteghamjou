create policy group_spaces_select_discoverable on public.group_spaces
for select to authenticated using (true);
create policy conversations_select_discoverable on public.conversations
for select to authenticated using (
  exists(select 1 from public.group_spaces gs where gs.conversation_id=conversations.id)
  or exists(select 1 from public.channel_spaces cs where cs.conversation_id=conversations.id and cs.visibility='public')
);
create policy members_insert_open_community on public.conversation_members
for insert to authenticated with check (
  user_id=(select auth.uid()) and member_role='member'
  and exists(
    select 1 from public.conversations c
    left join public.group_spaces gs on gs.conversation_id=c.id
    left join public.channel_spaces cs on cs.conversation_id=c.id
    where c.id=conversation_members.conversation_id
      and ((c.kind='group' and coalesce(gs.join_approval_required,false)=false)
        or (c.kind='channel' and cs.visibility='public'))
  )
);
create policy join_requests_insert_self on public.conversation_join_requests
for insert to authenticated with check (
  requester_id=(select auth.uid()) and status='pending'
  and exists(select 1 from public.group_spaces gs
    where gs.conversation_id=conversation_join_requests.conversation_id and gs.join_approval_required=true)
);
create or replace function private.community_member_count(p_conversation_id uuid)
returns bigint language sql stable security definer set search_path=''
as $$ select count(*) from public.conversation_members cm where cm.conversation_id=p_conversation_id; $$;
revoke all on function private.community_member_count(uuid) from public,anon;
grant execute on function private.community_member_count(uuid) to authenticated;
create or replace function public.discover_communities()
returns table(conversation_id uuid,title text,description text,kind text,username text,owner_id uuid,join_approval_required boolean,member_count bigint)
language sql stable security invoker set search_path=''
as $$
 select c.id,coalesce(nullif(c.title,''),nullif(cs.username,''),'گروه کاوه'),
        coalesce(gs.description,cs.description,''),c.kind,cs.username,
        coalesce(gs.owner_id,cs.owner_id),coalesce(gs.join_approval_required,false),
        private.community_member_count(c.id)
 from public.conversations c
 left join public.group_spaces gs on gs.conversation_id=c.id
 left join public.channel_spaces cs on cs.conversation_id=c.id
 where (gs.conversation_id is not null or (cs.conversation_id is not null and cs.visibility='public'))
   and c.kind in ('group','channel') and c.created_by <> (select auth.uid())
 order by c.created_at desc limit 100;
$$;
revoke all on function public.discover_communities() from public,anon;
grant execute on function public.discover_communities() to authenticated;
create or replace function public.join_community(p_conversation_id uuid)
returns text language plpgsql security invoker set search_path=''
as $$
declare v_user uuid := (select auth.uid()); v_kind text; v_approval boolean; v_visibility text;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select c.kind,coalesce(gs.join_approval_required,false),cs.visibility into v_kind,v_approval,v_visibility
 from public.conversations c left join public.group_spaces gs on gs.conversation_id=c.id
 left join public.channel_spaces cs on cs.conversation_id=c.id where c.id=p_conversation_id;
 if not found then raise exception 'Community not found'; end if;
 if exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=v_user) then return 'member'; end if;
 if v_kind='channel' then
   if v_visibility is distinct from 'public' then raise exception 'Private channel requires an invitation'; end if;
   insert into public.conversation_members(conversation_id,user_id,member_role) values(p_conversation_id,v_user,'member') on conflict do nothing;
   return 'joined';
 elsif v_kind='group' then
   if v_approval then
     insert into public.conversation_join_requests(conversation_id,requester_id,status) values(p_conversation_id,v_user,'pending')
     on conflict(conversation_id,requester_id) do update set status='pending',requested_at=now(),reviewed_at=null,reviewed_by=null;
     return 'pending';
   end if;
   insert into public.conversation_members(conversation_id,user_id,member_role) values(p_conversation_id,v_user,'member') on conflict do nothing;
   return 'joined';
 end if;
 raise exception 'Unsupported community type';
end;
$$;
revoke all on function public.join_community(uuid) from public,anon;
grant execute on function public.join_community(uuid) to authenticated;
create policy admin_audit_logs_deny_client on public.admin_audit_logs
for all to authenticated using (false) with check (false);
