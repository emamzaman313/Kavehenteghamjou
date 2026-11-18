create policy site_access_settings_service_role on public.site_access_settings
  for all to service_role using (true) with check (true);
create policy site_access_admins_service_role on public.site_access_admins
  for all to service_role using (true) with check (true);
create policy site_access_attempts_service_role on public.site_access_attempts
  for all to service_role using (true) with check (true);
create index if not exists site_access_settings_updated_by_idx
  on public.site_access_settings (updated_by);
