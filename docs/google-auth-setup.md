# راه‌اندازی ورود Google

جریان برنامه از Android Credential Manager برای دریافت ID Token استفاده می‌کند؛ WebView یا ورود با شماره تلفن تلگرام وجود ندارد.

## Google Cloud

1. Google Cloud project بسازید و Google Auth Platform را پیکربندی کنید.
2. OAuth Client نوع **Web application** بسازید؛ Client ID وب در اپ Android برای `setServerClientId` استفاده می‌شود.
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

## Android

`local.properties`:

```properties
SUPABASE_URL=https://slwzjufipavuwcbwoyro.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
```

فقط Publishable key در اپ client استفاده می‌شود. هرگز `service_role` یا `sb_secret_...` را قرار ندهید.

## الگوریتم nonce

برنامه یک nonce تصادفی تولید می‌کند، SHA-256 hex آن را به Credential Manager می‌دهد و nonce خام را برای `signInWithIdToken` به Supabase می‌فرستد. این دو مقدار باید با هم جفت باشند.

## تست پذیرش

- ورود کاربر جدید: Supabase user و پروفایل خودکار ایجاد شود.
- ورود مجدد: همان UUID داخلی برگردد.
- ID Token نامعتبر/منقضی رد شود.
- تغییر شبکه و Refresh نشست تست شود.
- Sign out نشست را پاک کند.
