-- Keep the privileged routine outside exposed API schemas. The public RPC is invoker-only.
create or replace function private.create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_user_a uuid;
  v_user_b uuid;
  v_conversation_id uuid;
begin
  if v_caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_other_user_id is null or p_other_user_id = v_caller then raise exception 'Invalid recipient' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_other_user_id
      and (p.profile_visibility = 'public' or exists (
        select 1 from public.follows f
        where f.follower_id = v_caller and f.following_id = p_other_user_id and f.status = 'accepted'
      ))
  ) then raise exception 'Recipient is unavailable for a new direct conversation' using errcode = '42501'; end if;
  if v_caller < p_other_user_id then v_user_a := v_caller; v_user_b := p_other_user_id;
  else v_user_a := p_other_user_id; v_user_b := v_caller; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_a::text || ':' || v_user_b::text, 0));
  select pair.conversation_id into v_conversation_id
  from public.direct_conversation_pairs pair where pair.user_a = v_user_a and pair.user_b = v_user_b;
  if v_conversation_id is not null then return v_conversation_id; end if;
  insert into public.conversations(kind,created_by) values ('direct',v_caller) returning id into v_conversation_id;
  insert into public.direct_conversation_pairs(conversation_id,user_a,user_b) values(v_conversation_id,v_user_a,v_user_b);
  insert into public.conversation_members(conversation_id,user_id,member_role) values
    (v_conversation_id,v_caller,'owner'),(v_conversation_id,p_other_user_id,'member');
  return v_conversation_id;
end;
$$;
revoke all on function private.create_direct_conversation(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.create_direct_conversation(uuid) to authenticated;

create or replace function public.create_direct_conversation(p_other_user_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.create_direct_conversation(p_other_user_id); $$;
revoke all on function public.create_direct_conversation(uuid) from public, anon;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
comment on function public.create_direct_conversation(uuid) is
'Authenticated wrapper. Delegates to a non-exposed private SECURITY DEFINER routine which validates auth.uid() and creates a 1:1 conversation.';
