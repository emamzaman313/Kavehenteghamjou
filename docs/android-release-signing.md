# Android Release Signing

The repository builds Debug packages in the normal Android CI. A Play-ready Release package must be signed with a stable private keystore owned and backed up by the project owner. Never commit the keystore or passwords.

## 1. Create or select the permanent upload keystore

If this is the first Play release, create a keystore and keep its backup in a secure offline location. Do not generate a new key for every release.

```bash
keytool -genkeypair -v \
  -keystore kaveh-release.jks \
  -alias kaveh-upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

Record the keystore password, key alias, and key password in a password manager. If the app is already published, use the existing upload key or the official Play App Signing key-reset process; do not replace it casually.

## 2. Add GitHub Actions secrets

In GitHub: Settings → Secrets and variables → Actions → Secrets, add:

- `ANDROID_KEYSTORE_BASE64`: Base64 encoding of the complete `kaveh-release.jks` file. Linux/macOS: `base64 -w 0 kaveh-release.jks` (on macOS use `base64 kaveh-release.jks | tr -d '\\n'`).
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- `ANDROID_KEY_ALIAS`: `kaveh-upload` (or the alias you chose).
- `ANDROID_KEY_PASSWORD`: key password.

Do not paste passwords or the Base64 keystore into chat, source files, issues, or commit history.

## 3. Configure Google Sign-in

In Settings → Secrets and variables → Actions → Variables, add repository variable `GOOGLE_WEB_CLIENT_ID` with the Google OAuth **Web application Client ID**. This is an identifier, not a secret.

The Google provider must also be enabled in Supabase Authentication → Sign In / Providers → Google, with the matching Web Client ID and the Web Client Secret entered only in the Supabase Dashboard. Add the Android OAuth client using package `com.kaveh.avenger` and the SHA-1 fingerprint of the actual Release/upload certificate. The Android Client ID is not a substitute for the Web Client ID used by Credential Manager.

## 4. Build and verify

Run Actions → Android Release → Run workflow, or push a version tag such as `v0.1.0`. The workflow:

- refuses to build a Release if any signing secret is missing;
- checks that the keystore and alias can be opened;
- runs Android unit tests;
- builds `assembleRelease` and `bundleRelease`;
- verifies the APK and AAB signatures;
- publishes APK, AAB, and SHA-256 checksums as a 90-day workflow artifact.

A successful workflow proves package compilation and signature verification, not a full device/OAuth/chat acceptance test. Keep the signing key backed up permanently.


## وضعیت Release در ممیزی ۱۸ نوامبر ۲۰۲۶

- Android CI روی Commit `d204f71253c129770dc69436a4373ffd7e46c05c` موفق شد و فقط Debug APK/AAB تولید کرد.
- Artifact: `14437042579` — https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44326092783
- این Artifact Release نیست؛ signing دائمی مالک، اجرای Android Release workflow، بررسی امضای Release و نصب روی دستگاه واقعی هنوز انجام نشده‌اند.
- در همان اجرای CI، `GOOGLE_WEB_CLIENT_ID` خالی بود. حتی پس از ثبت keystore secrets نیز باید Web OAuth Client ID و Google Provider جداگانه تنظیم شوند.
- وضعیت کلید/گذرواژهٔ مالک را از روی مخزن حدس نزنید و هرگز آن‌ها را در چت درخواست/منتشر نکنید.
