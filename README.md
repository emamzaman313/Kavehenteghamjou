# کاوه انتقامجو | Kaveh Avenger

اپلیکیشن مستقل اندرویدی برای پیام‌رسانی، اشتراک‌گذاری فایل و شبکه اجتماعی.

> این محصول هیچ وابستگی‌ای به حساب تلگرام، MTProto یا سرورهای تلگرام ندارد. سورس رسمی Telegram Android صرفاً مرجع مهندسی است و هیچ کد Telegram در این مخزن کپی نشده است.

## فناوری‌ها

- Android: Kotlin + Jetpack Compose + Material 3
- Identity: Google Credential Manager → Supabase Auth
- Backend: Supabase PostgreSQL + RLS + Realtime + private Storage
- Minimum SDK: 26
- Per-file server limit: `50,000,000` bytes

## ساختار

- `android/app/` — اپلیکیشن Android
- `supabase/` — توصیف backend و ledger مهاجرت‌های اعمال‌شده
- `docs/` — ممیزی Telegram، معماری، وضعیت، تست و نقشه راه

## وضعیت فعلی

زیرساخت Supabase واقعی فعال است: ۲۶ جدول، ۶۸ RLS policy، Storage خصوصی با سقف ۵۰٬۰۰۰٬۰۰۰ بایت، Realtime پایه و RPC ایجاد گفتگوی مستقیم. اپ Android دارای کد ورود Google native، پوستهٔ پنج‌تب و کد انتخاب/آپلود فایل است؛ هنوز Build/دستگاه تست نشده و قابلیت‌های کامل پیام‌رسان/شبکه اجتماعی آمادهٔ انتشار نیستند.

گزارش‌ها: `docs/telegram-source-audit.md`, `docs/feature-inventory.md`, `docs/architecture.md`, `docs/implementation-status.md`, `docs/roadmap.md`, `docs/google-auth-setup.md`.

## راه‌اندازی محلی

۱. Android Studio و JDK 17 نصب کنید؛ Android SDK 36 را فراهم کنید. ۲. فایل `local.properties.example` را به `local.properties` کپی کنید. ۳. Supabase Publishable Key و Google Web Client ID را وارد کنید. ۴. Provider Google را مطابق `docs/google-auth-setup.md` در Google Cloud و Supabase تنظیم کنید. ۵. Sync و Build بگیرید.

از Service Role Key، Google Client Secret یا Keystore در برنامهٔ Android استفاده نکنید. `local.properties` در `.gitignore` است.

## هویت بصری

نام «کاوه انتقامجو» حفظ شده است. آیکون یا لوگوی جایگزین ساخته نشده؛ تصویر اصلی‌ای که در گفت‌وگوی قبلی ارائه شده در فایل‌های قابل‌دسترسی workspace فعلی موجود نبود، بنابراین دارایی برند جایگزین نشده است.

## نسخه وب

نسخه وب مستقل در `web/` ساخته شده و از همان Supabase پروژه اندروید استفاده می‌کند. راهنمای نصب و OAuth در `web/README.md` و وضعیت اتصال قابلیت‌ها در `docs/web-app.md` قرار دارد. برای اجرا، `web/.env.example` را به `.env.local` کپی و Publishable Key را تنظیم کنید؛ هیچ Service Role Key نباید در مرورگر قرار بگیرد.

## بازبینی مرحله دوم

وضعیت واقعی دیتابیس و اختلاف Migrationهای Remote با فایل‌های محلی در `supabase/remote-state-snapshot.md` ثبت شده است. فایل Snapshot صرفاً مستند است و نباید اجرا شود. تست syntax فایل‌های TS/TSX انجام شده، اما به‌دلیل نبود دسترسی npm registry، dependency install و production build هنوز انجام نشده است.
