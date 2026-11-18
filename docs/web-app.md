# نسخه وب کاوه انتقامجو

## ساختار

`web/` یک Next.js App Router مستقل با TypeScript و React است. لایه داده از Supabase JS استفاده می‌کند و مستقیماً به همان پروژه `slwzjufipavuwcbwoyro` متصل می‌شود؛ دیتابیس جداگانه‌ای برای وب وجود ندارد.

## اتصال و امنیت

- کلید عمومی Publishable در `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` استفاده می‌شود.
- هیچ Service Role یا Secret Key در Browser قرار نمی‌گیرد.
- ورود Google از OAuth + PKCE و callback مسیر `/auth/callback` استفاده می‌کند.
- تمام Queryها با نشست Authenticated اجرا می‌شوند و RLS دیتابیس کنترل نهایی دسترسی است.
- Storage bucket `user-files` خصوصی و سقف آن ۵۰٬۰۰۰٬۰۰۰ بایت است.
- دانلود از مسیر `createSignedUrl` با اعتبار ۹۰ ثانیه انجام می‌شود.
- SHA-256 با خواندن Stream فایل و chunkهای کوچک محاسبه می‌شود، نه `arrayBuffer()` کل فایل.

## صفحات و قابلیت‌های متصل

| بخش | قابلیت فعلی |
|---|---|
| ورود | Google OAuth redirect / PKCE؛ نیازمند تنظیم Provider در داشبورد |
| خانه | خواندن فید عمومی، انتشار متن، واکنش و دیدگاه |
| گفتگو | ایجاد گفتگوی مستقیم، تاریخچه، ارسال پیام، Realtime |
| فایل‌ها | چندانتخابی، Drag & Drop، کنترل حجم، آپلود و دانلود امن |
| اکتشاف | جست‌وجوی پروفایل و دنبال‌کردن |
| پروفایل | ویرایش نام، نام کاربری و بیو؛ نمایش رتبه و نشان از DB |
| اعلان‌ها | خواندن، Realtime count و علامت‌گذاری خوانده‌شده |
| تنظیمات | تم، زبان ترجیحی و خروج |

## راه‌اندازی

مراحل و OAuth setup در `web/README.md` قرار دارد. متغیرهای نمونه در `.env.example` هستند.

## محدودیت‌های فعلی

- هنوز build production به دلیل عدم دسترسی محیط توسعه به npm registry اجرا نشده است؛ `package-lock.json` نیز تا زمان نصب موفق تولید نشده است.
- PWA کامل نیست: manifest اولیه وجود دارد، اما Service Worker و آیکون رسمی برند در workspace فعلی در دسترس نیست.
- آپلود فعلی استاندارد Supabase Storage است؛ انتقال resumable/multipart و پیشرفت بایت‌به‌بایت باقی مانده است.
- UI گروه/کانال، استوری، تماس، Push، و پنل مدیریت واقعی باقی مانده‌اند.


## ممیزی تکمیلی OAuth و تست — ۱۸ نوامبر ۲۰۲۶

Vercel Production به URL درست Supabase یعنی https://slwzjufipavuwcbwoyro.supabase.co متصل است. endpoint Auth مقدار external.google=false برگرداند؛ Provider غیرفعال است و این علت خطای provider is not enabled است.

در شاخه fix/web-pkce-single-exchange-2026-11-18، Commit کد b9ad73e9c0d8dd67a7678aecfba723ea18ebeffe با npm ci، typecheck، Next.js build و ۱۰ تست Vitest تأیید شد. ESLint بدون error و با ۹ warning بود؛ npm audit --omit=dev صفر و کل dev graph دارای ۱۶ High بود. ورود واقعی Google و تست نشست OAuth تا فعال‌سازی Provider انجام نشده است.
