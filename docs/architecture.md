# معماری فنی کاوه انتقامجو

## تصمیم معماری

محصول مستقل است؛ اتصال به حساب تلگرام، MTProto یا سرویس‌های تلگرام ندارد. سورس Telegram Android فقط مرجع بررسی مهندسی است و هیچ کد Telegram در این مخزن کپی نشده است. کلاینت جدید با Kotlin و Jetpack Compose ساخته می‌شود؛ سرویس‌های فعلی backend بر Supabase تکیه دارند.

## اجزای سیستم

| لایه | فناوری/سرویس | وضعیت |
|---|---|---|
| Android UI | Kotlin، Jetpack Compose، Material 3 | پوستهٔ ناوبری پنج‌بخشی و صفحهٔ ورود نوشته شده؛ Build اجرا نشده |
| Google Identity | Android Credential Manager + Google ID Token | کد دریافت توکن و nonce نوشته شده؛ OAuth واقعی هنوز پیکربندی/تست نشده |
| Auth | Supabase Auth | پروژه موجود؛ Provider گوگل به OAuth credentials واقعی نیاز دارد |
| Database | PostgreSQL 17 | ۲۶ جدول محصول ساخته شده |
| Authorization | PostgreSQL RLS + محدودیت مجوز ستون‌ها | RLS برای تمام ۲۶ جدول فعال؛ advisor امنیت بدون lint |
| Messaging | `conversations`, `conversation_members`, `messages` | مدل و RPC چت مستقیم آماده؛ UI/ارسال و دریافت واقعی هنوز انجام نشده |
| Social | posts, comments, reactions, follows, stories | schema آماده؛ فید/تعاملات در اپ هنوز متصل نیست |
| Storage | Supabase private Storage `user-files` | آپلود مستقیم در کد اپ اضافه شده؛ هنوز Build/آزمون واقعی نشده |
| Realtime | Supabase Realtime | publication برای messages/posts/notifications تنظیم شده؛ مصرف کلاینتی تست نشده |
| Push | Firebase Cloud Messaging | برنامه‌ریزی‌شده، پیاده‌سازی نشده |
| Calls | WebRTC + signaling/SFU | مرحلهٔ آینده، پیاده‌سازی نشده |

## جریان ورود

۱. اپ وضعیت Supabase session را بررسی می‌کند. ۲. در نبود نشست، کاربر فقط صفحهٔ ورود Google را می‌بیند. ۳. Credential Manager توکن Google را با nonce هش‌شده دریافت می‌کند. ۴. نسخهٔ خام nonce همراه ID Token به Supabase Auth داده می‌شود. ۵. Trigger دیتابیس در ایجاد auth user، `profiles`, `user_settings` و `user_rank_state` را می‌سازد.

OAuth هنوز به Web Client ID/Android OAuth Client ID، SHA-1 و Google Provider configuration در Supabase نیاز دارد. هیچ secret در Android قرار نمی‌گیرد.

## فایل‌ها

- هر فایل در bucket خصوصی `user-files` ذخیره می‌شود.
- حداکثر اندازه در Storage و ستون metadata برابر ۵۰٬۰۰۰٬۰۰۰ بایت است.
- پسوند/MIME allowlist وجود ندارد؛ همهٔ انواع فایل از انتخابگر سیستم قابل انتخاب‌اند.
- نام اصلی Unicode در `file_assets.original_name` نگهداری می‌شود؛ مسیر object با UUID تولید می‌شود.
- کد فعلی فایل را در حافظهٔ دستگاه buffer می‌کند و با upload معمولی می‌فرستد؛ برای production باید WorkManager، stream/resumable transfer، cancel/retry و پاک‌سازی object یتیم اضافه شود.
- policy خواندن Storage و metadata برای مالک، اعضای گفتگو و بینندگان مجاز پست/استوری تنظیم شده؛ signed URL کوتاه‌عمر باید در کلاینت متصل شود.

## امنیت و مرز اعتماد

- تمام جداول محصول در public دارای RLS هستند.
- رتبه/امتیاز و نشان‌ها برای نوشتن از کلاینت مجوز ندارند.
- RPC عمومی `create_direct_conversation` فقط wrapper با SECURITY INVOKER است؛ کار حساس در تابع SECURITY DEFINER داخل schema غیرقابل‌نمایش `private` انجام می‌شود و `auth.uid()` را اعتبارسنجی می‌کند.
- service-role، Google Client Secret و signing key هرگز در APK قرار نمی‌گیرند.
- رمزنگاری E2EE ادعا نشده است؛ TLS و سیاست‌های Supabase کافی برای ادعای E2EE نیستند.


## ممیزی تکمیلی ۱۸ نوامبر ۲۰۲۶

Project Ref زنده slwzjufipavuwcbwoyro و URL Production برابر https://slwzjufipavuwcbwoyro.supabase.co تأیید شد. در Auth settings مقدار external.google=false بود. مسیر وب برای جلوگیری از پردازش خودکار و دستی هم‌زمان، detectSessionInUrl=false دارد و callback خودش نشست را بازیابی و code را با exchangeCodeForSession مبادله می‌کند. یک Promise مشترک از اجرای مجدد تبادل در React Strict Mode جلوگیری می‌کند.

Web روی Commit آزمایش‌شده b9ad73e9c0d8dd67a7678aecfba723ea18ebeffe: TypeScript، Production Build، ۱۰ تست و npm audit --omit=dev موفق؛ ESLint صفر خطا/۹ هشدار. این نتایج به معنای موفقیت OAuth واقعی نیستند؛ Provider در سرور غیرفعال است. Android Release/دستگاه واقعی و E2E دوحسابی هنوز تأیید نشده‌اند.
