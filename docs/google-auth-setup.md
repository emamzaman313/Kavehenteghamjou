# راه‌اندازی ورود Google

این راهنما برای اتصال وب و Android به همان پروژه Supabase است. وب از OAuth + PKCE استفاده می‌کند و Android از Google Credential Manager و ID Token؛ هیچ‌یک به Telegram یا WebView وابسته نیستند.

## پروژه و نشانی‌های تأییدشده

- Supabase Project Ref: slwzjufipavuwcbwoyro
- Project URL: https://slwzjufipavuwcbwoyro.supabase.co
- Google callback در Supabase: https://slwzjufipavuwcbwoyro.supabase.co/auth/v1/callback
- دامنه Production وب: https://kaveh-avenger.vercel.app
- Redirect URL وب: https://kaveh-avenger.vercel.app/auth/callback
- توسعه محلی: http://localhost:3000/auth/callback

مقدار واقعی NEXT_PUBLIC_SUPABASE_URL در Vercel Production بازخوانی و با Project Ref تطبیق داده شد؛ مقدار کامل فوق صحیح است. نشانی کوتاه‌شده‌ای که در تصویر دیده شده، در متغیر فعلی Production ثبت نیست. Vercel همچنین NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY را در همان Production به‌عنوان Publishable key دارد؛ هیچ Service Role/Secret key برای Browser استفاده نمی‌شود.

## وضعیت فعلی Provider (ممیزی ۱۸ نوامبر ۲۰۲۶)

**تأییدشده غیرفعال**

در پاسخ زنده endpoint عمومی /auth/v1/settings همین پروژه، مقدار external.google=false دیده شد. این دقیقاً علت قابل‌اثبات خطای Unsupported provider: provider is not enabled است. کد Web اصلاح شده تا پیام قابل‌فهم بدهد، اما فقط Dashboard مالک می‌تواند Provider را فعال کند. تا انجام این تنظیم، ورود واقعی Google موفق نخواهد شد.

## Google Cloud

1. Google Auth Platform را برای پروژه مالک پیکربندی کنید.
2. یک OAuth Client از نوع Web application بسازید.
3. دامنه Production وب kaveh-avenger.vercel.app را در Authorized JavaScript origins در صورت درخواست ثبت کنید.
4. در Authorized redirect URIs دقیقاً این callback را ثبت کنید: https://slwzjufipavuwcbwoyro.supabase.co/auth/v1/callback.
5. Web Client ID و Client Secret را نگه دارید؛ Client Secret فقط به Supabase Dashboard می‌رود.
6. OAuth Client جداگانه از نوع Android بسازید و package name com.kaveh.avenger را ثبت کنید.
7. SHA-1 گواهی Debug و Release واقعی را در Android OAuth Client وارد کنید. SHA-1 Release تا قبل از دریافت keystore پایدار قابل استخراج نیست.
8. Scopeهای openid, email, profile را مجاز کنید.

## Supabase Dashboard

در مسیر Authentication → Sign In / Providers → Google:

- Google را Enable کنید.
- Web OAuth Client ID را در فیلد Client ID وارد کنید.
- Web OAuth Client Secret را در محل Secret وارد کنید.
- در Authorized Client IDs، Web Client ID و Android Client IDهای لازم را اضافه کنید (طبق رابط همان پروژه و نوع client).
- تنظیمات را Save کنید و دوباره Auth settings را بررسی کنید؛ انتظار می‌رود external.google=true باشد.

در Authentication → URL Configuration:

- Site URL: https://kaveh-avenger.vercel.app
- Redirect URLs شامل https://kaveh-avenger.vercel.app/auth/callback و http://localhost:3000/auth/callback (فقط توسعه) باشند.

## Android

در local.properties محلی یا تنظیمات CI:

    SUPABASE_URL=https://slwzjufipavuwcbwoyro.supabase.co
    SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
    GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com

GOOGLE_WEB_CLIENT_ID باید Web OAuth Client ID باشد و در setServerClientId استفاده شود. Google Client Secret نباید در APK یا کد قرار بگیرد.

## GitHub Actions

در مخزن GitHub مسیر Settings → Secrets and variables → Actions → Variables، Repository variable با نام دقیق GOOGLE_WEB_CLIENT_ID و مقدار Web OAuth Client ID بسازید. این مقدار شناسه است، نه Secret. Client Secret را فقط در Supabase Dashboard نگه دارید.

## الگوریتم nonce اندروید

برنامه nonce تصادفی خام ایجاد می‌کند؛ SHA-256 آن را به Credential Manager می‌دهد و nonce خام را همراه ID Token برای Supabase Auth ارسال می‌کند. سرور Supabase ID Token را اعتبارسنجی می‌کند.

## پذیرش نهایی

پس از فعال‌سازی Provider، این مراحل را واقعاً اجرا و ثبت کنید: ورود حساب جدید، همان UUID در ورود مجدد، PKCE callback، حفظ Session پس از Refresh، sign-out، ورود مجدد، قطع شبکه و لغو پنجره Google در Web و Android. Workflow ایمیل/رمز عبور جایگزین تست Google OAuth نیست.
