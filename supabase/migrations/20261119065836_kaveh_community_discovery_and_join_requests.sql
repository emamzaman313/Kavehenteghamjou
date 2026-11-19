create table if not exists public.conversation_join_requests (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 requester_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
 requested_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 unique(conversation_id,requester_id)
);
create index if not exists conversation_join_requests_manager_idx on public.conversation_join_requests(conversation_id,status,requested_at desc);
alter table public.conversation_join_requests enable row level security;
create policy join_requests_select_own_or_managed on public.conversation_join_requests for select to authenticated
using (requester_id=(select auth.uid()) or private.is_conversation_manager(conversation_id));
create policy join_requests_update_managed on public.conversation_join_requests for update to authenticated
using (status='pending' and private.is_conversation_manager(conversation_id))
with check (status in ('approved','rejected') and private.is_conversation_manager(conversation_id));
grant select,update on public.conversation_join_requests to authenticated;

create or replace function private.apply_conversation_join_decision()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if old.status='pending' and new.status='approved' then
   insert into public.conversation_members(conversation_id,user_id,member_role)
   values(new.conversation_id,new.requester_id,'member') on conflict(conversation_id,user_id) do nothing;
   insert into public.notifications(recipient_id,actor_id,kind,entity_type,entity_id,payload)
   values(new.requester_id,new.reviewed_by,'join_request_approved','conversation',new.conversation_id,'{}'::jsonb);
 elsif old.status='pending' and new.status='rejected' then
   insert into public.notifications(recipient_id,actor_id,kind,entity_type,entity_id,payload)
   values(new.requester_id,new.reviewed_by,'join_request_rejected','conversation',new.conversation_id,'{}'::jsonb);
 end if;
 return new;
end;
$$;
revoke all on function private.apply_conversation_join_decision() from public,anon,authenticated;
drop trigger if exists conversation_join_decision_trigger on public.conversation_join_requests;
create trigger conversation_join_decision_trigger after update of status on public.conversation_join_requests
for each row execute function private.apply_conversation_join_decision();

create or replace function public.discover_communities()
returns table(conversation_id uuid,title text,description text,kind text,username text,owner_id uuid,join_approval_required boolean,member_count bigint)
language sql stable security definer set search_path=''
as $$
 select c.id,coalesce(nullif(c.title,''),nullif(cs.username,''),'گروه کاوه'),
        coalesce(gs.description,cs.description,''),c.kind,cs.username,
        coalesce(gs.owner_id,cs.owner_id),coalesce(gs.join_approval_required,false),
        (select count(*) from public.conversation_members cm where cm.conversation_id=c.id)
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
returns text language plpgsql security definer set search_path=''
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
