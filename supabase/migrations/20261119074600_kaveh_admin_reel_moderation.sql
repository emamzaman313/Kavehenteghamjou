-- Allow audited moderation of reported reels.
ALTER TABLE public.admin_audit_logs
  DROP CONSTRAINT IF EXISTS admin_audit_logs_action_check,
  ADD CONSTRAINT admin_audit_logs_action_check
    CHECK (action = ANY (ARRAY[
      'moderate_post','delete_post','delete_reel','warn_user','ban_user','unban_user',
      'set_admin_role','remove_admin_role','review_report','appearance_publish','appearance_rollback'
    ]::text[])),
  DROP CONSTRAINT IF EXISTS admin_audit_logs_target_type_check,
  ADD CONSTRAINT admin_audit_logs_target_type_check
    CHECK (target_type = ANY (ARRAY['post','reel','user','report','appearance']::text[]));
