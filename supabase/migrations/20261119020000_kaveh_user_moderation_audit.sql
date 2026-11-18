-- Extend the existing privileged audit trail to cover user warnings and bans.
-- Existing audit rows are preserved.
alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_action_check
  check (action in ('moderate_post', 'delete_post', 'warn_user', 'ban_user', 'unban_user'));

alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_target_type_check;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_target_type_check
  check (target_type in ('post', 'user'));

create index if not exists admin_audit_logs_target_created_idx
  on public.admin_audit_logs (target_type, target_id, created_at desc);
