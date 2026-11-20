# Stage 4 — Environment and executable-build readiness

Date: 2026-11-18 (UTC)
Branch: `feature/phase-1-foundation`
Starting commit: `7c703dc`

## Executive result

No production web build or Android APK/AAB could be produced in this execution environment. This is an environment/network blocker, not evidence that the application source builds successfully. No application feature, database object, migration, or environment secret was changed.

## Environment inventory

| Item | Observed value | Result |
|---|---|---|
| OS | Debian GNU/Linux 13 (trixie) | Available |
| Architecture | `x86_64` | Available |
| Node.js | `v22.16.0` | Available; suitable major for Next.js 16 |
| npm | `10.9.2` | Available |
| Java runtime | OpenJDK `21.0.12.1` (Debian) | Available |
| Java compiler | `javac 21.0.12.1` | Available |
| Gradle executable | Not found | Blocked |
| Gradle Wrapper | `gradlew` and `gradle/wrapper` absent | Blocked |
| Android SDK | `ANDROID_HOME` and `ANDROID_SDK_ROOT` unset; `sdkmanager` absent | Blocked |
| Disk | 32 GiB filesystem, about 30 GiB free at inspection | Sufficient |
| npm cache | Empty (`npm cache verify`: 0 content entries) | No offline packages |

Java 21 was also exercised through JShell; it reported version `21.0.12.1` and vendor `Debian`.

## Network diagnosis

The configured resolver in `/etc/resolv.conf` is `168.63.129.16`. Name resolution failed for all tested hosts:

- `registry.npmjs.org`
- `registry.npmmirror.com`
- `skimdb.npmjs.com`
- `repo.maven.apache.org`
- `dl.google.com`
- `services.gradle.org`
- `github.com`

`curl -I https://registry.npmjs.org/` returned `curl: (6) Could not resolve host: registry.npmjs.org`.

The actual npm install was attempted with `npm install --no-audit --no-fund` and stopped after 25 seconds. Its npm debug log records repeated `EAI_AGAIN` while fetching `https://registry.npmjs.org/@supabase%2fsupabase-js`.

This is not only an npm-registry hostname issue. TCP connection attempts to DNS resolvers `168.63.129.16:53`, `1.1.1.1:53`, `8.8.8.8:53` and HTTPS endpoints `1.1.1.1:443`, `8.8.8.8:443` were refused (`ConnectionRefusedError: [Errno 111]`). A direct-IP HTTPS attempt also failed with `curl: (7) Failed to connect`. No HTTP(S) proxy variables were configured. The npm mirror therefore cannot help until outbound DNS/network access or a valid proxy is provided.

## Web project inspection

- Existing `web/package.json` was retained unchanged.
- Declared runtime dependencies: `next ^16.0.0`, `react ^19.2.0`, `react-dom ^19.2.0`, `@supabase/supabase-js ^2.57.4`, `@noble/hashes ^1.8.0`, `lucide-react ^0.468.0`.
- Dev dependencies include TypeScript `^5.9.3`, ESLint 9, `eslint-config-next ^16.0.0`, Tailwind CSS 4 and Vitest 4.
- Node 22.16/npm 10.9 meet the expected toolchain baseline for this declared Next 16 app, but package availability and exact peer/dependency resolution could not be checked without registry access.
- No `package-lock.json` exists. It was deliberately not fabricated. `npm install` did not complete, so no valid lockfile or `node_modules` was created.
- `web/.env.local` exists locally and contains only the expected public-prefixed Supabase URL, publishable key and app URL names. Values were not copied into this report or Git. `.gitignore` excludes it. `web/.env.example` is tracked.
- A production `npm run build` cannot run without `next` installed; no successful build is claimed.

## Android project inspection

- The app requests `compileSdk = 36`, `minSdk = 26`, Java source/target compatibility 17, and reads Supabase/Google public configuration from ignored `local.properties`.
- The initial root plugin declaration used Android Gradle Plugin `9.5.1` with Kotlin Compose and serialization plugins `2.4.21`. Official compatibility tables show Kotlin Gradle Plugin `2.4.20–2.4.21` fully supports AGP only through `9.3.1` (and Gradle through `9.7.0`). Android documents AGP `9.3` with minimum Gradle `9.5.0` and Build Tools `36.0.0`. The root Android Gradle Plugin declaration was therefore aligned to `9.3.1`; the Kotlin plugin declarations remain `2.4.21`. The matching Gradle Wrapper cannot be generated here because no Gradle executable or network is available. This compatibility correction has not yet been validated by an actual Android build. See the official [Kotlin Gradle compatibility table](https://kotlinlang.org/docs/gradle-configure-project.html), [AGP compatibility table](https://developer.android.com/build/releases/about-agp), and [AGP 9.3 release notes](https://developer.android.com/build/releases/agp-9-3-0-release-notes).
- No Gradle wrapper, Gradle executable, Android SDK, platform-tools, or Build Tools are present. The local apt package index exposes no install candidate for the Android SDK packages checked.
- Java 21 itself works, but it is not sufficient to build an Android project without Gradle, AGP, SDK platforms/build-tools and dependency artifacts.
- No APK/AAB was produced.

## Branding and UI asset check

A repository-wide search of tracked web public assets and Android resources found no supplied original logo image or icon. The web code currently renders a CSS `BrandMark` with a Persian letter; Android theme comments call its palette provisional. This mark is not the original brand asset and is not represented as such. No replacement logo was generated. Existing app pages/components were inventoried, but visual/browser QA could not be performed without a runnable app and browser session.

## Exact artifacts required from an internet-enabled Linux x86_64 machine

Use a trusted machine with outbound HTTPS, Debian 13 (or compatible Linux x86_64), Node 22.16+, npm 10+, JDK 21, and the same repository branch/commit. Do not send `.env.local`, service-role keys, keystores, signing passwords or other secrets in a source archive.

### Web dependency bundle

From the repository root on that machine:

```bash
cd web
cp .env.example .env.local
# Fill the three NEXT_PUBLIC_* values locally; never commit this file.
npm install --cache .npm-cache --no-audit --no-fund
# Verify that the cache contains everything needed for a clean offline install.
npm ci --cache .npm-cache --offline
npm run typecheck
npm run lint
npm test
npm run build
```

Only if all commands complete, create a transfer archive containing the genuine generated `web/package-lock.json` and populated npm cache `web/.npm-cache/`:

```bash
cd ..
tar -czf kaveh-web-offline-deps-linux-x64-node22.tar.gz \
  web/package-lock.json web/.npm-cache
```

Transfer that archive to this workspace and extract it at the repository root. Then run `cd web && npm ci --cache .npm-cache --offline --no-audit --no-fund`, followed by typecheck/lint/test/build again. This cache-based transfer is intentional: `npm ci` deletes and recreates `node_modules`, so merely transferring `node_modules` and then running `npm ci` would be incorrect. If platform-specific native packages are present, build and test on the target host instead of assuming cross-platform compatibility. The `package-lock.json` must be generated by npm from the actual manifest, not handwritten.

### Android build bundle / recommended path

The most reliable route is to build on the same internet-enabled Linux x86_64 host using JDK 21, Android SDK Platform 36, Android SDK Build Tools 36.0.0, Platform Tools, Gradle 9.5.0 (minimum for AGP 9.3.x), and the repository's exact plugin/dependency coordinates. The machine must resolve Google Maven, Maven Central and the Gradle distribution host. Generate and commit the official Gradle Wrapper using the selected compatible Gradle distribution, then run:

```bash
./gradlew --version
./gradlew :android:app:assembleDebug
./gradlew :android:app:bundleDebug
```

For a release APK/AAB, configure a real signing key securely outside Git and run the appropriate release tasks. Transfer the resulting `app-debug.apk` (and, if created, signed release APK/AAB), Gradle wrapper files and build logs. Do not transfer signing secrets. Do not create a placeholder APK.

## Git and data safety

- Starting branch and commit were verified before work.
- No Supabase SQL, migration, storage policy, or data was changed in this stage.
- No source dependencies were removed and no mock package/lockfile was introduced.
- No environment secret was added to the report or archive.

## Direct build-command outcomes (executed in this workspace)

| Command | Exit | Observed blocker |
|---|---:|---|
| `npm run typecheck` | 1 | TypeScript cannot resolve React, Next, Supabase, Noble Hashes, Vitest and Node type declarations because `node_modules` is absent. |
| `npm run lint` | 127 | `eslint: not found`. |
| `npm test` | 127 | `vitest: not found`. |
| `npm run build` | 127 | `next: not found`. |
| `./gradlew :app:assembleDebug` | 127 | `./gradlew: No such file or directory`. |
| `gradle --version` | 127 | `gradle: command not found`. |

These are setup failures, not application compile/test results. No build artifact was generated.


### Android compatibility correction

The initial `com.android.application` plugin version `9.5.1` was outside the official fully-supported AGP range for Kotlin Gradle Plugin `2.4.21` (maximum AGP `9.3.1`). The root `build.gradle.kts` now pins AGP `9.3.1`; Gradle `9.5.0` is the documented minimum for AGP 9.3. This is a source-level compatibility alignment only. It must still be confirmed by resolving the real plugin artifacts and running the Android build on a connected machine.
