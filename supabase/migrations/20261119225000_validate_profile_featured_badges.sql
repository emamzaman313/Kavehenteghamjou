create or replace function private.validate_profile_featured_badges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.featured_badges is null then
    new.featured_badges := array[]::text[];
  end if;
  if cardinality(new.featured_badges) > 6 then
    raise exception 'profile_featured_badges_limit' using errcode='23514';
  end if;
  if cardinality(new.featured_badges) <> (
    select count(distinct item)::integer from unnest(new.featured_badges) as items(item)
  ) then
    raise exception 'profile_featured_badges_duplicate' using errcode='23514';
  end if;
  if exists (
    select 1
    from unnest(new.featured_badges) as selected(code)
    where not exists (
      select 1 from public.user_badges ub
      where ub.user_id = new.id and ub.badge_code = selected.code
    )
  ) then
    raise exception 'profile_featured_badge_not_earned' using errcode='23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_validate_profile_featured_badges on public.profiles;
create trigger trg_validate_profile_featured_badges
before insert or update of featured_badges on public.profiles
for each row execute function private.validate_profile_featured_badges();
revoke all on function private.validate_profile_featured_badges() from public, anon, authenticated;