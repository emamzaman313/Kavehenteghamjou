# Android Release Signing

Workflow ساخت APK/AAB نسخه Release در مخزن وجود دارد؛ با این حال هنوز با keystore دائمی مالک اجرا نشده است. Debug package نسخه قابل انتشار محسوب نمی‌شود.

## 1. Keystore دائمی

ابتدا از مالک بپرسید آیا keystore/upload key دائمی قبلی وجود دارد. اگر برنامه قبلاً منتشر شده، همان کلید حفظ شود. ایجاد کلید جدید فقط برای اولین Release و با مجوز مالک انجام شود. پشتیبان رمزگذاری‌شده در محل امن تحت کنترل مالک نگهداری شود.

نمونه فقط برای اولین انتشار و با مجوز مالک:

    keytool -genkeypair -v -keystore kaveh-release.jks -alias kaveh-upload -keyalg RSA -keysize 4096 -validity 10000

## 2. GitHub Actions Secrets

در Settings → Secrets and variables → Actions → Secrets:

- ANDROID_KEYSTORE_BASE64
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

مقادیر یا Base64 کلید را در چت، سورس، issue یا Commit نگذارید.

## 3. Google Sign-in

در Settings → Secrets and variables → Actions → Variables، Repository variable با نام GOOGLE_WEB_CLIENT_ID و مقدار Web OAuth Client ID بسازید.

Google Provider نیز باید در Supabase Authentication → Sign In / Providers → Google فعال شود؛ Web Client ID و Client Secret فقط در Dashboard وارد شوند. Android OAuth Client باید package com.kaveh.avenger و SHA-1 گواهی Release واقعی را داشته باشد.

## 4. اجرای workflow و بررسی امضا

Workflow موجود باید:
- وجود چهار signing Secret را بررسی کند؛
- keystore و alias را باز کند؛
- Unit Testهای Android را اجرا کند؛
- assembleRelease و bundleRelease را بسازد؛
- امضای APK و AAB را تأیید کند؛
- SHA-256 را ثبت و Artifact را ۹۰ روز نگهداری کند.

## 5. گیت فعلی Release — ۱۸ نوامبر ۲۰۲۶

- keystore دائمی مالک: در محیط اجرا در دسترس/تأیید نشده.
- چهار signing Secret: وضعیت تنظیم از ابزار قابل تأیید نبود.
- Repository variable GOOGLE_WEB_CLIENT_ID: از تنظیمات GitHub تأیید نشد؛ گزارش CI قبلی آن را خالی نشان داده بود.
- Supabase Google Provider: endpoint زنده external.google=false.
- Android Release workflow: اجرا نشده.
- Release APK/AAB امضاشده و checksum: تولید نشده.
- نصب روی گوشی فیزیکی و تست Google/Session/Chat/Realtime/File: انجام نشده.

هیچ Debug Artifact یا CI قدیمی نباید به‌عنوان Release معرفی شود. برای تکمیل این موارد، مالک باید کلید دائمی و مقادیر محرمانه را در GitHub Secrets/Supabase Dashboard وارد کند، نه در چت.
