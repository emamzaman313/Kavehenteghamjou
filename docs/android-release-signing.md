# Android Release Signing

The repository contains a workflow to produce a signed Release APK and AAB. It has **not** yet been executed with the project owner's permanent keystore. A Debug package is not a Play-ready Release.

## 1. Select the permanent owner keystore

First check whether the owner already has a permanent signing/upload key. If the app has been published before, preserve that key and follow the official Play App Signing process. Only create a new key for the first release and with the owner's explicit authorization. Keep an encrypted offline backup in an owner-controlled password manager/backup location. Never commit the keystore or passwords.

Example only for a first release when authorized:

    keytool -genkeypair -v -keystore kaveh-release.jks -alias kaveh-upload -keyalg RSA -keysize 4096 -validity 10000

## 2. Add GitHub Actions secrets

In GitHub: **Settings → Secrets and variables → Actions → Secrets**, add:

- ANDROID_KEYSTORE_BASE64: Base64 encoding of the complete owner keystore.
- ANDROID_KEYSTORE_PASSWORD: keystore password.
- ANDROID_KEY_ALIAS: alias inside the keystore.
- ANDROID_KEY_PASSWORD: private-key password.

Do not paste the values or the Base64 keystore into chat, source files, issues, or commit history.

## 3. Configure Google Sign-in

In **Settings → Secrets and variables → Actions → Variables**, add Repository variable GOOGLE_WEB_CLIENT_ID with the Web OAuth Client ID. The variable is currently a release prerequisite.

The Google provider must be enabled in Supabase Authentication → Sign In / Providers → Google. Enter the Web Client ID and Web Client Secret in Supabase Dashboard only. Add the Android OAuth Client for package com.kaveh.avenger and the SHA-1 fingerprint of the real Release/upload certificate. The Web Client ID is used by Credential Manager as serverClientId.

## 4. Build and verify

Run **Actions → Android Release → Run workflow**, or push an owner-approved version tag. The existing workflow:

- refuses to build if any signing secret is missing;
- validates the keystore and alias;
- runs Android unit tests;
- builds assembleRelease and bundleRelease;
- verifies APK and AAB signatures;
- emits SHA-256 checksums and uploads the APK/AAB artifact for 90 days.

## 5. Current release gate status (18 November 2026)

- Permanent owner keystore: not available to the current execution environment / not verified.
- Four signing secrets: not confirmed configured.
- GitHub Repository variable GOOGLE_WEB_CLIENT_ID: not confirmed configured.
- Supabase Google Provider: live setting currently reports external.google=false.
- Android Release workflow: not executed.
- Signed Release APK/AAB and checksums: not produced.
- Physical-device install, Google login, session, chat, Realtime and file acceptance: not tested.

Therefore no Debug artifact or prior CI run should be described as a Release. Complete the missing owner-controlled setup first, then run the workflow and test on a physical device.
