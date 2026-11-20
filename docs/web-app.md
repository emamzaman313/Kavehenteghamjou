# نسخه وب کاوه انتقامجو

## معماری و اتصال

`web/` یک Next.js App Router مستقل با TypeScript و React است. مرورگر با Supabase JS و Publishable Key به همان Project Ref مشترک Android یعنی `slwzjufipavuwcbwoyro` متصل می‌شود؛ دیتابیس دوم برای وب وجود ندارد.

در Vercel Production مقدار `NEXT_PUBLIC_SUPABASE_URL` به `https://slwzjufipavuwcbwoyro.supabase.co` تطبیق داده شد. کلید عمومی Publishable نیز برای Production/Preview پیکربندی شده؛ هیچ Service Role Key نباید در مرورگر باشد.

## ورود

- `signInWithOAuth({ provider: 'google' })` با PKCE و redirect به `/auth/callback`.
- Supabase client از `persistSession`، `autoRefreshToken` و `flowType: 'pkce'` استفاده می‌کند.
- خطاهای Provider غیرفعال، لغو و شبکه اکنون پیام فارسی قابل‌اقدام دارند و خطاهای query/hash callback نمایش داده می‌شوند.
- درخواست ورود با `try/catch/finally` پیاده‌سازی شده تا شکست شبکه کنترل را در حالت busy قفل نکند.
- شش تست در `web/tests/auth-errors.test.ts` پارامترهای خطا، پیام امن و callback را پوشش می‌دهد.
- خطای واقعی قبلی `Unsupported provider: provider is not enabled` در لایه Supabase/Auth رخ می‌دهد؛ تغییر UI آن را پنهان نمی‌کند و Provider باید در Supabase Dashboard واقعاً فعال شود. در این مأموریت وضعیت Provider از پنل قابل‌خواندن/تغییر نبود و ورود Google واقعی تأیید نشده است.

## صفحات و قابلیت‌های موجود در سورس

| بخش | کد فعلی |
|---|---|
| خانه | فید، refresh، انتشار متن، reaction و comment |
| گفتگو | گفتگوی مستقیم، پیام، Realtime، history، read cursor و پیوست |
| فایل‌ها | انتخاب چند فایل، سقف ۵۰٬۰۰۰٬۰۰۰ بایت، آپلود و دانلود امن |
| اکتشاف | جست‌وجوی کاربران و follow/unfollow |
| پروفایل | نمایش و ویرایش فیلدهای مجاز |
| اعلان‌ها | فهرست، unread count، Realtime و mark-read |
| تنظیمات | تم، زبان ترجیحی و خروج |

این جدول وضعیت کد/UI را نشان می‌دهد؛ با توجه به صفر بودن کاربران Auth در ممیزی آخر، تعامل واقعی دوحسابی و مجوزهای RLS هنوز E2E نشده‌اند.

## Build و CI

Workflow مربوط به Web در Commit کد وب `a9e9e23e8f2a71c04d8da1884eab26c70238c3a9` موفق است:
- `npm ci` و TypeScript موفق.
- ESLint بدون error و با ۹ warning موجود در کامپوننت‌های دیگر.
- Vitest: ۱۰ تست از ۱۰ تست موفق.
- Next.js production build موفق.

Run: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44325901682

## انتشار

یک Production Deployment از Vercel برای SHA `d204f71253c129770dc69436a4373ffd7e46c05c` با شناسه `dpl_5Z2f6VFMSYbcF5kfM9M9yaZiUZ9R` ایجاد و وضعیت آن `READY` تأیید شد. alias شامل `kaveh-avenger.vercel.app` است؛ این تأیید، تست Google OAuth یا تست مرورگر را جایگزین نمی‌کند.

دامنه اصلی پروژه: https://kaveh-avenger.vercel.app

## محدودیت‌ها

- Google Provider/Client credentials و تست end-to-end ورود واقعی باقی است.
- تست دوحسابی چت، RLS و اشتراک فایل هنوز اجرا نشده؛ برای آن دو حساب اختصاصی لازم است.
- Android و Web upload progress و resumable transfer یکسان و تکمیل‌شده ندارند.
- PWA کامل، Service Worker، برند/آیکون رسمی، FCM، گروه/کانال، استوری، تماس و پنل مدیریت واقعی در محدوده نسخه فعلی آماده نیستند.
