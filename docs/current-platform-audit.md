# ممیزی وضعیت فعلی پلتفرم کاوه انتقامجو

تاریخ ممیزی: ۱۸ نوامبر ۲۰۲۶
مخزن: `emamzaman313/Kavehenteghamjou`، شاخه `main`
Backend: Supabase `slwzjufipavuwcbwoyro`
Web production domain: `https://kaveh-avenger.vercel.app`

این سند بر اساس سورس شاخه main، ساختار زنده دیتابیس، Migration Ledger، Edge Functions، Supabase Advisors، لاگ‌های Auth و تاریخچه Deployment تهیه شده است. وجود کد یا جدول به‌تنهایی به معنی قابلیت Production-tested نیست.

## 1. معماری کشف‌شده

- Web: Next.js 16، React 19، TypeScript، Supabase JS.
- Android: Kotlin، Jetpack Compose، Supabase Kotlin SDK، Google Credential Manager.
- Backend مشترک: Supabase Auth، PostgreSQL 17.12، RLS، Realtime، Storage و دو Edge Function با نام‌های `access-code-login` و `admin-console`.
- Web در Vercel مستقر است؛ Android از همان Supabase استفاده می‌کند.
- مخزن شامل `web/`، `android/`، `supabase/`، `docs/` و GitHub Actions است.

## 2. وضعیت زنده Backend

- وضعیت پروژه: `ACTIVE_HEALTHY`، منطقه `ap-northeast-1`.
- ۳۰ جدول عمومی در ممیزی جاری مشاهده شد و RLS روی هر ۳۰ جدول فعال است.
- جداول و داده‌های واقعی وجود دارند؛ از جمله ۴ پروفایل، ۱ پست، ۱ فایل ثبت‌شده و ۱ دیدگاه. این اطلاعات باید حفظ شوند.
- جدول‌های دامنه شامل کاربران/پروفایل، گفتگوها، اعضا، پیام‌ها، گروه‌ها، کانال‌ها، فایل‌ها، پست‌ها، واکنش‌ها، دیدگاه‌ها، استوری‌ها، اعلان‌ها، گزارش‌ها، نشان‌ها و تنظیمات ورود مهمان است.
- Bucket `user-files` خصوصی با سقف ۵۰٬۰۰۰٬۰۰۰ بایت است.
- Bucket `post-media` عمومی با سقف ۵۰٬۰۰۰٬۰۰۰ بایت است؛ Allowlist نوع MIME تنظیم نشده. عمومی‌بودن فقط برای نسخه‌هایی است که کاربر صراحتاً در پست عمومی منتشر می‌کند، اما باید نوع فایل، اسکن و سیاست دسترسی آن در فاز امنیت رسانه بازبینی شود.
- ۱۵ Migration در Remote Ledger دیده شد. چهار Migration پایه اول در مخزن SQL متناظر ندارند؛ بنابراین اجرای archive draft یا reset دیتابیس ممنوع است. ابتدا باید baseline رسمی و قابل بازسازی از پروژه زنده استخراج و روی دیتابیس آزمایشی بازپخش شود.
- Edge Functionهای `access-code-login` و `admin-console` فعال‌اند.
- Security Advisor یک هشدار دارد: محافظت رمزهای افشاشده در Auth غیرفعال است. این باید در تنظیمات Auth فعال شود.

## 3. وضعیت قابلیت‌ها

| حوزه | وضعیت واقعی مشاهده‌شده | مرحله بعد |
|---|---|---|
| ورود ایمیلی وب | OTP UI، verifyOtp، callback قدیمی و مدیریت خطا در کد | اصلاح قالب Auth میزبانی‌شده و تست واقعی با ایمیل تازه |
| ورود مهمان | Edge Function، حساب مهمان مستقل، هش bcrypt، rate limit و پنل تنظیم کد | E2E و بررسی چرخه عمر/بازیابی |
| خروج از حساب | در نوار کناری، موبایل و تنظیمات وجود دارد | آزمون خروج برای guest و email |
| چت خصوصی وب | ارسال متن، Realtime، read cursor، unread، صفحه‌بندی و پیوست | دوحسابی E2E، typing/presence/reply/edit/delete/search |
| گروه و کانال | جداول و مدل داده موجود؛ رابط مدیریت کامل مشاهده نشد | ساخت/عضویت/نقش‌ها و کنترل سمت سرور |
| فضای فایل خصوصی | آپلود، metadata، SHA-256 و لینک دانلود امضاشده | MIME allowlist، تست مرزی حجم، resumable/progress دقیق |
| انتشار پست وب | متن، تصویر، ویدئو، صوت، فایل و انتخاب از فضای ابری در کد | تست واقعی، پیش‌نمایش بهتر، کنترل audience و امنیت رسانه |
| فید | پست‌های عمومی، واکنش، دیدگاه، لینک و Realtime | صفحه‌بندی/پیشنهاد، منشن، follow و فید شخصی |
| ریلز | پخش ویدئو در پست موجود؛ فید عمودی اختصاصی ویدئو مشاهده نشد | پیاده‌سازی feed عمودی، autoplay فعال و prefetch |
| پروفایل | صفحه وب و جدول profiles موجود | حریم خصوصی، ویرایش کامل و پیوند guest |
| اعلان | جدول و Realtime درون‌برنامه‌ای | Push/Web Push/FCM، ایمیل، زمان‌بندی و پنل ارسال |
| مدیریت | آمار پایه، فهرست محدود کاربران/پست‌ها، moderation ساده و تنظیم کد | RBAC واقعی، audit log، ban/mute/warning، گزارش‌ها و کنترل مرکزی |
| ظاهر و Remote Config | تم روشن/تیره و ترجیح کاربر؛ کنترل مرکزی طراحی مشاهده نشد | نسخه‌بندی تم، بک‌گراند و live preview |
| موسیقی | پخش audio ضمیمه پست؛ مدیریت مرکزی playlist مشاهده نشد | Media/Music Center و مجوزهای نشر |
| Android | ورود و صفحات چت/آپلود فایل؛ Explore/Profile placeholder و انتشار اجتماعی ناقص | هم‌ترازی featureها با وب و تست دستگاه واقعی |

## 4. باگ ورود کد ایمیل — شواهد و اصلاح

لاگ‌های Auth Production در ۱۸ نوامبر:
- درخواست `POST /otp` با وضعیت ۲۰۰ ثبت شده است.
- سپس `POST /verify` با وضعیت ۴۰۳ و کد `otp_expired` ثبت شده است.
- ارسال‌های متعدد در فاصله کوتاه دیده شده و یک درخواست با `429 over_email_send_rate_limit` و پیام محدودیت ۱۶ ثانیه‌ای رد شده است.
- مستندات رسمی Supabase هشدار می‌دهد که پیش‌نمایش/اسکن خودکار `{{ .ConfirmationURL }}` می‌تواند توکن را قبل از کاربر مصرف کند؛ استفاده از `{{ .Token }}` و ورود با verifyOtp راهکار مستند است.

تغییرات کد در این مرحله:
- پیام خطا به‌جای اشاره صرف به لینک، کد و آخرین ایمیل را توضیح می‌دهد.
- cooldown ارسال مجدد به ۳۰ ثانیه افزایش یافته است.
- UI به‌عنوان جریان اصلی، کد شش‌رقمی را درخواست می‌کند.
- قالب OTP-only در `supabase/email-templates/magic_link.html` اضافه شده و راهنمای اعمال آن در `docs/email-otp-configuration.md` است.

**کار باقی‌مانده بیرونی:** قالب میزبانی‌شده باید در Supabase Dashboard → Authentication → Email Templates → Magic Link با فایل مخزن جایگزین و ذخیره شود. ابزار متصل این نشست امکان تغییر مستقیم این تنظیم Auth را ارائه نمی‌کند. تا انجام این کار و ورود واقعی با ایمیل جدید، باگ به‌طور کامل بسته محسوب نمی‌شود.

## 5. خطرها و موانع اصلی

1. قالب Magic Link در Supabase باید به OTP-only تغییر کند تا email prefetch توکن را مصرف نکند.
2. Migrationهای پایه در Git ناقص‌اند؛ خطر بازسازی/استقرار تمیز وجود دارد.
3. Bucket عمومی پست‌ها فاقد MIME allowlist است؛ باید فرمت‌ها و سیاست فایل اجرایی/مشکوک محدود شوند.
4. Auth leaked-password protection خاموش است.
5. پنل مدیریت فعلی RBAC چندنقشی و audit log جامع ندارد؛ Admin مرکزی هنوز فقط بخشی از مدیریت محتوا و ورود مهمان را پوشش می‌دهد.
6. Push، ایمیل اطلاع‌رسانی، تماس صوتی/تصویری، E2EE و سیستم توصیه ریلز کامل نیستند.
7. Android هنوز با تجربه اجتماعی وب هم‌سطح نیست؛ Explore/Profile و Publish بومی ناقص‌اند.
8. CI و Build جای تست واقعی دوحسابی، دستگاه فیزیکی و تحویل ایمیل را نمی‌گیرند.

## 6. نقشه اجرایی پیشنهادی

### فاز A — تثبیت Auth و امنیت پایه
- اعمال قالب OTP-only در Supabase و تست ثبت‌نام/ورود/ارسال مجدد/کد اشتباه/کد قبلی.
- بررسی و فعال‌سازی leaked-password protection.
- بازبینی rate limits، redirect allowlist و مدیریت session.
- تست خروج حساب مهمان و ایمیل.

### فاز B — Backend baseline و امنیت داده
- استخراج schema رسمی و بازسازی Migrationهای مفقود بدون اجرای archive draft.
- تهیه backup/export قبل از DDLهای گسترده.
- بازبینی RLS همه جداول، Storage policies، MIME allowlist و signed URL.
- افزودن audit log و RBAC با مجوزهای server-side.

### فاز C — محصول اجتماعی اصلی
- تکمیل انتشار پست چندرسانه‌ای، preview، فایل ابری، audience، likes/comments/follows.
- ساخت Reels vertical feed و pipeline پردازش ویدئو در صورت فراهم‌بودن سرویس مناسب.
- تکمیل گروه/کانال و مدیریت اعضا.

### فاز D — Admin & Remote Configuration
- داشبورد واقعی با آمار SQL، مدیریت کاربران و moderation.
- appearance editor، media library، theme versioning و feature flags.
- Daily content، notification sender و history.

### فاز E — Messaging & Notifications
- typing/presence، reply/edit/delete، retry و جست‌وجو.
- In-app + Web Push + Android FCM + email و زمان‌بندی.
- گروه و کانال Real-time.

### فاز F — Android parity & release
- تکمیل Explore/Profile/Publish/Reels.
- upload streaming/resumable و WorkManager.
- تست‌های دوحسابی وب/اندروید، تست گوشی واقعی و Release signing.

## 7. معیار پذیرش

هیچ قابلیت تا زمانی که UI، backend، database/storage، authorization، loading/error/retry و تست مثبت/منفی مرتبط را نداشته باشد «تکمیل‌شده» اعلام نمی‌شود. داده‌های موجود حفظ می‌شوند؛ Migration مخرب یا بازنویسی کامل بدون ضرورت فنی انجام نخواهد شد.


## الحاقیه ممیزی زنده — ۱۹ نوامبر ۲۰۲۶

این الحاقیه با خواندن دوباره شاخه `main`، Supabase Production، GitHub Actions و Deployment دامنه اصلی تهیه شد. اعداد این بخش بر داده زنده متکی‌اند و در صورت اختلاف، بر متن قدیمی‌تر همین سند اولویت دارند.

### شواهد زنده
- آخرین Commit شاخه `main`: `79e2794d1f3ddfa5738678eddd1ea63a9a2164b3` با پیام اصلاح API اندروید.
- Supabase: `ACTIVE_HEALTHY`، PostgreSQL 17.12، منطقه `ap-northeast-1`.
- جدول‌های پایه `public`: تعداد ۳۰؛ RLS روشن روی هر ۳۰ جدول.
- Policyهای `public`: تعداد ۷۴؛ حداقل یک Policy برای هر ۳۰ جدول.
- Migrationهای ثبت‌شده در Ledger زنده: ۱۵؛ آخرین نسخه `20261118195723`.
- داده‌های زنده هنگام ممیزی: ۵ کاربر Auth، ۵ پروفایل، ۲ پست و ۰ پیام. این داده‌ها واقعی‌اند و باید حفظ شوند.
- Storage: `user-files` خصوصی و `post-media` عمومی؛ هر دو سقف ۵۰٬۰۰۰٬۰۰۰ بایت دارند و هیچ‌کدام MIME allowlist تنظیم‌شده ندارند.
- چهار Migration پایه اول هنوز SQL متناظر قابل استقرار در Git ندارند؛ فایل آرشیوی `initial_schema_draft_NOT_FOR_DEPLOY.sql` جایگزین امن آن‌ها نیست. Reset یا replay آن ممنوع است.
- Security Advisor: هشدار `auth_leaked_password_protection` همچنان فعال است؛ محافظت رمزهای افشاشده خاموش است. [راهنمای اصلاح](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- Performance Advisor: ۳۱ اعلان INFO درباره indexهای استفاده‌نشده و یک WARN درباره دو SELECT policy مجاز در `public.file_assets` (`files_select_own` و `files_select_shared`). هیچ index یا policy صرفاً برای خاموش‌کردن هشدار حذف نشود.
- Health Advisor: بدون هشدار.
- آخرین Deployment Production دامنه `kaveh-avenger.vercel.app`: وضعیت `READY`، متصل به Commit وب `f73c8ae3037ef6ae930931115018f01090f08882`؛ خطای alias ندارد.
- آخرین Android CI و Security checks روی Commit `79e2794d1f3ddfa5738678eddd1ea63a9a2164b3` موفق‌اند. این موفقیت CI به معنی Release امضاشده یا تست روی گوشی واقعی نیست.
- Web CI روی Commit `9873606573e779d08211c2e0eb9572f7774f5ab4` موفق است؛ Commitهای بعدی فقط اصلاحات Android بوده‌اند.

### ممیزی قابلیت‌ها و موانع
- ورود ایمیل/OTP و ساخت رمز + تکرار دقیق رمز + ورود بعدی با رمز در کد وب و Android پیاده‌سازی شده است؛ نشست وب با `persistSession` ذخیره می‌شود. تست واقعی چرخه ثبت‌نام/خروج/ورود روی ایمیل کاربر در این ممیزی اجرا نشده است.
- وب شامل ورود، فید، چت، فایل، اکتشاف، پروفایل، اعلان و تنظیمات است؛ چت وب متن، Realtime، صفحه‌بندی و پیوست دارد.
- پنل فعلی مدیریت محدود است: نمای کلی، کاربران/پست‌ها و تنظیم کد مهمان؛ RBAC چندنقشی و Audit Log جامع هنوز وجود ندارد.
- مدل داده گروه/کانال وجود دارد، ولی تجربه کامل مدیریت گروه و کانال هنوز تأیید نشده است.
- فید ریلز عمودی اختصاصی، pipeline تبدیل ویدئو و پیشنهاد محتوا تکمیل نشده‌اند.
- اعلان In-App و Realtime موجود است؛ Web Push، Android Push/FCM، ایمیل مدیریتی و زمان‌بندی ارسال تأیید نشده‌اند.
- مدیریت مرکزی موسیقی/Playlist، Daily Title، Theme/Background editor، Remote Config نسخه‌بندی‌شده و Media Library کامل وجود ندارد.
- Android هنوز با وب هم‌سطح نیست؛ Explore/Profile و انتشار اجتماعی بومی ناقص‌اند. خروجی CI Debug است؛ Release signing و تست دستگاه واقعی مانده‌اند.

### ترتیب اجرایی مصوب برای ادامه
1. **تثبیت امنیت و Auth:** فعال‌سازی leaked-password protection از داشبورد مالک، بررسی تنظیمات OTP و تست E2E ثبت‌نام/ورود/خروج/ماندگاری نشست در هر دو کلاینت.
2. **قابل‌بازتولید کردن Backend:** تهیه export/backup رسمی از schema زنده، استخراج چهار migration پایه مفقود و آزمایش replay روی دیتابیس آزمایشی؛ بدون دست‌زدن به داده Production.
3. **امنیت Storage:** تعریف MIME allowlist و سیاست‌های فایل مجاز برای هر bucket، با تست فایل مجاز/غیرمجاز و حفظ private بودن `user-files`.
4. **Admin/RBAC:** طراحی مجوزهای server-side و audit trail، سپس تکمیل پنل مدیریت کاربران و moderation.
5. **محصول اجتماعی:** تکمیل follow/feed، گروه/کانال، سپس Reels عمودی و اعلان‌ها.
6. **کنترل مرکزی:** Remote Config، appearance، media/music و daily content با نسخه‌بندی و rollback.
7. **هم‌سطح‌سازی Android و Release:** تکمیل صفحات اجتماعی، آپلود پایدار، تست دوحسابی و انتشار Release امضاشده توسط کلید مالک.

### دامنه این ممیزی
در این مرحله فقط خواندن مخزن، وضعیت Deployment، GitHub Actions، Supabase schema، Migration Ledger و Advisors انجام شد. هیچ SQL تغییردهنده، Migration، حذف داده، تغییر Storage policy یا تغییر تنظیمات Auth اجرا نشده است.


## الحاقیه اجرای فاز امنیت مدیریت — ۱۹ نوامبر ۲۰۲۶

### تغییرات انجام‌شده در Production
- Migration جدید `20261118212549_kaveh_admin_audit_log` اجرا شد و در Migration Ledger زنده ثبت شده است.
- جدول `public.admin_audit_logs` با فیلدهای actor، action، target، status، details، زمان شروع و زمان تکمیل ساخته شد.
- RLS روی جدول فعال است؛ دسترسی SELECT برای `anon` و `authenticated` رد می‌شود و درج/به‌روزرسانی فقط از مسیر `service_role` انجام می‌شود.
- Edge Function با نام `admin-console` به نسخه ۳ ارتقا یافت و وضعیت آن `ACTIVE` و `verify_jwt=true` تأیید شد.
- عملیات `moderate_post` و `delete_post` اکنون پیش از اجرا رویداد `started` ثبت می‌کنند و پس از نتیجه، وضعیت `succeeded` یا `failed` را ثبت می‌کنند. در صورت عدم امکان ثبت رویداد شروع، عملیات مدیریتی اجرا نمی‌شود.
- تعداد رکوردهای Audit در زمان بررسی صفر است؛ هیچ عملیات مدیریتی آزمایشی یا حذف/تغییر پست واقعی برای تست انجام نشده است.

### تست و محدودیت
- Migration در دیتابیس Production موفق اجرا شد.
- ساختار ستون‌ها، فعال بودن RLS، رد دسترسی خواندن برای نقش‌های `anon` و `authenticated` و مجوز INSERT برای `service_role` با SQL فقط‌خواندنی تأیید شد.
- نسخه فعال Edge Function از Supabase خوانده و وجود کد ثبت Audit تأیید شد.
- GitHub Security checks برای Commit کد تابع `9325a7d7df82f2980c1e8cb97c90f0e84cbe757e` موفق گزارش شده است. اجرای workflow برای Commitهای صرفاً تغییر نام/مستندسازی در زمان این ثبت هنوز در حال اجرا بوده است.
- تست end-to-end با نشست مدیر واقعی انجام نشده؛ بنابراین ثبت یک رویداد واقعی هنوز تأیید نشده است.
- Security Advisor یک INFO برای RLS بدون Policy روی `admin_audit_logs` نشان می‌دهد؛ این وضعیت عمدی است، چون هیچ نقش کلاینتی نباید مستقیماً گزارش‌های مدیریتی را بخواند. هشدار leaked-password protection همچنان باقی است.
- هیچ داده کاربر، پست یا فایل موجودی حذف یا بازنویسی نشده است.


## الحاقیه تکمیل مرحله اول RBAC — ۱۹ نوامبر ۲۰۲۶

### نقش‌های مدیریتی و مجوزها
- Migration زنده `20261118212800_kaveh_admin_rbac_roles` ستون `role` را به جدول خصوصی `site_access_admins` اضافه کرد.
- نقش‌های مجاز: `owner`، `admin`، `moderator` و `support`.
- تنها مدیر موجود پیش از مهاجرت به نقش `owner` ارتقا یافت؛ شمارش زنده نقش‌ها: یک owner. مدیران جدید در صورت درج از مسیر امن، به‌طور پیش‌فرض `admin` خواهند بود.
- در `admin-console`: نقش‌های owner/admin/moderator اجازه moderation پست دارند؛ حذف پست فقط برای owner/admin است؛ نمای کلی برای نقش‌های ثبت‌شده در allowlist قابل دسترسی است.
- در `access-code-login`: مشاهده و تغییر تنظیمات کد مهمان فقط برای owner/admin مجاز است. مسیر ورود مهمان عادی تغییری نکرده است.
- نسخه فعال `admin-console`: نسخه ۴ با `verify_jwt=true`.
- نسخه فعال `access-code-login`: نسخه ۵ با `verify_jwt=false`؛ این تابع همچنان احراز هویت داخلی و بررسی نقش را برای عملیات مدیریتی انجام می‌دهد و مسیر login مهمان عمومی باقی مانده است.
- GitHub Security checks روی Commit نهایی کد `8115d351c81973f8117e4a0f894e5eb476bd6d83` موفق است.

### مواردی که هنوز تکمیل نشده‌اند
- رابط مدیریت نقش‌ها برای افزودن مدیر، تغییر نقش و لغو دسترسی هنوز ساخته نشده است.
- تاریخچه Audit Log در پنل وب به‌صورت فهرست ۱۰۰ عملیات اخیر نمایش داده می‌شود؛ دسترسی endpoint فقط برای owner/admin است. رابط مدیریت نقش‌ها برای افزودن مدیر، تغییر نقش و لغو دسترسی هنوز ساخته نشده است.
- تست عملی با نشست‌های owner/admin/moderator/support و تأیید پاسخ‌های 403/200 انجام نشده؛ مجوزها در کد سرور و ساختار زنده تأیید شده‌اند، نه با تست E2E حساب‌های واقعی.
- هیچ حسابی حذف نشده و هیچ پست یا فایل موجودی دست‌کاری نشده است.


## الحاقیه رابط گزارش مدیریت — ۱۹ نوامبر ۲۰۲۶

- Edge Function `admin-console` به نسخه ۵ ارتقا یافت و endpoint `audit_logs` اضافه شد؛ فقط نقش‌های `owner` و `admin` می‌توانند ۱۰۰ رویداد اخیر را بخوانند.
- پنل وب در `AdminAccessCodePanel.tsx` تب «گزارش مدیریت» دارد و زمان، نوع عملیات، شناسه هدف، مدیر اجراکننده و وضعیت را نشان می‌دهد.
- Web CI برای Commit `b0f74366536f7aad7635131191edf238f7fc0943` هنگام ثبت این الحاقیه در حال اجراست؛ تا دریافت نتیجه، build موفق اعلام نمی‌شود.
- هنوز رویداد واقعی در جدول ثبت نشده؛ تست end-to-end نیازمند اجرای یک عملیات آزمایشی کنترل‌شده با نشست مدیر است. هیچ پست واقعی برای آزمایش حذف یا مخفی نشده است.
