alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
check (target_type = any (array['user','message','post','comment','group','channel','file','reel']::text[]));
