# نسخه وب کاوه انتقامجو

## ساختار و Backend

web/ یک Next.js App Router مستقل با TypeScript و React است. نسخه وب و Android از پروژه Supabase مشترک استفاده می‌کنند؛ Project Ref برابر slwzjufipavuwcbwoyro و نشانی تأییدشده Production برابر https://slwzjufipavuwcbwoyro.supabase.co است. دیتابیس مستقل برای وب وجود ندارد.

## اتصال و امنیت

- NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY تنها متغیرهای عمومی کلاینت هستند.
- مقدار URL در محیط Vercel Production بازخوانی و با Project Ref واقعی تطبیق داده شد؛ host کوتاه مشاهده‌شده در تصویر، مقدار فعلی Production نیست.
- هیچ Service Role یا Secret Key در Browser قرار نمی‌گیرد.
- ورود از Google OAuth با PKCE و callback مسیر /auth/callback استفاده می‌کند.
- callback در شاخه اصلاحی کد را صریحاً و فقط یک‌بار مبادله می‌کند و نشست موجود را نیز بازیابی می‌کند.
- RLS دیتابیس مرجع نهایی کنترل دسترسی است؛ Storage bucket user-files خصوصی و سقف آن دقیقاً ۵۰٬۰۰۰٬۰۰۰ بایت است.
- دانلود فایل در Web از signed URL کوتاه‌عمر استفاده می‌کند.

## صفحات و اتصال فعلی

| بخش | وضعیت در سورس |
|---|---|
| ورود | Google OAuth + PKCE؛ Provider واقعی فعلاً غیرفعال است |
| خانه | فید و انتشار محتوا |
| گفتگو | گفتگوی مستقیم، تاریخچه، پیام، Realtime، read cursor و پیوست |
| فایل | انتخاب چند فایل، کنترل حجم، آپلود/دانلود خصوصی و metadata |
| اکتشاف | جست‌وجوی کاربران و follow |
| پروفایل | ویرایش اطلاعات عمومی و نمایش رتبه/نشان سرور |
| اعلان‌ها | خواندن و Realtime |
| تنظیمات | تم، زبان و خروج |

وجود مسیر یا صفحه به‌تنهایی اثبات‌کننده End-to-End بودن آن نیست؛ آزمایش دوحسابی و RLS هنوز جداگانه لازم است.

## نتایج تست شاخه اصلاح Auth

در Commit تست‌شده f77dc0032974e4e4f33033b7c3b322bd05e13cb9:

- npm ci: موفق، ۴۰۶ بسته نصب شد.
- npm run typecheck: موفق.
- npm run lint: Exit 0، بدون خطا و با ۹ هشدار موجود.
- npm test: دو فایل، ۸ تست موفق.
- npm run build: Next.js Production Build موفق.
- مسیرهای Production اصلی و /auth/callback در Deployment فعلی HTTP 200 برگرداندند؛ این مورد جایگزین آزمون OAuth واقعی نیست.

## محدودیت‌های اثبات‌شده

- endpoint عمومی Supabase Auth در ممیزی زنده external.google=false برگرداند؛ بنابراین خطای provider is not enabled از خود Provider غیرفعال می‌آید. تغییر کد رابط این تنظیم سرور را فعال نمی‌کند.
- ورود واقعی، انتخاب حساب Google، callback واقعی و session restore بعد از OAuth تا فعال‌سازی Provider و ثبت credentials آزمایش نشده‌اند.
- uploader وب از روش استاندارد Storage استفاده می‌کند؛ صف پایدار، resumable/multipart و پیشرفت بایت‌به‌بایت هنوز تکمیل نشده‌اند.
- PWA کامل نیست؛ manifest به‌تنهایی کافی نیست و service worker/دارایی رسمی برند در دسترس نیست.
- گروه/کانال، استوری، تماس، Push و پنل مدیریت تکمیل نشده‌اند.
