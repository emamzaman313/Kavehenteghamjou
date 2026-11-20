create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function private.process_due_scheduled_notifications()
returns integer language plpgsql security definer set search_path=''
as $$
declare
  v_notice record;
  v_recipients uuid[];
  v_processed integer := 0;
  v_error text;
begin
  for v_notice in
    select id,title,body,audience,recipient_ids,created_by
    from public.scheduled_notifications
    where status='pending' and scheduled_at <= now()
    order by scheduled_at
    for update skip locked
    limit 50
  loop
    begin
      update public.scheduled_notifications set status='processing',error_message=null
      where id=v_notice.id and status='pending';
      if v_notice.audience='admins' then
        select coalesce(array_agg(user_id), '{}'::uuid[]) into v_recipients from public.site_access_admins;
      elsif v_notice.audience='specific' then
        v_recipients := coalesce(v_notice.recipient_ids, '{}'::uuid[]);
      else
        select coalesce(array_agg(id), '{}'::uuid[]) into v_recipients from auth.users;
      end if;
      insert into public.notifications(recipient_id,actor_id,kind,entity_type,entity_id,payload)
      select distinct recipient_id,v_notice.created_by,'scheduled_announcement','announcement',v_notice.id,
        jsonb_build_object('title',v_notice.title,'message',v_notice.body)
      from unnest(v_recipients) as recipient_id;
      update public.scheduled_notifications set status='sent',sent_at=now(),error_message=null where id=v_notice.id;
      v_processed := v_processed + 1;
    exception when others then
      get stacked diagnostics v_error = message_text;
      update public.scheduled_notifications set status='failed',error_message=left(v_error,500) where id=v_notice.id;
      v_processed := v_processed + 1;
    end;
  end loop;
  return v_processed;
end;
$$;
revoke all on function private.process_due_scheduled_notifications() from public,anon,authenticated;
select cron.schedule('kaveh-process-scheduled-notifications','* * * * *',
  $$select private.process_due_scheduled_notifications();$$);
