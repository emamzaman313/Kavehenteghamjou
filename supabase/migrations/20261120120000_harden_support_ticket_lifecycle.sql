-- Make support ticket creation and lifecycle transitions safe and consistent.
-- This migration is additive and preserves the private user-files bucket.

create or replace function public.create_support_ticket(
  p_subject text,
  p_category text,
  p_body text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_staff uuid;
  v_conversation uuid;
  v_ticket uuid;
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_support_enabled boolean;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(v_subject) < 3 or char_length(v_subject) > 180 then
    raise exception 'Subject must be between 3 and 180 characters' using errcode = '22023';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 10000 then
    raise exception 'Message must be between 1 and 10000 characters' using errcode = '22023';
  end if;
  if p_category is null or p_category not in ('general','account','technical','report','billing','other') then
    raise exception 'Invalid support category' using errcode = '22023';
  end if;

  select f.enabled into v_support_enabled
  from public.platform_feature_flags f
  where f.key = 'support';
  if v_support_enabled is false then
    raise exception 'Support is temporarily disabled' using errcode = '55000';
  end if;

  -- Prefer a different support agent when the requester is also staff.
  select a.user_id into v_staff
  from public.site_access_admins a
  where a.role in ('owner','admin','support')
    and a.user_id <> v_user
  order by case a.role when 'owner' then 0 when 'admin' then 1 else 2 end, a.created_at
  limit 1;

  -- If the requester is the only configured support agent, retain the ticket
  -- rather than silently losing it; it remains visible in the staff inbox.
  if v_staff is null then
    select a.user_id into v_staff
    from public.site_access_admins a
    where a.role in ('owner','admin','support')
    order by case a.role when 'owner' then 0 when 'admin' then 1 else 2 end, a.created_at
    limit 1;
  end if;
  if v_staff is null then
    raise exception 'Support team is not configured' using errcode = 'P0001';
  end if;

  insert into public.conversations(kind, title, created_by)
  values ('direct', 'پشتیبانی: ' || v_subject, v_user)
  returning id into v_conversation;

  insert into public.conversation_members(conversation_id, user_id, member_role)
  select v_conversation, v_user, 'owner'
  union all
  select v_conversation, a.user_id, 'admin'
  from public.site_access_admins a
  where a.role in ('owner','admin','support')
    and a.user_id <> v_user
  on conflict (conversation_id, user_id) do nothing;

  insert into public.messages(conversation_id, sender_id, body, format)
  values (v_conversation, v_user, v_body, 'plain');

  insert into public.support_tickets(
    conversation_id, requester_id, assigned_to, subject, category
  )
  values (v_conversation, v_user, v_staff, v_subject, p_category)
  returning id into v_ticket;

  return v_ticket;
end;
$$;

revoke all on function public.create_support_ticket(text,text,text) from public, anon;
grant execute on function public.create_support_ticket(text,text,text) to authenticated;

create or replace function public.update_support_ticket(
  p_ticket_id uuid,
  p_status text default null,
  p_priority text default null
) returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.support_tickets;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not private.is_support_staff() then
    raise exception 'Support staff permission required' using errcode = '42501';
  end if;
  if p_status is null and p_priority is null then
    raise exception 'No ticket changes supplied' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('open','in_progress','waiting_user','resolved','closed') then
    raise exception 'Invalid ticket status' using errcode = '22023';
  end if;
  if p_priority is not null and p_priority not in ('low','normal','high','urgent') then
    raise exception 'Invalid ticket priority' using errcode = '22023';
  end if;

  update public.support_tickets t
  set status = coalesce(p_status, t.status),
      priority = coalesce(p_priority, t.priority),
      resolved_at = case
        when p_status in ('resolved','closed') then coalesce(t.resolved_at, now())
        when p_status is not null then null
        else t.resolved_at
      end,
      updated_at = now()
  where t.id = p_ticket_id
  returning t.* into v_ticket;

  if v_ticket.id is null then
    raise exception 'Support ticket not found' using errcode = 'P0002';
  end if;
  return v_ticket;
end;
$$;

revoke all on function public.update_support_ticket(uuid,text,text) from public, anon;
grant execute on function public.update_support_ticket(uuid,text,text) to authenticated;

create or replace function public.touch_support_ticket_from_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_staff boolean := false;
begin
  select exists (
    select 1
    from public.site_access_admins a
    where a.user_id = new.sender_id
      and a.role in ('owner','admin','support')
  ) into v_is_staff;

  update public.support_tickets t
  set last_message_at = new.created_at,
      updated_at = now(),
      assigned_to = case
        when new.sender_id <> t.requester_id and v_is_staff then new.sender_id
        else t.assigned_to
      end,
      status = case
        when new.sender_id = t.requester_id
          and t.status in ('waiting_user','resolved','closed') then 'in_progress'
        when new.sender_id <> t.requester_id
          and v_is_staff then 'waiting_user'
        else t.status
      end,
      resolved_at = case
        when (new.sender_id = t.requester_id and t.status in ('waiting_user','resolved','closed'))
          or (new.sender_id <> t.requester_id and v_is_staff and t.status in ('resolved','closed'))
          then null
        else t.resolved_at
      end
  where t.conversation_id = new.conversation_id;

  return new;
end;
$$;

revoke all on function public.touch_support_ticket_from_message() from public, anon, authenticated;
