-- Create-or-reuse a one-to-one conversation using canonical UUID order and an advisory lock.
create table if not exists public.direct_conversation_pairs (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint direct_pair_canonical_order check (user_a < user_b),
  constraint direct_pair_unique unique(user_a,user_b)
);
alter table public.direct_conversation_pairs enable row level security;
revoke all privileges on public.direct_conversation_pairs from public, anon, authenticated;
create index if not exists chat_topics_conversation_idx on public.chat_topics(conversation_id);

create or replace function public.create_direct_conversation(p_other_user_id uuid)
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
  if v_caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_other_user_id is null or p_other_user_id = v_caller then
    raise exception 'Invalid recipient' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_other_user_id
      and (p.profile_visibility = 'public' or exists (
        select 1 from public.follows f
        where f.follower_id = v_caller and f.following_id = p_other_user_id and f.status = 'accepted'
      ))
  ) then
    raise exception 'Recipient is unavailable for a new direct conversation' using errcode = '42501';
  end if;
  if v_caller < p_other_user_id then
    v_user_a := v_caller; v_user_b := p_other_user_id;
  else
    v_user_a := p_other_user_id; v_user_b := v_caller;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_a::text || ':' || v_user_b::text, 0));
  select pair.conversation_id into v_conversation_id
  from public.direct_conversation_pairs pair
  where pair.user_a = v_user_a and pair.user_b = v_user_b;
  if v_conversation_id is not null then return v_conversation_id; end if;
  insert into public.conversations(kind,created_by) values ('direct',v_caller) returning id into v_conversation_id;
  insert into public.direct_conversation_pairs(conversation_id,user_a,user_b)
    values (v_conversation_id,v_user_a,v_user_b);
  insert into public.conversation_members(conversation_id,user_id,member_role) values
    (v_conversation_id,v_caller,'owner'),(v_conversation_id,p_other_user_id,'member');
  return v_conversation_id;
end;
$$;
revoke all on function public.create_direct_conversation(uuid) from public, anon;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
