create or replace function public.create_support_ticket(p_subject text,p_category text,p_body text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_user uuid:=auth.uid(); v_staff uuid; v_conversation uuid; v_ticket uuid;
 v_subject text:=btrim(coalesce(p_subject,'')); v_body text:=btrim(coalesce(p_body,''));
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if char_length(v_subject)<3 or char_length(v_subject)>180 then raise exception 'Subject must be between 3 and 180 characters' using errcode='22023'; end if;
 if char_length(v_body)<1 or char_length(v_body)>10000 then raise exception 'Message must be between 1 and 10000 characters' using errcode='22023'; end if;
 if p_category not in ('general','account','technical','report','billing','other') then raise exception 'Invalid support category' using errcode='22023'; end if;
 select a.user_id into v_staff from public.site_access_admins a where a.role in ('owner','admin','support')
 order by case a.role when 'owner' then 0 when 'admin' then 1 else 2 end,a.created_at limit 1;
 if v_staff is null then raise exception 'Support team is not configured' using errcode='P0001'; end if;
 insert into public.conversations(kind,title,created_by) values('direct','پشتیبانی: '||v_subject,v_user) returning id into v_conversation;
 insert into public.conversation_members(conversation_id,user_id,member_role)
 select v_conversation,v_user,'owner'
 union all select v_conversation,a.user_id,'admin' from public.site_access_admins a
 where a.role in ('owner','admin','support') and a.user_id<>v_user
 on conflict(conversation_id,user_id) do nothing;
 insert into public.messages(conversation_id,sender_id,body,format) values(v_conversation,v_user,v_body,'plain');
 insert into public.support_tickets(conversation_id,requester_id,assigned_to,subject,category)
 values(v_conversation,v_user,v_staff,v_subject,p_category) returning id into v_ticket;
 return v_ticket;
end;
$$;