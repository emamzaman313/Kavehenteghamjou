# Snapshot of the live Supabase project

Read-only inspection performed 2026-11-18 against project `slwzjufipavuwcbwoyro` (region `ap-northeast-1`). This file is an observation record, not an executable migration and not a database backup.

## Verified counts

- Project state: `ACTIVE_HEALTHY`
- PostgreSQL: 17.12
- Public base tables: 26
- Public base tables with RLS enabled: 26
- Public RLS policies: 68
- Grants on public tables to `anon`: 0
- Auth users / profiles / posts / messages / file assets / Storage objects: 0 / 0 / 0 / 0 / 0 / 0
- Auth user creation trigger: `private.handle_new_user()` is installed
- Realtime publication tables: `conversation_members`, `messages`, `notifications`, `posts`
- Storage bucket `user-files`: private, `file_size_limit=50000000`, no MIME allowlist

## Public tables

`badges`, `channel_spaces`, `chat_topics`, `comments`, `conversation_members`, `conversations`, `device_tokens`, `direct_conversation_pairs`, `file_assets`, `follows`, `group_spaces`, `message_attachments`, `messages`, `notifications`, `post_media`, `post_reactions`, `posts`, `profiles`, `rank_levels`, `reports`, `saved_items`, `stories`, `story_views`, `user_badges`, `user_rank_state`, `user_settings`.

## Migration ledger observed remotely

| Version | Name | Present in local repository |
|---|---|---|
| 20261118082218 | kaveh_foundation_schema | No — archived early draft is not a deployable replacement |
| 20261118082313 | kaveh_message_edit_permissions | No |
| 20261118083706 | kaveh_rls_policy_hardening | No |
| 20261118084046 | kaveh_membership_and_privilege_hardening | No |
| 20261118084455 | kaveh_direct_conversation_rpc | Yes |
| 20261118085149 | kaveh_direct_pair_visibility_and_index | Yes |
| 20261118090155 | kaveh_hide_privileged_direct_conversation_rpc | Yes |
| 20261118091018 | kaveh_shared_file_read_access | Yes |
| 20261118124842 | kaveh_conversation_last_message_at_trigger | Yes |
| 20261118131339 | kaveh_realtime_conversation_read_receipts | Yes |

The first four migrations are missing from the repository. `archive/initial_schema_draft_NOT_FOR_DEPLOY.sql` contains an early schema and policy draft and is explicitly not safe to replay: live policies have since been hardened and the direct-pair table and later changes are absent. Do not run it against the live project. A reproducible baseline still needs a reviewed schema export and a fresh-project replay test.

## Advisor results at inspection time

- Security Advisor: `lints=[]` (rechecked 2026-11-18).
- Health Advisor: `lints=[]` (rechecked 2026-11-18).
- Performance Advisor: 33 unused-index INFO notices (expected before workload exists) and one WARN for multiple permissive SELECT policies on `public.file_assets` (`files_select_own` + `files_select_shared`). The warning is documented; no index or policy was removed.
- `anon` table grants: 0; `anon` column grants: 0.

## Chat and file authorization checks

- `messages` SELECT requires `private.is_conversation_member(conversation_id)`.
- `messages` INSERT requires `sender_id = auth.uid()` and conversation membership; sender identity cannot be set to another user through the table grant.
- `conversation_members` read access is limited to the member or other members of the same conversation; member updates are limited to the caller's own row, with column-level grants for read cursor/preferences only.
- `message_attachments` SELECT requires conversation membership; INSERT requires the caller to own the message and file asset.
- `file_assets` insert policy enforces owner path and `byte_size <= 50000000`; shared reads are checked by `private.can_read_file_asset`.
- Storage bucket `user-files` remains private with a 50,000,000-byte limit. No file objects exist yet.

No database DDL or data mutation was performed during this stage's audit.
