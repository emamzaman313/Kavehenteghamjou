create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  subject text not null check (char_length(btrim(subject)) between 3 and 180),
  category text not null default 'general' check (category in ('general','account','technical','report','billing','other')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_user','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists support_tickets_requester_idx on public.support_tickets(requester_id,last_message_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status,last_message_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from public, anon;
grant select, update on public.support_tickets to authenticated;
create or replace function private.is_support_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.site_access_admins a where a.user_id = auth.uid() and a.role in ('owner','admin','support'));
$$;
revoke all on function private.is_support_staff() from public, anon;
grant execute on function private.is_support_staff() to authenticated;
create policy support_tickets_read_participants on public.support_tickets
for select to authenticated using (requester_id = (select auth.uid()) or (select private.is_support_staff()));
create policy support_tickets_update_staff on public.support_tickets
for update to authenticated using ((select private.is_support_staff())) with check ((select private.is_support_staff()));
create or replace function public.create_support_ticket(p_subject text,p_category text,p_body text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid(); v_staff uuid; v_conversation uuid; v_ticket uuid;
  v_subject text := btrim(coalesce(p_subject,'')); v_body text := btrim(coalesce(p_body,''));
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if char_length(v_subject) < 3 or char_length(v_subject) > 180 then raise exception 'Invalid subject' using errcode='22023'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then raise exception 'Invalid message' using errcode='22023'; end if;
  if p_category not in ('general','account','technical','report','billing','other') then raise exception 'Invalid category' using errcode='22023'; end if;
  select a.user_id into v_staff from public.site_access_admins a where a.role in ('owner','admin','support')
  order by case a.role when 'owner' then 0 when 'admin' then 1 else 2 end,a.created_at limit 1;
  if v_staff is null then raise exception 'Support team is not configured' using errcode='P0001'; end if;
  insert into public.conversations(kind,title,created_by) values ('direct','پشتیبانی: '||v_subject,v_user) returning id into v_conversation;
  insert into public.conversation_members(conversation_id,user_id,member_role)
  select v_conversation,v_user,'owner'
  union all select v_conversation,a.user_id,'admin' from public.site_access_admins a where a.role in ('owner','admin','support') and a.user_id<>v_user
  on conflict (conversation_id,user_id) do nothing;
  insert into public.messages(conversation_id,sender_id,body,format) values(v_conversation,v_user,v_body,'plain');
  insert into public.support_tickets(conversation_id,requester_id,assigned_to,subject,category) values(v_conversation,v_user,v_staff,v_subject,p_category) returning id into v_ticket;
  return v_ticket;
end;
$$;
revoke all on function public.create_support_ticket(text,text,text) from public,anon;
grant execute on function public.create_support_ticket(text,text,text) to authenticated;
create or replace function public.touch_support_ticket_from_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 update public.support_tickets set last_message_at=new.created_at,updated_at=now(),
 status=case when new.sender_id=requester_id and status='waiting_user' then 'in_progress'
 when new.sender_id=assigned_to and status in ('open','in_progress') then 'waiting_user' else status end
 where conversation_id=new.conversation_id;
 return new;
end;
$$;
create trigger support_ticket_message_touch after insert on public.messages for each row execute function public.touch_support_ticket_from_message();