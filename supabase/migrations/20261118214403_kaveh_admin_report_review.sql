-- Add audited report review support to the privileged administration workflow.
alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_action_check
  check (action in ('moderate_post', 'delete_post', 'warn_user', 'ban_user', 'unban_user', 'set_admin_role', 'remove_admin_role', 'review_report'));
alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_target_type_check;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_target_type_check
  check (target_type in ('post', 'user', 'report'));
