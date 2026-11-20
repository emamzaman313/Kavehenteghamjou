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

The browser uploader supports measured byte-level progress and rollback of orphaned uploads. Resumable/multipart upload and a durable retry queue are not implemented yet. The web app registers a service worker and provides a network-only offline fallback page. For privacy, it does not cache authenticated pages, messages, or user files. The app icon and standalone manifest are included; web push delivery is not provided by the service worker.

Community discovery and join-request moderation are available; full group/channel administration, stories, calls, and browser push delivery remain incomplete. Admin access is checked by server-side functions and role policies, not client metadata alone.
