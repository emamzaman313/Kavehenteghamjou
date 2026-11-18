# کاوه انتقامجو | Kaveh Avenger

محصول مستقل ارتباطی و شبکه اجتماعی با کلاینت وب و اپلیکیشن بومی Android؛ بدون وابستگی به حساب تلگرام، MTProto یا سرورهای تلگرام.

## فناوری و اتصال

- Android: Kotlin، Jetpack Compose و Material 3؛ شناسه بسته com.kaveh.avenger، حداقل SDK 26، هدف/کامپایل SDK 36.
- Web: Next.js، React و TypeScript.
- Backend مشترک: Supabase Auth، PostgreSQL، RLS، Realtime و Private Storage.
- Supabase Project Ref: slwzjufipavuwcbwoyro.
- Bucket فایل خصوصی: user-files با سقف سخت 50,000,000 بایت.

## وضعیت واقعی در ۱۸ نوامبر ۲۰۲۶

- **Backend:** پروژه فعال است؛ ۲۶ جدول عمومی از ۲۶ جدول دارای RLS، تعداد ۶۸ Policy و Bucket خصوصی با سقف ۵۰٬۰۰۰٬۰۰۰ بایت در ممیزی Read-only تأیید شد. در بازبینی فعلی Auth users، profiles، messages و file_assets همگی صفر بودند.
- **Web:** نصب قفل‌شده وابستگی‌ها، TypeScript، ESLint، Vitest و Next.js Production Build روی شاخه اصلاح احراز هویت موفق شدند. Vitest هشت تست را پاس کرد؛ ESLint بدون خطا و با ۹ هشدار بود.
- **Google OAuth وب:** هنوز آماده استفاده نیست. پیکربندی Production وب به پروژه صحیح Supabase اشاره می‌کند، اما تنظیم زنده Auth نشان می‌دهد external.google=false. بنابراین ورود واقعی تا فعال‌سازی Provider در Supabase و ثبت OAuth credentials در Google Cloud ممکن نیست.
- **Android:** کد ورود native، چت، Realtime و فایل در سورس وجود دارد؛ چند قابلیت پیام‌رسانی/اجتماعی پیشرفته هنوز ناقص‌اند. Buildهای Debug تاریخی در CI گزارش شده‌اند، اما Release امضاشده، Google OAuth واقعی و آزمون روی گوشی فیزیکی تأیید نشده‌اند.
- **انتقال فایل Android:** پیاده‌سازی فعلی کل فایل را در حافظه Buffer می‌کند؛ WorkManager، upload resumable و پیشرفت بایت‌به‌بایت کامل نیستند.
- **امنیت وابستگی‌ها:** npm audit در زنجیره توسعه ۱۶ هشدار High گزارش می‌کند که از جمله از picomatch <=4.0.7 ناشی می‌شوند. نسخه اصلاح‌شده‌ای در npm registry مشاهده نشد؛ downgrade عمده Vitest راه‌حل قابل‌قبولی نیست.

گزارش کامل و تاریخچه شواهد در docs/implementation-status.md نگهداری می‌شود. وضعیت اجرایی قابلیت‌ها در docs/roadmap.md و معماری در docs/architecture.md آمده است.

## ساختار

- android/app/ — کلاینت بومی Android
- web/ — نسخه وب Next.js
- supabase/ — Migrationهای موجود و توصیف Backend
- docs/ — معماری، OAuth، انتشار و شواهد تست
- .github/workflows/ — CI وب/اندروید، آزمون دوحسابی و Android Release

## اجرای وب

در web/ فایل .env.example را به .env.local کپی و فقط متغیرهای عمومی Supabase را مقداردهی کنید؛ سپس npm ci، npm run typecheck، npm run lint، npm test و npm run build را اجرا کنید.

## ساخت Android

Android Studio، JDK سازگار با Gradle، Android SDK 36 و local.properties خصوصی لازم است. مسیر ورود Google و انتشار در این راهنماهاست:

- docs/google-auth-setup.md
- docs/android-release-signing.md

هیچ Google Client Secret، Supabase Service Role/Secret Key یا Keystore نباید در Git، مرورگر یا APK قرار گیرد. فایل local.properties و Keystore نباید Commit شوند.

## موارد تأییدنشده

ورود واقعی Google تا فعال‌سازی Provider، تست دوحسابی Web/Android، تست RLS با حساب‌های مستقل، Release signing، نصب روی دستگاه فیزیکی، انتقال resumable و Push notification هنوز تأیید نشده‌اند. صفحه یا کلاس موجود به‌تنهایی معیار تکمیل قابلیت نیست.
