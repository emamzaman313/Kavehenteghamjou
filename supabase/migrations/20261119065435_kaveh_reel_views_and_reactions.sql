create table if not exists public.reel_views (
  reel_id uuid not null references public.reels(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(reel_id,viewer_id)
);
alter table public.reel_views enable row level security;
create policy reel_views_insert_self on public.reel_views for insert to authenticated with check (viewer_id=(select auth.uid()) and exists(select 1 from public.reels r where r.id=reel_id));
create policy reel_views_select_own_or_author on public.reel_views for select to authenticated using (viewer_id=(select auth.uid()) or exists(select 1 from public.reels r where r.id=reel_id and r.author_id=(select auth.uid())));
grant select,insert on public.reel_views to authenticated;
create or replace function private.increment_reel_views()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  update public.reels set views_count=views_count+1 where id=new.reel_id;
  return new;
end;
$$;
revoke all on function private.increment_reel_views() from public, anon, authenticated;
drop trigger if exists reel_views_increment on public.reel_views;
create trigger reel_views_increment after insert on public.reel_views for each row execute function private.increment_reel_views();
drop policy if exists reel_reactions_insert_self on public.reel_reactions;
create policy reel_reactions_insert_self on public.reel_reactions for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.reels r where r.id=reel_id));
