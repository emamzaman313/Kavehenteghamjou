create index if not exists platform_appearance_created_by_idx
  on public.platform_appearance_versions (created_by)
  where created_by is not null;
