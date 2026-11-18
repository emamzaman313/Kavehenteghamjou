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
- Realtime publication شامل `conversation_members`, `messages`, `notifications`, `posts` است.
- RPC `public.create_direct_conversation(p_other_user_id uuid)` موجود و SECURITY INVOKER است؛ منطق داخلی در schema خصوصی است.
- Security Advisor: `lints=[]`.
- Health Advisor: بدون finding.
- دسترسی مستقیم table/column برای نقش `anon`: صفر.
- Performance Advisor: ۳۳ unused-index INFO و یک WARN به‌علت دو SELECT policy مجازکننده در `file_assets` (مالک و فایل اشتراکی). هیچ policy یا index بدون بررسی حذف نشد.

## وضعیت Migrationها

- Remote ledger در بازبینی زنده ۱۰ migration دارد؛ دو migration جدیدتر `20261118124842 kaveh_conversation_last_message_at_trigger` و `20261118131339 kaveh_realtime_conversation_read_receipts` نیز در ledger ثبت‌اند.
- چهار migration اول در مخزن محلی موجود نیستند: foundation schema، message edit permissions، RLS hardening، membership/privilege hardening.
- شش migration آخر در `supabase/migrations/` وجود دارند.
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

- Web CI جدید در Run شماره `44317894080` روی commit `e7cf84ce6e0302a629d054c362999910bf9861c1` موفق شد: نصب وابستگی‌های قفل‌شده، TypeScript، ESLint، Vitest، Next.js Production Build و Upload Artifact همگی موفق‌اند.
- Android CI جدید در Run شماره `44318216746` روی commit `a3983ef065511b9c260352e3d14aa8b8e05ac68d` موفق شد: JDK 21، Android SDK 36، Gradle 9.5.0، Unit Tests، Assemble Debug APK، Bundle Debug AAB و Upload Artifact همگی موفق‌اند.
- Security checks در Run شماره `44318216809` روی commit `a3983ef065511b9c260352e3d14aa8b8e05ac68d` موفق شد؛ Gitleaks و Dependency audit هر دو موفق‌اند.
- APK و AAB واقعی از Artifact شماره `14433493531` استخراج و صحت هر دو آرشیو با `unzip -t` تأیید شد. اندازه APK برابر 25,546,890 بایت و AAB برابر 21,951,556 بایت است. SHA-256 APK: `2bd55155f6ac84be73966e35afdaab1145ffe843cfef451a2b8060710eb51ac1`؛ SHA-256 AAB: `a47aaeb1e89d2b0f4854cd3c17d77652fae7a0797ca66d12e5b13c51f3bce24b`.
- Web build از Artifact شماره `14432456595` استخراج و ZIP آن بدون خطا بررسی شد.
- هشدار واقعی CI: متغیر Repository با نام `GOOGLE_WEB_CLIENT_ID` تنظیم نشده است؛ بنابراین Google Sign-in در APK ساخته‌شده پیکربندی نشده و ورود Google در این خروجی قابل تأیید نیست. این مقدار باید از Web OAuth Client ID معتبر Google Cloud در GitHub Actions → Variables اضافه شود؛ Client Secret نباید در APK یا GitHub Variables قرار گیرد.
- تست واقعی OAuth با Provider فعال، Realtime بین دو حساب مستقل، RLS با JWTهای مستقل، upload/download end-to-end در دو کلاینت و تست روی دستگاه فیزیکی هنوز انجام نشده‌اند.

## اندروید

- نسخه Kotlin/Jetpack Compose حفظ شده و چت به Supabase متصل است: جست‌وجوی مخاطب و شروع گفتگوی خصوصی با RPC، ارسال/دریافت پیام، Realtime، read cursor، صفحه‌بندی پیام‌های قدیمی، پیش‌نمایش آخرین پیام و شمارنده پیام‌های خوانده‌نشده.
- اشتراک Realtime جداگانه در هر دو کلاینت برای فهرست گفتگوها افزوده شده تا پیام و تغییر read cursor در گفتگوهای غیرفعال نیز فهرست و شمارنده‌ها را تازه کند.
- پیوست فایل خصوصی با سقف ۵۰٬۰۰۰٬۰۰۰ بایت، SHA-256، metadata و دانلود احراز هویت‌شده از Storage اضافه شده است؛ پیوست‌های پیام‌های قدیمی نیز در صفحه‌بندی بازیابی می‌شوند.
- Unit Tests و ساخت Debug APK/AAB در CI موفق شده‌اند. فایل APK خروجی CI قابل نصب به‌عنوان Debug build است؛ روی دستگاه فیزیکی هنوز تست نشده است.
- Gradle Wrapper رسمی در Workflow تولید و در شاخه main ذخیره شده است. نسخه‌های Build تأییدشده: JDK 21، Gradle 9.5.0، Android SDK 36.
- آپلود فعلی Android هنوز فایل را در حافظه ByteArray نگه می‌دارد؛ برای فایل‌های بزرگ، streaming/resumable و progress بایت‌به‌بایت باقی است.
- Google Sign-in، session restore و چت end-to-end روی دستگاه واقعی هنوز با حساب واقعی آزمایش نشده‌اند.

## برند

لوگوی اصلی در فایل‌های قابل دسترسی workspace نبود؛ هیچ لوگو یا آیکون جایگزینی ساخته نشده است. PWA manifest وب بدون آیکون رسمی اضافه شده و PWA کامل/قابل نصب اعلام نمی‌شود.

## GitHub و استقرار

- مخزن اصلی فعال: `https://github.com/emamzaman313/Kavehenteghamjou`؛ شاخه `main`.
- آخرین commit مشاهده‌شده هنگام این گزارش: `a3983ef065511b9c260352e3d14aa8b8e05ac68d`.
- Commitهای جدید شامل صفحه‌بندی چت Android، پیوست و دانلود امن، بارگذاری پیوست‌های پیام‌های قدیمی، اصلاح decode پاسخ PostgREST، Realtime فهرست گفتگوها در هر دو کلاینت و پیش‌نمایش/شمارنده خوانده‌نشده Android هستند.
- Web Production deployment با شناسه `dpl_sDdPfoJTv1WkeNfRJ4AExqrFHANY` روی commit `00203802f841593e231b05e250781644700b76ff` با وضعیت READY و alias اصلی `https://kaveh-avenger.vercel.app` تأیید شده است. پاسخ HTTP صفحه اصلی 200 و سند با `lang=fa` و `dir=rtl` مشاهده شد. این deployment شامل آخرین تغییرات وب در commit `e7cf84c` است؛ commit `a3983ef` پس از آن فقط Android را تغییر داده است.
- تلاش برای اتصال مجدد GitHub integration از طریق Vercel با خطای نیاز به نصب GitHub Integration مواجه شد؛ ایجاد پروژه جدید انجام نشد و پروژه موجود حذف یا جایگزین نشد.
- CI و Artifactها:
  - Web: `https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44317894080`
  - Android: `https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44318216746`
  - Security: `https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44318216809`
- گزارش آزمون جزئی در `docs/test-report-stage-2.md` ثبت شده است.
