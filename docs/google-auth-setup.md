# راه‌اندازی ورود Google

Web و Android به همان پروژه Supabase متصل‌اند. Web از OAuth + PKCE استفاده می‌کند؛ Android از Credential Manager و Google ID Token. هیچ‌کدام به Telegram یا WebView وابسته نیستند.

## Project و URLهای تأییدشده

- Supabase Project Ref: slwzjufipavuwcbwoyro
- Project URL: https://slwzjufipavuwcbwoyro.supabase.co
- Google callback: https://slwzjufipavuwcbwoyro.supabase.co/auth/v1/callback
- دامنه وب: https://kaveh-avenger.vercel.app
- Supabase Redirect URL وب: https://kaveh-avenger.vercel.app/auth/callback
- Local development: http://localhost:3000/auth/callback

مقدار واقعی NEXT_PUBLIC_SUPABASE_URL از Vercel Production بازخوانی شد و با Ref تطبیق داشت. host کوتاه‌شده در تصویر در متغیر Production فعلی ثبت نیست. Browser فقط Publishable key دارد؛ Service Role یا Secret key در کلاینت قرار نمی‌گیرد.

## وضعیت زنده Provider — ۱۸ نوامبر ۲۰۲۶

**Google Provider غیرفعال است.**

endpoint زنده Supabase Auth برای همین Project Ref مقدار external.google=false برگرداند. این نتیجه علت خطای Unsupported provider: provider is not enabled را اثبات می‌کند. کد Web و Android پیام خطا را به‌شکل قابل‌فهم نمایش می‌دهد، اما Provider باید توسط مالک در Dashboard فعال شود؛ تا آن زمان Google login موفق نخواهد شد.

## Google Cloud

1. Google Auth Platform را برای پروژه مالک پیکربندی کنید.
2. OAuth Client نوع Web application بسازید.
3. Origin دامنه وب kaveh-avenger.vercel.app را در صورت نیاز در Authorized JavaScript origins ثبت کنید.
4. در Authorized redirect URIs دقیقاً https://slwzjufipavuwcbwoyro.supabase.co/auth/v1/callback را وارد کنید.
5. Web Client ID و Secret را ایجاد کنید؛ Secret فقط در Supabase Dashboard وارد می‌شود.
6. Android OAuth Client جداگانه با package com.kaveh.avenger بسازید.
7. SHA-1 واقعی Debug و Release را ثبت کنید؛ Release SHA-1 تا زمان استفاده از keystore دائمی قابل اثبات نیست.
8. scopeهای openid, email و profile را مجاز کنید.

## Supabase Dashboard

در Authentication → Sign In / Providers → Google:

- Google را Enable کنید.
- Web Client ID و Web Client Secret را در فیلدهای همان Provider وارد کنید.
- Authorized Client IDs را مطابق UI پروژه تنظیم کنید؛ Web Client ID و Android Client IDهای معتبر را اضافه کنید.
- Save کنید؛ سپس دوباره Auth settings را بررسی کنید و تأیید کنید external.google=true شده باشد.

در Authentication → URL Configuration:

- Site URL: https://kaveh-avenger.vercel.app
- Redirect URLs:
  - https://kaveh-avenger.vercel.app/auth/callback
  - http://localhost:3000/auth/callback (فقط توسعه)

## Android

local.properties یا محیط امن CI:

    SUPABASE_URL=https://slwzjufipavuwcbwoyro.supabase.co
    SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
    GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com

GOOGLE_WEB_CLIENT_ID باید Web OAuth Client ID باشد و به setServerClientId داده شود. Client Secret نباید داخل APK یا Git قرار گیرد.

## GitHub Actions

در Settings → Secrets and variables → Actions → Variables یک Repository variable با نام GOOGLE_WEB_CLIENT_ID بسازید. مقدار آن Web OAuth Client ID است و Secret محسوب نمی‌شود؛ Client Secret فقط در Supabase Dashboard نگهداری شود.

## nonce اندروید

nonce خام تصادفی تولید می‌شود، SHA-256 آن به Google Credential Manager داده می‌شود و nonce خام همراه ID Token به Supabase Auth ارسال می‌شود تا در سمت سرور اعتبارسنجی شود.

## تست پذیرش واقعی

بعد از فعال‌سازی Provider: ورود کاربر جدید، UUID ثابت در ورود مجدد، session restore پس از refresh، refresh token، خروج، ورود مجدد، لغو Google prompt و قطع/وصل شبکه را در Web و Android اجرا و ثبت کنید. Workflow ایمیل/رمز عبور اثبات Google login نیست.
