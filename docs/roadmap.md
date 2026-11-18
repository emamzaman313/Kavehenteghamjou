# نقشه راه و وضعیت تحویل

این نقشه بر اساس سورس فعلی و شواهد CI در ۱۸ نوامبر ۲۰۲۶ به‌روزرسانی شده است. «وجود صفحه» با «قابلیت عملیاتی» و «Build موفق» با «تست واقعی چندکاربره» یکسان نیست.

## فاز ۱ — ممیزی و زیرساخت مشترک

- [x] استفاده از مخزن اصلی `emamzaman313/Kavehenteghamjou` و شاخه `main`
- [x] Supabase Project واحد برای Web و Android: `slwzjufipavuwcbwoyro`
- [x] ۲۶ جدول public با RLS فعال و ۶۸ Policy
- [x] Private Storage با سقف دقیق ۵۰٬۰۰۰٬۰۰۰ بایت
- [x] RPC ساخت گفتگوی مستقیم و Realtime publication
- [x] تطبیق URL محیط Production در Vercel با Supabase URL
- [ ] بازیابی چهار Migration اولیه از منبع Git اصلی؛ اجرای archive draft ممنوع

## فاز ۲ — ورود و نشست

- [x] کد Android Credential Manager، Google ID Token و nonce
- [x] کد Web OAuth + PKCE و callback
- [x] مدیریت خطاهای Provider/شبکه/لغو در Web و Android
- [x] تست واحد mapper خطای Web و Android؛ Web CI و Android CI موفق
- [ ] فعال‌سازی واقعی Google Provider در Supabase و وارد کردن Web Client ID/Secret
- [ ] ثبت GitHub Repository Variable به نام `GOOGLE_WEB_CLIENT_ID`؛ در اجرای CI فعلی خالی بود
- [ ] ثبت Android OAuth Client و SHA-1 گواهی‌های Debug/Release
- [ ] ورود واقعی Google و بازیابی Session در وب، Android و پس از Refresh/Restart

## فاز ۳ — پیام‌رسانی

- [x] کد چت مستقیم در Web و Android
- [x] ارسال/دریافت پیام و subscription Realtime
- [x] صفحه‌بندی پیام و Read cursor
- [x] preview آخرین پیام و unread count
- [ ] اجرای تست دوحسابی Web و Android با دو کاربر مستقل
- [ ] Delivered واقعی، typing، presence با TTL، Reply، ویرایش/حذف امن و جست‌وجوی پیام
- [ ] retry پایدار و جلوگیری از ارسال تکراری در شرایط قطع شبکه

## فاز ۴ — فایل و رسانه

- [x] انتخاب فایل و کنترل سقف سمت UI
- [x] Android upload/metadata/SHA-256 و دانلود پیوست‌های مجاز در کد
- [x] Web upload و دانلود با Supabase Storage خصوصی در کد
- [ ] تست واقعی ۱ بایت، نام فارسی، حدود ۴۹MB، دقیقاً ۵۰٬۰۰۰٬۰۰۰ بایت و بزرگ‌تر از سقف
- [ ] Android stream upload/download و WorkManager
- [ ] resumable upload، cancel، retry و progress بر اساس بایت
- [ ] پیش‌نمایش تصویر/ویدئو و تست عدم دسترسی برای کاربر غیرمجاز

## فاز ۵ — شبکه اجتماعی و حساب

- [x] صفحات Web فید، انتشار، اکتشاف، پروفایل، اعلان و تنظیمات در سورس
- [ ] تست واقعی انتشار/واکنش/نظر/follow با کاربران واقعی
- [ ] تکمیل Android Explore و Profile؛ اکنون Placeholder هستند
- [ ] پیاده‌سازی انتشار اجتماعی بومی Android؛ تب فعلی به صفحه آپلود فایل متصل است
- [ ] کنترل حریم خصوصی، تصاویر پروفایل، ویرایش اطلاعات و نشان‌های server-authoritative در Android

## فاز ۶ — اعلان و قابلیت‌های پیشرفته

- [x] زیرساخت جدول اعلان و Realtime publication
- [ ] FCM، token registration و Push واقعی
- [ ] گروه، کانال، topic، نظرسنجی و مدیریت اعضا
- [ ] استوری با audience، expiry و viewer tracking
- [ ] تماس WebRTC با signaling/SFU قابل اتکا
- [ ] E2EE فقط پس از انتخاب و ممیزی پروتکل استاندارد

## فاز ۷ — Release

- [x] Web CI: TypeScript، ESLint، ۱۰ تست و Next.js production build موفق
- [x] Android CI: Unit tests، Debug APK و Debug AAB موفق
- [x] Security CI: Secret scanning و Web dependency audit موفق
- [ ] Release keystore دائمی مالک و چهار GitHub Secrets امضا
- [ ] اجرای `assembleRelease` و `bundleRelease` و بررسی امضای APK/AAB
- [ ] تست نصب و اجرا روی گوشی فیزیکی
- [ ] دو حساب E2E اختصاصی و اجرای Workflow چت
- [ ] تأیید واقعی Google OAuth
- [ ] انتشار Google Play توسط مالک دارای دسترسی و مالکیت حساب

## موانع بیرونی لازم برای بستن فاز Release

1. Google Cloud: ساخت/تأیید Web OAuth Client و Android OAuth Client.
2. Supabase Dashboard: فعال‌کردن Google Provider، ثبت Web Client ID و Secret و Redirect URLهای دقیق.
3. GitHub Repository Variables: ثبت `GOOGLE_WEB_CLIENT_ID`.
4. GitHub Secrets: `ANDROID_KEYSTORE_BASE64`، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS`، `ANDROID_KEY_PASSWORD`.
5. ساخت دو حساب تست اختصاصی و افزودن چهار Secret مربوط به Chat E2E.
6. دسترسی به گوشی فیزیکی و تأیید نصب، ورود، چت و فایل.

تا بسته‌شدن موارد بالا پروژه «آماده انتشار عمومی» محسوب نمی‌شود.


## اصلاح بر اساس ممیزی زنده — ۱۸ نوامبر ۲۰۲۶

- [x] Vercel Production URL با Supabase Project Ref تطبیق داده شد.
- [x] callback وب برای جلوگیری از exchange تکراری PKCE، بازیابی نشست موجود و مدیریت React Strict Mode اصلاح شد؛ کد پس از موفقیت از URL پاک می‌شود.
- [x] Web TypeScript و Next.js build موفق؛ Vitest ده تست موفق؛ ESLint صفر خطا/۹ هشدار؛ Production dependency audit صفر finding.
- [ ] Supabase Auth external.google=false است؛ فعال‌سازی واقعی Provider و Google OAuth credentials در انتظار مالک.
- [ ] Google OAuth end-to-end، 2-account Chat E2E، Android Release و physical-device acceptance هنوز انجام نشده‌اند.
