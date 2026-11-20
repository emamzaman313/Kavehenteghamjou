alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check
check (action = any (array['moderate_post','delete_post','delete_reel','set_audio_track_active','register_audio_track','warn_user','ban_user','unban_user','mute_user','unmute_user','set_admin_role','remove_admin_role','review_report','appearance_publish','appearance_rollback','feature_flag_set']::text[]));
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_target_type_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_target_type_check
check (target_type = any (array['post','reel','audio_track','user','report','appearance','feature_flag']::text[]));