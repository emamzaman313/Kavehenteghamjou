# وضعیت پیاده‌سازی و آزمون

تاریخ: ۱۸ نوامبر ۲۰۲۶ — مرحله دوم، بازبینی محیط و ایجاد پایه وب

## وضعیت واقعی Supabase — بازبینی مجدد و تأییدشده

- پروژه `slwzjufipavuwcbwoyro` در وضعیت `ACTIVE_HEALTHY` و region `ap-northeast-1` است؛ PostgreSQL 17.12.
- ۲۶ جدول public وجود دارد و هر ۲۶ جدول RLS فعال دارند.
- ۶۸ سیاست RLS در public وجود دارد.
- هیچ table grant به نقش `anon` داده نشده است.
- در زمان بازبینی، تعداد کاربران Auth، پروفایل‌ها، پست‌ها، پیام‌ها و فایل‌های محصول صفر بود.
- trigger `private.handle_new_user()` روی `auth.users` نصب است و پس از ثبت‌نام، پروفایل و تنظیمات و state رتبه را می‌سازد.
- bucket `user-files` خصوصی و سقف واقعی آن `50,000,000` بایت است؛ MIME allowlist ندارد.
- Realtime publication شامل `messages`, `notifications`, `posts` است.
- RPC `public.create_direct_conversation(p_other_user_id uuid)` موجود و SECURITY INVOKER است؛ منطق داخلی در schema خصوصی است.
- Security Advisor: `lints=[]`.
- Performance Advisor: چند unused-index INFO و یک WARN به‌علت دو SELECT policy مجازکننده در `file_assets` (مالک و فایل اشتراکی). این هشدار مستند شده و بدون تست دسترسی دوکاربره دستکاری نشد.

## وضعیت Migrationها

- Remote ledger دارای ۸ migration است.
- چهار migration اول در مخزن محلی موجود نیستند: foundation schema، message edit permissions، RLS hardening، membership/privilege hardening.
- چهار migration آخر در `supabase/migrations/` وجود دارند.
- فایل `initial_schema_draft_NOT_FOR_DEPLOY.sql` صرفاً draft قدیمی است و قابل اجرای مجدد نیست. برای محیط جدید، باید baseline نهایی از schema/policies زنده استخراج و روی پروژهٔ خالی آزمایش شود.
- در این مرحله هیچ DDL یا داده‌ای در Supabase تغییر داده نشد.

## وب — سورس ایجادشده

در `web/` یک Next.js App Router + TypeScript + React app ایجاد شده است.

کدهای متصل به Supabase:
- ورود Google OAuth + PKCE و مسیر callback (برای تست واقعی، Provider و redirect URL باید در داشبورد پیکربندی شوند).
- فید واقعی، انتشار پست متنی، واکنش و دیدگاه.
- ساخت گفتگوی مستقیم از RPC، تاریخچه پیام، ارسال پیام و Supabase Realtime.
- پیوست فایل به پیام، Storage خصوصی، metadata و دانلود با signed URL کوتاه‌عمر.
- فایل‌های من: چندانتخابی، Drag & Drop، سقف دقیق ۵۰٬۰۰۰٬۰۰۰ بایت، نام Unicode، SHA-256 به‌صورت streaming و signed download.
- جست‌وجوی پروفایل، follow، ویرایش پروفایل، نمایش rank/badges، اعلان‌ها و تنظیمات.
- رابط فارسی RTL و تم روشن/تیره.

مواردی که هنوز در وب کامل نیستند: آپلود resumable/multipart و progress بایت‌به‌بایت، صف retry پایدار، انتشار پست دارای رسانه، گروه/کانال، استوری، تماس، Push، PWA کامل و پنل مدیریت.

## Build و آزمون

- Java 21 و Node.js 22 موجودند.
- Gradle، Android SDK، Android Build Tools و `ANDROID_HOME` در این محیط موجود نیستند؛ APK/AAB ساخته نشده‌اند.
- DNS/دسترسی شبکه از محیط container به `registry.npmjs.org` و `supabase.com` برقرار نبود؛ بنابراین npm dependencies نصب، lockfile تولید، typecheck، lint، Vitest و production build اجرا نشدند.
- تمام ۲۰ فایل TypeScript/TSX با TypeScript `transpileModule` بررسی نحوی شدند: صفر syntax diagnostic.
- ۷ assertion اجرایی با TypeScript transpile شده روی قواعد سقف فایل، پسوند آزاد، نام Unicode، پاک‌سازی جداکننده مسیر و قالب حجم موفق شدند. تست‌های Vitest معادل در `web/tests/format.test.ts` نوشته شده‌اند، اما خود Vitest به‌دلیل نصب‌نبودن وابستگی‌ها اجرا نشد.
- `npm run build` اجرا شد اما به‌علت نبود `node_modules` با `next: not found` متوقف شد. `tsc --noEmit` نیز به‌علت نبود React/Next/Supabase type packages قابل تکمیل نبود.
- تست واقعی OAuth، Realtime بین دو حساب، RLS با JWTهای مستقل، upload/download در مرورگر و تست دستگاه اندروید هنوز اجرا نشده‌اند.

## اندروید

کد قبلی Kotlin/Compose، Google Credential Manager و upload باقی است. این مرحله هنوز تغییرات اندروید و Build آن را تکمیل نکرده است. آپلود اندروید فعلی فایل را در ByteArray buffer می‌کند و برای فایل‌های بزرگ نیاز به بازطراحی stream/resumable دارد.

## برند

لوگوی اصلی در فایل‌های قابل دسترسی workspace نبود؛ هیچ لوگو یا آیکون جایگزینی ساخته نشده است. PWA manifest وب بدون آیکون رسمی اضافه شده و PWA کامل/قابل نصب اعلام نمی‌شود.

## Git

- شاخهٔ کاری `feature/phase-1-foundation` حفظ شد. Commitهای پایه `fa33cd5` و مرحله اول `b9d4438` هستند.
- Commit مرحله دوم وب: `cab5a8c` (`feat(web): add Supabase-connected Kaveh web client`).
- تغییرات مرحله دوم به‌صورت محلی commit شده‌اند. مخزن GitHub قابل خواندن است، اما API write در تلاش قبلی با `403 Resource not accessible by integration` رد شده؛ بنابراین این Commit هنوز Push نشده است. برای Push، اتصال GitHub باید مجوز Contents / Git Data: write داشته باشد.
- گزارش آزمون جزئی در `docs/test-report-stage-2.md` ثبت شده است.
