# Supabase migration source status

The live project `slwzjufipavuwcbwoyro` currently has these applied migration records:

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

**Important:** the live Supabase migration ledger was verified, but the first four original SQL bodies have not yet been exported into this directory. An early local SQL draft was moved to `supabase/archive/` and explicitly marked non-deployable because it predates the final RLS and privilege fixes. Do not run `supabase db reset` or deploy the archived draft. Before a clean-room deployment, export a canonical schema/migration set from the live project using Supabase CLI `db pull` in an environment with the project linked, review the generated diff, and test it against an empty disposable database.
