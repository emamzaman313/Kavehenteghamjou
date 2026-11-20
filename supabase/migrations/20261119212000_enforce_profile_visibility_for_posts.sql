-- Respect profile-level privacy when listing another user's posts.
-- Owners always retain access to their own posts. Other users must be able
-- to see the author's profile, and the post's own visibility still applies.
begin;

drop policy if exists posts_select on public.posts;

create policy posts_select on public.posts
for select to authenticated
using (
  author_id = (select auth.uid())
  or (
    coalesce((select f.enabled from public.platform_feature_flags f where f.key = 'posts'), true)
    and exists (
      select 1
      from public.profiles author_profile
      where author_profile.id = posts.author_id
    )
    and (
      (
        coalesce((select f.enabled from public.platform_feature_flags f where f.key = 'social_discovery'), true)
        and visibility = 'public'
      )
      or (
        visibility = 'followers'
        and exists (
          select 1
          from public.follows f
          where f.follower_id = (select auth.uid())
            and f.following_id = posts.author_id
            and f.status = 'accepted'
        )
      )
    )
  )
);

commit;
