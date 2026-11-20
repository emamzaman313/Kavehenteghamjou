do $$
declare t text;
begin
  foreach t in array array['platform_feature_flags','profiles','posts','comments','reports','admin_audit_logs'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
create or replace function private.guard_platform_feature_flag()
returns trigger language plpgsql security definer set search_path = '' as $$
declare flag_key text; is_enabled boolean;
begin
  flag_key := case when tg_table_name='posts' then 'posts' when tg_table_name='reels' then 'reels' else null end;
  if flag_key is null or (select auth.uid()) is null then return new; end if;
  select enabled into is_enabled from public.platform_feature_flags where key=flag_key;
  if is_enabled is false then raise exception 'feature_disabled:%', flag_key using errcode='55000'; end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_post_feature_flag on public.posts;
create trigger trg_guard_post_feature_flag before insert on public.posts for each row execute function private.guard_platform_feature_flag();
drop trigger if exists trg_guard_reel_feature_flag on public.reels;
create trigger trg_guard_reel_feature_flag before insert on public.reels for each row execute function private.guard_platform_feature_flag();