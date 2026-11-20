# راه‌اندازی ورود Google

جریان برنامه از Android Credential Manager برای دریافت ID Token استفاده می‌کند؛ WebView یا ورود با شماره تلفن تلگرام وجود ندارد.

## Google Cloud

1. Google Cloud project بسازید و Google Auth Platform را پیکربندی کنید.
2. OAuth Client نوع **Web application** بسازید؛ Client ID وب در اپ Android برای `setServerClientId` استفاده می‌شود. در بخش Authorized redirect URIs مقدار دقیق `https://slwzjufipavuwcbwoyro.supabase.co/auth/v1/callback` را ثبت کنید.
3. OAuth Client نوع **Android** بسازید و package name `com.kaveh.avenger` را ثبت کنید.
4. SHA-1 گواهی debug و release را جداگانه ثبت کنید. در زمان انتشار باید SHA-1 واقعی امضای Release هم افزوده شود.
5. Scopeهای `openid`, `email`, `profile` را فعال کنید.

## Supabase Dashboard

در مسیر Authentication → Sign In / Providers → Google:

- Google provider را فعال کنید.
- Web Client ID را در Client ID و Web Client Secret را در فیلد Secret وارد کنید.
- اگر چند Client ID دارید، Web Client ID را ابتدا و Android Client ID را نیز به فهرست مجاز اضافه کنید.
- Save کنید.

Client Secret صرفاً در Dashboard/Supabase نگهداری می‌شود و نباید در Android یا Git قرار بگیرد.

## نشانی‌های بازگشت مجاز در Supabase

در Authentication → URL Configuration، نشانی سایت و callback را در Redirect URLs قرار دهید:

- `https://kaveh-avenger.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback` (فقط برای توسعه محلی)

Site URL را روی `https://kaveh-avenger.vercel.app` تنظیم کنید.

## Android

`local.properties`:

```properties
SUPABASE_URL=https://slwzjufipavuwcbwoyro.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
```

فقط Publishable key در اپ client استفاده می‌شود. هرگز `service_role` یا `sb_secret_...` را قرار ندهید.

## GitHub Actions

برای اینکه APK ساخته‌شده در CI ورود Google را هم داشته باشد، در مخزن GitHub مسیر **Settings → Secrets and variables → Actions → Variables** یک Repository variable با نام دقیق `GOOGLE_WEB_CLIENT_ID` و مقدار Web OAuth Client ID بسازید. این شناسه محرمانه نیست؛ **Web Client Secret** را در این بخش یا در اپ قرار ندهید و فقط در Supabase Dashboard نگه دارید.

اگر این متغیر تنظیم نشود، Android CI همچنان می‌تواند APK بسازد، اما در گزارش اجرا هشدار می‌دهد و Google Sign-in در APK پیکربندی نخواهد شد.

## الگوریتم nonce

برنامه یک nonce تصادفی تولید می‌کند، SHA-256 hex آن را به Credential Manager می‌دهد و nonce خام را برای `signInWithIdToken` به Supabase می‌فرستد. این دو مقدار باید با هم جفت باشند.

## تست پذیرش

- ورود کاربر جدید: Supabase user و پروفایل خودکار ایجاد شود.
- ورود مجدد: همان UUID داخلی برگردد.
- ID Token نامعتبر/منقضی رد شود.
- تغییر شبکه و Refresh نشست تست شود.
- Sign out نشست را پاک کند.


## وضعیت ممیزی ۱۸ نوامبر ۲۰۲۶

- در آخرین اجرای Android CI، متغیر Repository با نام دقیق `GOOGLE_WEB_CLIENT_ID` خالی بود؛ Workflow هشدار داد که Google Sign-in در APK ساخته‌شده پیکربندی نشده است.
- Supabase URL محیط Production در Vercel با پروژه `slwzjufipavuwcbwoyro` برابر است؛ اختلافی که در گزارش قدیمی دیده می‌شد در مقدار فعلی Production وجود ندارد.
- Google Provider در Supabase Dashboard از اتصال فعلی قابل مشاهده یا تغییر نبود؛ بنابراین فعال‌بودن Provider و وجود Client Secret معتبر هنوز تأیید نشده است.
- تست واقعی Google OAuth در Web و Android انجام نشده است. تست‌های فعلی فقط رفتار پیام خطا و الگوریتم nonce را پوشش می‌دهند.
- مرجع CI Android: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44326092783
