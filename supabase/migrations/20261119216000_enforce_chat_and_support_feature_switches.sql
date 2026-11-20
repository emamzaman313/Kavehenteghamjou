create or replace function private.guard_platform_feature_flag()
returns trigger language plpgsql security definer set search_path = '' as $$
declare flag_key text; is_enabled boolean; is_support_conversation boolean := false;
begin
  if tg_table_name='posts' then flag_key := 'posts';
  elsif tg_table_name='reels' then flag_key := 'reels';
  elsif tg_table_name='messages' then
    select coalesce(title like 'پشتیبانی:%',false) into is_support_conversation from public.conversations where id=new.conversation_id;
    flag_key := case when is_support_conversation then 'support' else 'chat' end;
  else return new; end if;
  if (select auth.uid()) is null then return new; end if;
  select enabled into is_enabled from public.platform_feature_flags where key=flag_key;
  if is_enabled is false then raise exception 'feature_disabled:%', flag_key using errcode='55000'; end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_message_feature_flag on public.messages;
create trigger trg_guard_message_feature_flag before insert on public.messages for each row execute function private.guard_platform_feature_flag();
revoke all on function private.guard_platform_feature_flag() from public, anon, authenticated;
