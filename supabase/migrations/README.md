# Supabase migration source status

Live project: `slwzjufipavuwcbwoyro`

The following versions were read from the live Supabase migration ledger. Filenames in this repository are aligned to the recorded remote versions.

| Version | Name | SQL source in this repository |
|---|---|---|
| `20261118082218` | `kaveh_foundation_schema` | Not yet exported |
| `20261118082313` | `kaveh_message_edit_permissions` | Not yet exported |
| `20261118083706` | `kaveh_rls_policy_hardening` | Not yet exported |
| `20261118084046` | `kaveh_membership_and_privilege_hardening` | Not yet exported |
| `20261118084455` | `kaveh_direct_conversation_rpc` | Included |
| `20261118085149` | `kaveh_direct_pair_visibility_and_index` | Included |
| `20261118090155` | `kaveh_hide_privileged_direct_conversation_rpc` | Included |
| `20261118091018` | `kaveh_shared_file_read_access` | Included |
| `20261118124842` | `kaveh_conversation_last_message_at_trigger` | Included |
| `20261118131339` | `kaveh_realtime_conversation_read_receipts` | Included |
| `20261118190325` | `kaveh_shared_access_code` | Included |
| `20261118190529` | `kaveh_shared_access_code_live_init` | Live-only one-time initialization; intentionally no plaintext code in Git |
| `20261118191056` | `kaveh_access_code_service_policies` | Included |
| `20261118195400` | `kaveh_post_media_attachments` | Included |
| `20261118195723` | `kaveh_post_attachment_author_index` | Included |
| `20261118212549` | `kaveh_admin_audit_log` | Included (`20261118212549_kaveh_admin_audit_log.sql`) |
| `20261118212800` | `kaveh_admin_rbac_roles` | Included (`20261118212800_kaveh_admin_rbac_roles.sql`) |
| `20261118213526` | `kaveh_user_moderation_audit` | Included (`20261118213526_kaveh_user_moderation_audit.sql`) |
| `20261118214059` | `kaveh_admin_role_management` | Included (`20261118214059_kaveh_admin_role_management.sql`) |
| `20261118214403` | `kaveh_admin_report_review` | Included (`20261118214403_kaveh_admin_report_review.sql`) |
| `20261118214550` | `kaveh_report_submission_hardening` | Included (`20261118214550_kaveh_report_submission_hardening.sql`) |

**Important:** the live migration ledger is authoritative. The first four original SQL bodies have not yet been exported into this repository. An early local SQL draft is archived at `supabase/archive/initial_schema_draft_NOT_FOR_DEPLOY.sql` and is explicitly non-deployable because it predates the final RLS and privilege fixes.

Do not run `supabase db reset` or deploy the archived draft. Before a clean-room deployment, export a canonical schema/migration set from the live project using Supabase CLI `db pull` in an environment linked to this project, review the generated diff, and test it against a disposable database.

The latest read-receipt migration only adds `public.conversation_members` to the `supabase_realtime` publication if it is not already present. It does not disable RLS or modify user data.

The shared access-code feature stores only a bcrypt hash in `public.site_access_settings`; the live-only `20261118190529` initialization inserted the requested default code hash without committing the plaintext value. The `site_access_admins`, `site_access_attempts`, and `site_access_settings` tables are RLS-enabled, have no direct grants for `anon` or `authenticated`, and are accessed by the `access-code-login` Edge Function using the service role. Do not copy a plaintext code into a repository migration.


## Post media publishing

The live project now has a dedicated public Storage bucket, `post-media`, for media that users explicitly attach to public posts. Uploads are limited to 50 MB and stored under the authenticated user's UUID prefix. The original private cloud file is not made public: selecting a cloud file copies its bytes into this dedicated public-post bucket, and only that copy is shared. The `public.post_attachments` table has RLS enabled, explicit authenticated-role grants, and policies that require ownership on insert/delete and visibility of the parent post on read.

The shared access-code feature was initially disabled because the default `123456` is unsafe. It is now enabled with a newly generated random six-character code; only its bcrypt hash is stored in the live database. The plaintext invite code is intentionally not committed to Git.


## Administrative audit log

Migration `20261118212549_kaveh_admin_audit_log` adds `public.admin_audit_logs` for server-side records of post moderation and deletion. RLS is enabled, and direct table privileges are revoked from `anon` and `authenticated`; the Edge Function uses the service role. The `admin-console` function writes a `started` event before a privileged post action and marks it `succeeded` or `failed` afterward. The audit log intentionally has no client-facing RLS policy; it is not directly readable from browser or Android clients.


## Administrative roles

Migration `20261118212800_kaveh_admin_rbac_roles` adds the `role` column to the existing server-only `site_access_admins` allowlist. Supported roles are `owner`, `admin`, `moderator`, and `support`. The single pre-existing trusted admin was promoted to `owner`; newly inserted admins default to `admin`. The `admin-console` Edge Function enforces role-specific moderation permissions and exposes the latest 100 audit events only to `owner`/`admin`; the web admin panel displays this history. `access-code-login` restricts guest access-code settings to `owner` and `admin`. Role changes are not exposed to client-side direct table access.


## User moderation

Migration `20261118213526_kaveh_user_moderation_audit` extends the existing audit constraints to allow `warn_user`, `ban_user`, and `unban_user` events with `target_type='user'`. Existing post audit rows are preserved. The `admin-console` Edge Function lists Auth users server-side for owner/admin only, protects all accounts in `site_access_admins` and the acting administrator from moderation, and uses Auth Admin `updateUserById` with a bounded set of ban durations. Warnings and ban/unban events are written to the in-app `notifications` table and recorded in `admin_audit_logs`.

A ban prevents new sign-ins and refreshes while active. An already-issued access JWT can remain usable until its expiry; this is not an instant global session revocation mechanism. The web admin panel shows this caveat before moderation actions.


## Owner-managed administrator roles

Migration `20261118214059_kaveh_admin_role_management` extends the audit action constraint for `set_admin_role` and `remove_admin_role`. Only an existing `owner` can assign `admin`, `moderator`, or `support` roles to existing Auth users or revoke those roles. The `owner` role itself cannot be assigned, changed, or removed through this endpoint, and the acting owner cannot change their own role. All role changes are audited and send an in-app notification to the affected user. The web panel exposes these controls only when the server confirms `can_manage_admins=true`.


## User-submitted reports and moderation queue

Migration `20261118214403_kaveh_admin_report_review` expands privileged audit events for report review and permits `target_type='report'`. The `admin-console` Edge Function lists the 100 latest reports for owner/admin/moderator and allows transitions to `reviewing`, `resolved`, or `rejected`. Final decisions create an in-app notification for the reporter and every status change is audited.

Migration `20261118214550_kaveh_report_submission_hardening` enforces report reason length (3–120 characters), optional details length (maximum 500), and one active report per reporter/target pair. The feed UI lets authenticated users report posts; RLS continues to restrict direct report reads to the reporter and inserts to rows whose `reporter_id` matches `auth.uid()`. Administrative reads and updates are performed only by the service-role Edge Function.
