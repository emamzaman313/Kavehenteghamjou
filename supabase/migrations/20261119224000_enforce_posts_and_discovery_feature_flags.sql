drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select
using (
  author_id=(select auth.uid())
  or (
    coalesce((select enabled from public.platform_feature_flags where key='posts'),true)
    and (
      (visibility='public' and coalesce((select enabled from public.platform_feature_flags where key='social_discovery'),true))
      or
      (visibility='followers' and exists (
        select 1 from public.follows f
        where f.follower_id=(select auth.uid())
          and f.following_id=posts.author_id
          and f.status='accepted'
      ))
    )
  )
);
drop policy if exists reels_select_visible on public.reels;
create policy reels_select_visible on public.reels for select
using (
  author_id=(select auth.uid())
  or (
    coalesce((select enabled from public.platform_feature_flags where key='reels'),true)
    and (
      (visibility='public' and coalesce((select enabled from public.platform_feature_flags where key='social_discovery'),true))
      or
      (visibility='followers' and exists (
        select 1 from public.follows f
        where f.follower_id=(select auth.uid())
          and f.following_id=reels.author_id
          and f.status='accepted'
      ))
    )
  )
);