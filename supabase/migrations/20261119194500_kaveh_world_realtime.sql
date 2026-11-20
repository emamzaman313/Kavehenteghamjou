do $$
declare t text;
begin
 foreach t in array array['daily_missions','mission_progress','platform_events','platform_event_participants','user_rank_state','user_badges'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;