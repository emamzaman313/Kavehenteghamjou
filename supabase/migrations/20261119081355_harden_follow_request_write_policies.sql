-- Remove older permissive policies that would OR-bypass the new
-- pending-only insert and accept-only update restrictions.
drop policy if exists follows_insert on public.follows;
drop policy if exists follows_update on public.follows;
