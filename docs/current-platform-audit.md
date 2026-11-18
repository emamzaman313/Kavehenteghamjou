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
