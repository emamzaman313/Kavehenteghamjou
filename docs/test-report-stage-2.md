# Stage 2 — Test and build report

Date: 2026-11-18

## Passed in this environment

- Live Supabase read-only inspection: 26/26 public tables have RLS, 68 policies, zero grants to `anon`, private `user-files` bucket with the exact 50,000,000-byte limit, and Realtime publication for `messages`, `posts`, and `notifications`.
- TypeScript/TSX syntax transpilation: 20 source files, zero syntax diagnostics.
- Seven runtime assertions against the transpiled file utility module: exact file-size boundary, reject one byte over, allow arbitrary extension, preserve Persian/emoji filename, neutralize path separators for display, and decimal MB formatting.
- JSON parsing for `package.json`, `tsconfig.json`, and PWA manifest.
- `git diff --check`.

## Blocked / not run

- `npm run build`: blocked because npm dependencies are not installed (`next: not found`). Container DNS resolution to npm registry failed, so packages and a lockfile could not be fetched/generated.
- `tsc --noEmit`: blocked by absent installed React, Next.js, Supabase, and type packages. A temporary strict check with ambient dependency stubs passed, but it is not a substitute for the real package typecheck and is not included in the project.
- Vitest: not run because the Vitest package is not installed. Equivalent pure utility assertions were executed directly using the globally available TypeScript transpiler.
- Android Gradle build: not run because Gradle, Gradle Wrapper, Android SDK and Android Build Tools are unavailable in this container.
- OAuth, browser Realtime, upload/download against real user sessions, two-user RLS denial tests, and device UI tests require a browser/device and configured Google provider credentials; they have not been claimed as passed.

## Outputs

No APK, AAB, or production web build was generated. No deployment was made. No live Supabase schema or data was modified in this stage.
