# وضعیت پیاده‌سازی و آزمون

تاریخ: ۱۸ نوامبر ۲۰۲۶ — به‌روزرسانی CI، چت و خروجی‌های Build

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

## Build و آزمون — GitHub Actions

- Web CI در Run شماره `44315394232` روی commit `3e957a99264e12eec162ad94bee65f8bfc5bf428` موفق شد: نصب وابستگی‌های قفل‌شده، TypeScript، ESLint، Vitest، Next.js Production Build و Upload Artifact همگی موفق‌اند.
- Android CI در Run شماره `44316617068` روی commit `8278aaf748a2c96d8576a0529de088c5fe24a209` موفق شد: JDK 21، Android SDK 36، Gradle 9.5.0، Unit Tests، Assemble Debug APK، Bundle Debug AAB و Upload Artifact همگی موفق‌اند.
- Security checks در Run شماره `44316617112` موفق شد. در اجرای جدیدتر، Secret scanning نیز موفق بوده؛ Dependency audit هنوز در حال اجراست.
- APK و AAB واقعی از Artifact شماره `14432552632` استخراج و صحت ZIP/نوع فایل بررسی شد. SHA-256 فایل APK: `f5f9bc57e7504031db32623d1ee497465753682527d116728f7a133b40816bc1`.
- Web build از Artifact شماره `14432456595` استخراج و ZIP آن بدون خطا بررسی شد.
- اجرای جدیدتر Android روی commit `b40007478fb6e405d9421bbba74d38e31fde7b01` پس از موفقیت Unit Tests، در زمان ثبت این گزارش در مرحله Assemble بود؛ این اجرا جایگزین موفقیت Build قبلی اعلام نشده است.
- تست واقعی OAuth با Provider فعال، Realtime بین دو حساب مستقل، RLS با JWTهای مستقل، upload/download end-to-end در دو کلاینت و تست روی دستگاه فیزیکی هنوز انجام نشده‌اند.

## اندروید

- نسخه Kotlin/Jetpack Compose حفظ شده و چت به Supabase متصل است: فهرست گفتگوها، تاریخچه پیام، ارسال پیام، Realtime، read cursor و صفحه‌بندی پیام‌های قدیمی.
- پیوست فایل خصوصی و دریافت امن از Storage به مسیر چت اضافه شده است؛ decode پاسخ insert نیز با آرایه PostgREST سازگار شده است.
- Unit Tests و ساخت Debug APK/AAB در CI موفق شده‌اند. فایل APK خروجی CI قابل نصب به‌عنوان Debug build است؛ روی دستگاه فیزیکی هنوز تست نشده است.
- Gradle Wrapper رسمی در Workflow تولید و در شاخه main ذخیره شده است. نسخه‌های Build تأییدشده: JDK 21، Gradle 9.5.0، Android SDK 36.
- آپلود فعلی Android هنوز فایل را در حافظه ByteArray نگه می‌دارد؛ برای فایل‌های بزرگ، streaming/resumable و progress بایت‌به‌بایت باقی است.
- Google Sign-in، session restore و چت end-to-end روی دستگاه واقعی هنوز با حساب واقعی آزمایش نشده‌اند.

## برند

لوگوی اصلی در فایل‌های قابل دسترسی workspace نبود؛ هیچ لوگو یا آیکون جایگزینی ساخته نشده است. PWA manifest وب بدون آیکون رسمی اضافه شده و PWA کامل/قابل نصب اعلام نمی‌شود.

## GitHub و استقرار

- مخزن اصلی فعال: `https://github.com/emamzaman313/Kavehenteghamjou`؛ شاخه `main`.
- آخرین commit مشاهده‌شده هنگام این گزارش: `735c6d2e58dfc228931be2065197acc8f898a1ed`.
- Commitهای جدید شامل صفحه‌بندی چت Android، پیوست و دانلود امن، بارگذاری پیوست‌های پیام‌های قدیمی، اصلاح decode پاسخ PostgREST و مستندسازی وضعیت Realtime هستند.
- Web Production deployment در Vercel با وضعیت READY روی commit `3e957a99264e12eec162ad94bee65f8bfc5bf428` وجود دارد: `https://kaveh-avenger.vercel.app`. هنوز تأیید نشده که deployment روی آخرین commit فعلی main قرار دارد.
- تلاش برای اتصال مجدد GitHub integration از طریق Vercel با خطای نیاز به نصب GitHub Integration مواجه شد؛ ایجاد پروژه جدید انجام نشد و پروژه موجود حذف یا جایگزین نشد.
- CI و Artifactها:
  - Web: `https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44315394232`
  - Android: `https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44316617068`
  - Security: `https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44316617112`
- گزارش آزمون جزئی در `docs/test-report-stage-2.md` ثبت شده است.
