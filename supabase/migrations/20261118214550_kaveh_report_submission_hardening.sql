-- Enforce report input limits and prevent duplicate active reports by the same reporter.
alter table public.reports
  add constraint reports_reason_length_check
  check (char_length(btrim(reason)) between 3 and 120);
alter table public.reports
  add constraint reports_details_length_check
  check (details is null or char_length(details) <= 500);
create unique index if not exists reports_one_open_per_reporter_target_idx
  on public.reports (reporter_id, target_type, target_id)
  where status in ('open', 'reviewing');
create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);
