create or replace function public.register_device_token(
  p_token text,
  p_platform text default 'android',
  p_device_label text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_token is null or length(trim(p_token)) < 40 or length(p_token) > 4096 then
    raise exception 'Invalid push token';
  end if;
  if p_platform not in ('android','ios','web') then raise exception 'Unsupported platform'; end if;
  delete from public.device_tokens where token=trim(p_token);
  insert into public.device_tokens(user_id,platform,token,device_label,last_seen_at)
  values(v_user_id,p_platform,trim(p_token),left(nullif(trim(p_device_label),''),100),now());
end;
$$;
revoke all on function public.register_device_token(text,text,text) from public,anon;
grant execute on function public.register_device_token(text,text,text) to authenticated;

create or replace function public.unregister_device_token(p_token text)
returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  delete from public.device_tokens
  where user_id=(select auth.uid()) and token=trim(p_token);
end;
$$;
revoke all on function public.unregister_device_token(text) from public,anon;
grant execute on function public.unregister_device_token(text) to authenticated;
