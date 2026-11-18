# کاوه انتقامجو | Kaveh Avenger

محصول مستقل وب و اندروید برای ارتباط، گفت‌وگو، اشتراک‌گذاری فایل و تعامل اجتماعی. این محصول به حساب تلگرام، MTProto یا سرورهای تلگرام وابسته نیست.

## فناوری‌ها

- Android: Kotlin، Jetpack Compose و Material 3؛ حداقل SDK برابر 26 و Target/Compile SDK برابر 36.
- Web: Next.js، React و TypeScript.
- Identity: Google Credential Manager در Android؛ در وب ورود ایمیلی با لینک یک‌بارمصرف PKCE و ورود مهمان با کد دسترسی مشترک.
- Backend: یک پروژه مشترک Supabase شامل Auth، PostgreSQL، RLS، Realtime و Storage خصوصی.
- محدودیت هر فایل: دقیقاً `50,000,000` بایت.

## مخزن

- مخزن رسمی: https://github.com/emamzaman313/Kavehenteghamjou
- شاخه مجاز: `main`
- آخرین Commit کد بررسی‌شده: `12a51d754bb45ddf7197e2b7d8d271bc001180de`
- ساختار: `android/`، `web/`، `supabase/`، `docs/` و `.github/workflows/`.

## وضعیت واقعی فعلی

### Backend
پروژه Supabase با Ref برابر `slwzjufipavuwcbwoyro` فعال است. پروژه فعال است و اکنون ۲۹ جدول عمومی دارد که هر ۲۹ مورد RLS فعال دارند؛ ۷۱ Policy عمومی و ۱۳ Migration در Remote Ledger ثبت شده است. در بررسی فعلی ۳ کاربر Auth و ۳ پروفایل وجود دارد. Bucket `user-files` خصوصی و سقف هر فایل ۵۰٬۰۰۰٬۰۰۰ بایت است. سه Migration مربوط به ورود با کد دسترسی نیز به Production اعمال شده‌اند.

### Web
نسخه وب در `web/` دارای صفحه ورود، فید، گفتگو، فایل‌ها، اکتشاف، پروفایل، اعلان‌ها و تنظیمات است. Deployment فعلی Production: https://kaveh-avenger.vercel.app اتصال Supabase از کلید Publishable و نشست کاربر استفاده می‌کند. ورود OAuth/PKCE در سورس وجود دارد و مدیریت خطای Provider/شبکه و callback به‌روزرسانی و تست شده است؛ اما Google Provider در Supabase و OAuth Client واقعی هنوز باید توسط مالک سرویس تأیید/تنظیم شود. Web CI در Commit مربوط به تغییرات وب موفق شده است: TypeScript، ESLint، ۱۰ تست و Next.js production build. ۹ هشدار lint در کدهای موجود باقی است.

### Android
پوسته پنج‌بخشی و کد بومی ورود Google Credential Manager، nonce، پیام‌رسانی، Realtime و آپلود فایل وجود دارد. مدیریت پیام‌های خطای ورود Google به‌روزرسانی شده و تست شده است. Android CI روی Commit فعلی موفق شده و Debug APK/AAB ساخته است. با این حال:
- متغیر GitHub به نام `GOOGLE_WEB_CLIENT_ID` در اجرای CI خالی بوده؛ ورود Google در APK ساخته‌شده فعال نیست.
- اکتشاف و پروفایل هنوز Placeholder هستند؛ تب انتشار فعلاً صفحه آپلود فایل را باز می‌کند.
- آپلود Android فایل را در حافظه Buffer می‌کند؛ WorkManager، stream/resumable upload و پیشرفت بایت‌به‌بایت تکمیل نشده‌اند.
- APK/AAB فعلی Debug هستند، Release signing انجام نشده و روی گوشی واقعی آزمایش نشده‌اند.

### لینک‌های آزمون
- Web CI: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44325901682
- Android CI: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44326092783
- Security checks: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44326093245
- مستندات وضعیت تفصیلی: [docs/implementation-status.md](docs/implementation-status.md)

## راه‌اندازی محلی

### Web
در پوشه `web/` فایل `.env.example` را به `.env.local` کپی کنید و URL واقعی Supabase و Publishable Key را از پنل مالک وارد کنید. سپس:
```bash
cd web
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

### Android
Android Studio، JDK 21 و Android SDK 36 لازم است. `local.properties.example` را به `local.properties` کپی کنید و مقادیر Supabase URL، Publishable Key و Google Web Client ID را در محیط محلی امن وارد کنید. Service Role Key، Google Client Secret و keystore خصوصی نباید در برنامه یا مخزن قرار گیرند.

## انتشار

خروجی CI فعلی Android از نوع Debug است. انتشار Release نیازمند keystore دائمی مالک و چهار GitHub Secret مستندشده در [docs/android-release-signing.md](docs/android-release-signing.md) است. تست دوحسابی واقعی نیازمند دو حساب اختصاصی Supabase و Secrets مستندشده در [docs/chat-e2e-setup.md](docs/chat-e2e-setup.md) است.

هیچ قابلیت آزمایش‌نشده‌ای به‌عنوان آماده انتشار معرفی نمی‌شود. برای جزئیات محدودیت‌ها، گام‌های باقی‌مانده و شواهد زنده به `docs/implementation-status.md` و `docs/roadmap.md` مراجعه کنید.
