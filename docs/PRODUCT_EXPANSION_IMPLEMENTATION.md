# Kaveh Avenger — Product Expansion Implementation Plan

Status date: 2026-11-19  
Repository: `emamzaman313/Kavehenteghamjou`  
Production web: `https://kaveh-avenger.vercel.app`  
Supabase project: `slwzjufipavuwcbwoyro`

This document separates shipped foundations from features that still require implementation, infrastructure, or security review. A screen, table, or migration is not considered a shipped feature until its complete user journey is implemented and tested on web and Android.

## Product direction

Kaveh is an independent Persian-first social communication platform combining private messaging, social publishing, communities, short-form media, personal cloud files, reputation, and centrally governed administration. Preserve the existing product name, icon, RTL/Persian experience, dark/light themes, and independent identity. Do not present it as a Telegram/Instagram clone.

## Verified existing foundations

- Next.js web application and Kotlin/Jetpack Compose Android application.
- Supabase Auth, Postgres, Realtime, Storage, RLS, and Edge Functions.
- Email OTP/password onboarding and managed access-code guest account flow.
- Feed, post publishing, comments/reactions, profiles, discovery/following, notifications.
- Direct/group conversation foundations, message pagination/read cursors, file attachments.
- Private `user-files` storage and metadata with 50,000,000-byte file limit.
- Reels/social hub and audio library foundations.
- Community discovery/join requests, moderation/reporting, support tickets.
- Kaveh World foundations: missions, events, rank levels, badges and reward flows.
- Admin RBAC/audit, feature flags, appearance versioning, global audio controls.

Existing UI is already RTL and has a dark/light theme and a premium visual refresh. The next UI pass should improve consistency, information hierarchy, empty/loading/error states, keyboard/screen-reader accessibility, and small-screen behavior rather than stacking more arbitrary CSS overrides.

## Delivery rules

1. Implement one end-to-end vertical slice at a time across UI, server/database, authorization, and tests.
2. No mock buttons, fake counters, demo-only data, or UI that claims an integration is active when it is not.
3. Keep service-role credentials server-side only. Never place secrets in web bundles, Android resources, or Git.
4. Use RLS and server-side authorization for every user-owned resource. Admin privileges must come from server-controlled role data, never user-editable metadata.
5. Every schema change must have a reviewed migration, least-privilege grants, RLS policies, and verification queries.
6. Preserve existing data and migration history. Do not run destructive resets or the archived initial schema draft.
7. Do not deploy experimental security-sensitive features directly to production. Use a branch, CI, preview deployment, review, then explicit promotion.
8. For each feature, require web and Android parity or clearly label a platform as not yet supported.

## Feature inventory and implementation requirements

### A. Kaveh World — extend existing foundation
- Season lifecycle, configurable season dates, season rewards and archived leaderboards.
- Anti-abuse scoring with server-side event validation, idempotency, rate limits and anomaly detection.
- Team/clan creation, invitations, roles, team challenges and team rankings.
- User-facing progress history, reward claim receipts and clear eligibility rules.
- Admin controls for season configuration, mission templates, event publishing and reward review.
- Tests: duplicate reward claims, forged client events, simultaneous claims, expired seasons, blocked/muted users.

### B. Communities — extend discovery and join-request foundation
- Community home, searchable directory, category/topic tags and member directory.
- Community roles, rules, moderation queue, announcements, pinned content and scheduled events.
- Membership approvals, invitation links with expiry/revocation, bans and appeals.
- Community chat channels with membership-scoped RLS and notification preferences.
- Tests: private community leakage, role escalation, revoked invitations, removed member access.

### C. Creator Studio and Reels — extend existing social hub
- Draft/publish workflow, upload progress, retry/cancel, media validation and thumbnail generation.
- Trim/crop/cover selection, captions, Persian subtitle workflow, licensed audio selection and attribution.
- Scheduled publishing, creator analytics, content collections and collaborative credits.
- Feed/reels ranking with explicit user controls and anti-spam safeguards.
- Moderation, copyright/takedown workflow, reporting and age/safety controls.
- Tests: unauthorized media reads, interrupted uploads, scheduled publish retries, deleted media references.

### D. Persian AI assistant — new integration
- Start with opt-in tools: speech-to-text, translation, post drafting and user-triggered summaries.
- Add semantic search only after a privacy-preserving indexing design and explicit opt-in.
- Keep private message/file content out of model requests unless the user explicitly invokes the feature and sees what will be shared.
- Store provider keys only in server-side Vercel/Supabase secrets; apply per-user quotas, rate limits, abuse controls and cost budgets.
- Provide provider abstraction and graceful disabled state until credentials and a privacy policy are configured.
- Do not train on private content or claim end-to-end privacy for content sent to an external AI provider.

### E. Secure private conversations — new security-sensitive feature
- Use a reviewed, interoperable end-to-end encryption protocol and maintained cryptographic libraries; do not invent cryptography.
- Define device identity, key verification, multi-device enrollment, key rotation, recovery and lost-device behavior.
- Encrypt message bodies and attachments client-side; server stores ciphertext and minimal routing metadata.
- Explain limits: metadata, backups, push previews, reporting, and account recovery can affect confidentiality.
- Threat model, independent security review, protocol test vectors, cross-device tests and recovery tests are release blockers.
- Do not market E2EE until the entire protocol and client implementation are audited.

### F. Live audio rooms — new real-time media infrastructure
- Select and provision a WebRTC SFU provider or operate a reviewed SFU; Supabase Realtime alone is not a media transport.
- Room lifecycle, host/co-host/speaker/listener roles, hand-raise, moderation, mute/kick, capacity and reconnect.
- Consent and recording controls; recording disabled by default.
- Network-quality telemetry, regional routing, cost limits and abuse reporting.
- Provider credentials and webhook secrets remain server-side. Web and Android interoperability is required.

### G. Personal cloud vault — extend private file foundation
- Folders/tags, search, previews, quotas, usage breakdown and resumable uploads.
- Expiring share links with optional password, revocation, recipient scope and download audit.
- Version history and restore with explicit retention limits.
- Keep private originals private; publishing media must create a deliberate public derivative with separate authorization.
- Malware scanning/content validation and signed URLs with short expiry.
- Tests: owner isolation, revoked links, expired links, quota races, orphan cleanup.

### H. Admin command center — consolidate existing admin features
- Unified overview for health, moderation queues, reports, user lifecycle, feature flags, appearance versions, audio and support.
- RBAC matrix with owner/admin/moderator/support least privilege and immutable audit records.
- Safe preview/publish/rollback for appearance and feature configuration.
- Maintenance mode and kill switches for expensive or unsafe features.
- Every destructive action requires confirmation, reason, audit event and recovery path.
- No client-side service-role access; no direct browser writes to privileged tables.

### I. UI and design system
- Keep the existing Kaveh identity and signature dark/light palettes.
- Define shared tokens for spacing, typography, surfaces, borders, elevation, motion and responsive breakpoints.
- Standardize loading skeletons, empty states, inline validation, permission errors and retry states.
- Mobile-first responsive navigation, touch targets, safe areas, reduced-motion and keyboard navigation.
- Persian typography, RTL layout, number/date formatting and accessible contrast.
- Add visual regression coverage for login, feed, chat, reels, world, files, profile and admin.

## Release gates

A feature is complete only when:
- its migrations are present and match the live migration ledger;
- RLS, grants, storage policies, server authorization and abuse limits are reviewed;
- web and Android flows are implemented or platform limitations are explicit;
- unit/integration/E2E tests pass, including negative authorization tests;
- CI passes on the exact commit intended for release;
- preview deployment is manually exercised with at least two test accounts and two devices;
- operational logging, rollback and support documentation exist.

## External dependencies / owner actions

These capabilities cannot safely be activated by code changes alone:
- AI: selected provider, API credential, budget, privacy disclosure and consent design.
- Live audio: SFU/provider account, credentials, regions and expected concurrency budget.
- E2EE: protocol decision, device/key recovery model and independent security review.
- Push delivery: valid FCM/APNs configuration and real-device permission testing.
- Production release: Android signing key and store account configuration.

Never commit any of these secrets or ask the user to paste them into source files.

## Execution order

1. Stabilize and test current auth, messaging, media upload and admin permissions.
2. Finish Kaveh World seasons/teams and Community lifecycle end-to-end.
3. Finish Creator Studio/Reels publishing and moderation.
4. Finish Personal Cloud Vault sharing/versioning.
5. Consolidate Admin Command Center and design-system/accessibility pass.
6. Integrate opt-in AI assistant after provider/privacy setup.
7. Build live audio rooms after SFU selection and cost controls.
8. Design, implement, independently review and then release E2EE.

This order prioritizes usable, testable product value and avoids shipping expensive or security-sensitive placeholders.


## 2026-11-19 implementation update — private cloud vault

The existing private vault is now extended across web and Android without changing the production schema:

- Web: searchable file names, MIME-based filters (image/video/document/other), used-storage summary, and clearer file-type icons.
- Android: owner-filtered metadata listing, filename search, and authenticated downloads saved through Android's system document picker.
- Both clients continue to use the existing private `user-files` bucket and `file_assets` RLS policies. No public URL or service-role credential is introduced.
- Validation: Web CI passed on commit `e09005d5` (TypeScript, ESLint, unit tests, production build). Android CI exposed two Kotlin compile errors in the first vault iteration; those source errors were corrected afterward. A fresh Android CI result for the corrected latest commit is still required.


## 2026-11-19 implementation update — Android Kaveh World navigation parity

- The Android Kaveh World screen now has horizontally scrollable tabs for missions, events, leaderboard, honors, and (for authorized admins only) management controls.
- The Android presentation now matches the existing web information architecture more closely; data, mission rewards, and event participation continue to use the existing Supabase tables and server-side triggers.
- Validation on implementation commit `c9913723`: Web CI passed; Android unit tests and debug APK/AAB assembly and artifact upload passed.
- Security checks: secret scanning and the web dependency audit passed. GitHub Dependency Review remains blocked because repository Dependency Graph is disabled. Enable it at the repository Security Analysis settings before treating that check as complete.
- No production database migration, production data change, secret modification, or Vercel production promotion was performed.

## Remaining Kaveh World work — not yet shipped

- Seasons and archived seasonal leaderboards.
- Team/clan creation, membership roles, invitations, team challenges, and server-calculated team scores.
- Server-enforced anti-abuse controls, rate limits, and race-safe reward accounting.

These require a dedicated migration, verified RLS policies, server-side authorization and database tests. They are deliberately not represented as active UI features until that backend slice is implemented and tested.


## 2026-11-19 implementation update — Android moderation triage

- Added a searchable report inbox to the Android admin console, with live filters and counts for all, open, in-review, resolved, and rejected reports.
- Report target types and review states are displayed in Persian; the existing privileged `admin-console` Edge Function remains the only moderation write path and continues to record audit events and notify report submitters on final decisions.
- The admin navigation row now scrolls horizontally on narrow phones instead of overflowing the viewport.
- Validation on implementation commit `e2bc9166`: Web CI passed; Android unit tests and debug APK/AAB assembly and upload passed. Secret scanning and the web dependency audit passed; Dependency Review remains blocked only because the repository Dependency Graph is disabled.
- No production database migrations, production data changes, secret updates, or Vercel production promotion were performed.


## 2026-11-19 implementation update — Android support inbox triage

- Added search to the Android support center across ticket subject, requester label, category, and ticket ID.
- Added status filters and per-status counts for all, new, in progress, waiting for user, resolved, and closed tickets.
- Added staff-only priority filters and counts for urgent, high, normal, and low priority tickets. Regular users only see their own tickets and do not receive staff priority controls.
- This uses the existing support-ticket RLS and realtime refresh path; no database schema changes were required.
- Validation on implementation commit `6f767804`: Web CI passed (TypeScript, ESLint, unit tests, Next.js production build); Android CI passed (unit tests, debug APK, AAB, artifact upload). Gitleaks and the web dependency audit passed; Dependency Review is unavailable until GitHub Dependency Graph is enabled.
- No production database migrations, production data changes, secret modifications, or Vercel production promotion were performed.


## 2026-11-19 implementation update — cross-platform support inbox triage

- The web and Android support inboxes now provide search across ticket subject, requester label, category, and ticket ID.
- Both clients provide ticket-status filters and counts for new/open, in progress, waiting for the user, resolved, and closed tickets.
- Staff-only priority filters/counts distinguish urgent, high, normal, and low tickets; regular users do not receive staff priority controls and remain scoped to their own support tickets by existing RLS.
- Existing realtime refresh, private support conversations, attachment handling, and server-side ticket creation are retained. No schema change was required.
- Web CI passed on implementation commit `6f767804`; Android CI passed on that same commit. The additional web filter implementation is commit `0766ee07` and its fresh web/Android CI runs are pending at the time of this update.
- No production database migrations, production data changes, secret modifications, or Vercel production promotion were performed.


## 2026-11-19 implementation update — support filter test coverage

- Extracted the web support inbox search/status/priority filtering into a pure helper so the filtering rules are independent of React rendering.
- Added unit tests covering default results, case-insensitive requester/search matching, ticket ID/category lookup, combined status and staff-priority filtering, and the rule that non-staff views ignore staff-only priority filters.
- Validation on implementation commit `71dc450c`: Web CI passed (TypeScript, ESLint, unit tests including the new support filter tests, Next.js production build, artifact upload); Android CI passed (unit tests, debug APK, AAB, artifact upload). Secret scanning and web dependency audit passed; Dependency Review remains blocked only by the disabled repository Dependency Graph setting.
