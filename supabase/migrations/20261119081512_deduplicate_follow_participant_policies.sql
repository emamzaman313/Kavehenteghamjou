-- The original participant SELECT and DELETE policies already enforce the
-- same scope. Keep one policy per operation to avoid redundant permissive ORs.
drop policy if exists follows_select_participants on public.follows;
drop policy if exists follows_delete_participant on public.follows;
