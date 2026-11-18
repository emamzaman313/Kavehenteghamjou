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

**Important:** the live migration ledger is authoritative. The first four original SQL bodies have not yet been exported into this repository. An early local SQL draft is archived at `supabase/archive/initial_schema_draft_NOT_FOR_DEPLOY.sql` and is explicitly non-deployable because it predates the final RLS and privilege fixes.

Do not run `supabase db reset` or deploy the archived draft. Before a clean-room deployment, export a canonical schema/migration set from the live project using Supabase CLI `db pull` in an environment linked to this project, review the generated diff, and test it against a disposable database.

The latest read-receipt migration only adds `public.conversation_members` to the `supabase_realtime` publication if it is not already present. It does not disable RLS or modify user data.

The shared access-code feature stores only a bcrypt hash in `public.site_access_settings`; the live-only `20261118190529` initialization inserted the requested default code hash without committing the plaintext value. The `site_access_admins`, `site_access_attempts`, and `site_access_settings` tables are RLS-enabled, have no direct grants for `anon` or `authenticated`, and are accessed by the `access-code-login` Edge Function using the service role. Do not copy a plaintext code into a repository migration.
