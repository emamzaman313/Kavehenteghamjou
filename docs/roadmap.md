# نقشه راه توسعه

این نقشه راه بر اساس سورس، آخرین Commit بررسی‌شده و ممیزی Read-only در ۱۸ نوامبر ۲۰۲۶ به‌روزرسانی شده است. وضعیت هر قابلیت باید بر اساس شواهد تست تغییر کند.

## وضعیت‌ها

- **پیاده‌سازی نشده:** کد اجرایی وجود ندارد.
- **در حال توسعه:** بخشی از منطق/رابط وجود دارد، اما جریان کامل نیست.
- **پیاده‌سازی شده ولی تست نشده:** کد اصلی وجود دارد اما آزمون معتبر/واقعی انجام نشده.
- **تست خودکار موفق:** تست خودکار روی Commit مشخص موفق بوده است.
- **تست End-to-End موفق:** جریان واقعی با سرویس/حساب‌های مستقل تأیید شده است.
- **آماده انتشار:** Release امضاشده و آزمون پذیرش روی دستگاه/Production با شواهد کامل است.

## فاز ۰ — ممیزی و مرجع

- [x] تأیید مخزن رسمی و شاخه main در Commit 60f46da6cad606430e8b306ce971423aa5caea27.
- [x] بررسی کد Web/Android، CI، Deployment، تنظیمات Vercel و Ledger مهاجرت‌ها.
- [x] تطبیق Project Ref وب و Android با slwzjufipavuwcbwoyro.
- [ ] بازیابی چهار Migration ابتدایی و تاریخچه Git قدیمی؛ فقط با منبع معتبر مالک.

## فاز ۱ — Backend و هویت

- [x] پروژه Supabase فعال؛ ۲۶/۲۶ جدول با RLS و ۶۸ Policy.
- [x] bucket خصوصی user-files با سقف ۵۰٬۰۰۰٬۰۰۰ بایت.
- [x] RPC ایجاد گفتگوی مستقیم و Realtime publication پایه.
- [x] کد Google Credential Manager و PKCE web callback در سورس.
- [ ] فعال‌سازی Google Provider در Supabase؛ در ممیزی Auth فعلی external.google=false است.
- [ ] Web OAuth Client/Secret، Android Client و SHA-1های واقعی در Google Cloud.
- [ ] Google sign-in واقعی، نشست پایدار، refresh و sign-out روی Web و Android.

## فاز ۲ — وب و پذیرش Auth

- [x] Vercel env Production به Supabase Project Ref صحیح اشاره می‌کند.
- [x] اصلاح callback وب برای تبادل صریح یک‌باره PKCE و خطاهای قابل‌فهم در شاخه fix/web-google-auth-flow-2026-11-18.
- [x] TypeScript، Vitest (۸ تست)، ESLint (صفر خطا/۹ هشدار) و Next.js build روی Commit تست‌شده موفق.
- [ ] اجرای Web CI روی PR و استقرار Commit اصلاح‌شده در Production.
- [ ] Google OAuth واقعی و session restore/refresh/logout؛ فعلاً به‌علت Provider غیرفعال ممکن نیست.

## فاز ۳ — پیام‌رسانی و رسانه

- [x] کد فهرست گفتگو، پیام متنی، Supabase Realtime، صفحه‌بندی و read cursor در Web/Android.
- [x] private Storage metadata و SHA-256 در مسیرهای فعلی.
- [ ] E2E دوحسابی واقعی Web↔Android، read receipt، RLS و رد کاربر غیرمجاز.
- [ ] Delivered، typing، online presence با انقضا، reply، edit/delete و search.
- [ ] پیش‌نمایش رسانه، retry پایدار، وضعیت آفلاین و جلوگیری از ارسال تکراری.
- [ ] Android WorkManager، Stream/Resumable Upload، cancel/retry و progress واقعی بایت.
- [ ] تست ۱ بایت، نام فارسی، ۴۹MB، دقیقاً ۵۰٬۰۰۰٬۰۰۰ بایت و بیش از سقف روی Storage و دستگاه واقعی.

## فاز ۴ — شبکه اجتماعی و پروفایل

- [ ] تکمیل صفحه‌های Placeholder در Android برای Home/Explore/Profile/Publish/Notifications/Settings.
- [x] بخشی از فید، انتشار، واکنش/نظر، follow، profile و notifications در Web؛ تست E2E کامل باقی است.
- [ ] پیاده‌سازی UI اجتماعی Android و آزمون RLS/Privacy.
- [ ] رتبه/نشان صرفاً server-authoritative؛ هیچ ارتقای رتبه از کلاینت.

## فاز ۵ — اعلان و قابلیت‌های پیشرفته

- [ ] ثبت/اعتبارسنجی device token و FCM واقعی.
- [ ] گروه، کانال، topic، استوری و نظرسنجی پس از تکمیل مجوزهای Backend.
- [ ] تماس WebRTC با Signaling/SFU و آزمون شبکه.
- [ ] E2EE تنها با پروتکل استاندارد ممیزی‌شده و مدیریت کلید امن.

## فاز ۶ — انتشار Android

- [ ] Keystore دائمی متعلق به مالک، پشتیبان امن و چهار GitHub Secrets.
- [ ] Repository Variable با نام GOOGLE_WEB_CLIENT_ID.
- [ ] اجرای assembleRelease و bundleRelease از طریق Android Release Workflow.
- [ ] بررسی امضای APK/AAB و SHA-256.
- [ ] نصب و آزمون روی گوشی فیزیکی با Google Auth، Session، Chat، Realtime و فایل.
- [ ] انتشار Play فقط با مجوز و دسترسی مالک.

## فاز امنیت و نگهداری

- [x] Gitleaks و Production dependency audit در گزارش تاریخی CI موفق.
- [ ] حل زنجیره ۱۶ هشدار High در وابستگی‌های توسعه؛ در ۱۸ نوامبر ۲۰۲۶ picomatch نسخه 4.0.7 آخرین نسخه npm و در advisory <=4.0.7 آسیب‌پذیر بود. npm تنها راهکار خودکار downgrade عمده Vitest را پیشنهاد کرد؛ downgrade انجام نمی‌شود تا نسخه اصلاح‌شده سازگار منتشر شود.
- [ ] اجرای دوباره Security workflow روی Commitهای جاری و بازبینی هشدارها.
