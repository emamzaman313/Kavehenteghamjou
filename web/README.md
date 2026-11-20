# Kaveh Avenger Web

Next.js App Router + TypeScript + React web client. The web app talks directly to the same Supabase project as Android and relies on Postgres RLS for row authorization.

## Local setup

```bash
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from Supabase Dashboard > Connect / API Keys
npm install
npm run dev
```

Open `http://localhost:3000`.

## Google OAuth

In Supabase Dashboard > Authentication > URL Configuration, add the local and production callback URLs, for example:

- `http://localhost:3000/auth/callback`
- `https://YOUR_WEB_DOMAIN/auth/callback`

Enable Google as an Auth provider and configure the Google Web OAuth Client ID and client secret in Supabase. Add the production domain to the Google OAuth authorized redirect configuration using the callback URI displayed by Supabase. Do not put the Google client secret, Supabase `service_role`, or `sb_secret_` key in `.env.local` or any `NEXT_PUBLIC_` variable.

## Scripts

- `npm run dev` — development server
- `npm run typecheck` — TypeScript check
- `npm run lint` — ESLint
- `npm test` — unit tests
- `npm run build` — production build

## Current connected capabilities

- Google OAuth redirect + PKCE callback using Supabase Auth
- Authenticated feed read, text post publishing, reactions and comments
- Direct conversation creation through `create_direct_conversation`
- Message history, sending and Supabase Realtime message updates
- Private file upload up to exactly 50,000,000 bytes, arbitrary file types, Unicode filename metadata, streaming SHA-256 calculation and signed URL download
- Profile editing, server-owned rank/badge display, notifications and user settings

The browser uploader currently uses the standard Supabase Storage upload method; resumable/multipart upload, true byte-level progress, and durable retry queue are not implemented yet. The PWA manifest is present, but installable PWA acceptance is incomplete because the original brand icon is not available in this workspace and no service worker has been added.

Group/channel administration, stories, calls, push delivery and the admin console are not represented as completed features. The existing database does not expose a safe admin role table/policy contract; the web UI intentionally does not grant admin powers from client metadata.
