# معماری فنی کاوه انتقامجو

## تصمیم معماری

کاوه انتقامجو محصولی مستقل است و به حساب تلگرام، MTProto یا سرویس‌های تلگرام وابسته نیست. کلاینت‌ها از Supabase مشترک استفاده می‌کنند تا UUID کاربران، پیام‌ها، رسانه و مجوزهای RLS بین وب و Android یکسان بمانند.

## اجزای سیستم و وضعیت مشاهده‌شده

| لایه | فناوری/سرویس | وضعیت واقعی |
|---|---|---|
| Android UI | Kotlin، Jetpack Compose، Material 3 | پوسته پنج‌بخشی و صفحات اصلی در سورس؛ بخش اکتشاف/پروفایل و بعضی صفحات هنوز Placeholder یا ناقص‌اند؛ Release روی دستگاه تأیید نشده |
| Web UI | Next.js، React، TypeScript | Production build و هشت تست واحد روی شاخه اصلاح Auth موفق؛ قابلیت‌های Web به‌صورت بخش‌به‌بخش در docs/web-app.md ثبت شده‌اند |
| Google Identity Android | Credential Manager + Google ID Token | کد و nonce پیاده‌سازی شده؛ Client ID و OAuth واقعی هنوز تأیید نشده |
| Supabase Auth | Google / Email | پروژه فعال؛ در زمان ممیزی external.google=false بود، پس OAuth Google غیرفعال است |
| Database | PostgreSQL 17.12 | ۲۶ جدول عمومی؛ هر ۲۶ جدول دارای RLS |
| Authorization | RLS + محدودیت مجوز ستون‌ها | ۶۸ Policy؛ Supabase Security Advisor در ممیزی فعلی finding نداشت |
| Messaging | conversations، conversation_members، messages | UI و تبادل پیام در سورس Web و Android وجود دارد؛ دوحسابی E2E تأیید نشده؛ typing/presence/reply/edit/delete/search کامل نیست |
| Storage | Supabase private bucket user-files | خصوصی و محدود به ۵۰٬۰۰۰٬۰۰۰ بایت؛ Android فعلاً فایل را کامل در حافظه Buffer می‌کند؛ WorkManager/resumable/byte progress ندارد |
| Realtime | Supabase Realtime | publication برای messages، conversation_members، notifications و posts؛ اتصال دوحسابی end-to-end تأیید نشده |
| Push | Firebase Cloud Messaging | پیاده‌سازی نشده |
| Calls | WebRTC + signaling/SFU | پیاده‌سازی نشده؛ تماس واقعی ادعا نمی‌شود |
| E2EE | پروتکل مدیریت کلید ممیزی‌شده | پیاده‌سازی نشده؛ محصول E2EE اعلام نمی‌شود |

## هویت و پروژه مشترک

- Supabase Project Ref: slwzjufipavuwcbwoyro.
- URL مورد تأیید در Vercel Production: https://slwzjufipavuwcbwoyro.supabase.co.
- Web از NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY استفاده می‌کند.
- Android از SUPABASE_URL و SUPABASE_PUBLISHABLE_KEY در local.properties استفاده می‌کند.
- هیچ Service Role یا Supabase Secret Key در کلاینت مجاز نیست.
- هر دو کلاینت باید با Supabase Auth UUID یکسان، Postgres/RLS، Realtime و bucket خصوصی مشترک کار کنند.

## جریان ورود Web

1. مرورگر signInWithOAuth({ provider: 'google' }) را با callback /auth/callback آغاز می‌کند.
2. جریان PKCE در Supabase JS نگهداری می‌شود.
3. صفحه callback کد یک‌بارمصرف را با exchangeCodeForSession مبادله می‌کند، نشست را بررسی و کد را از نشانی پاک می‌کند.
4. نشست در Storage مرورگر نگهداری و refresh می‌شود.
5. در شاخه اصلاح فعلی detectSessionInUrl=false است تا callback مالک صریح تبادل کد باشد و تبادل خودکار و دستی دو بار اجرا نشوند.

**مانع فعلی:** در پروژه زنده external.google=false است. کد کلاینت به‌تنهایی نمی‌تواند Provider را فعال کند؛ Web Client ID/Secret باید در Supabase Dashboard ثبت و redirect URI در Google Cloud مجاز شود.

## جریان ورود Android

1. Credential Manager با GOOGLE_WEB_CLIENT_ID توکن ID می‌گیرد.
2. nonce خام تصادفی تولید و SHA-256 آن به Google داده می‌شود.
3. nonce خام همراه ID Token به Supabase Auth می‌رود تا سرور آن را اعتبارسنجی کند.
4. Client Secret یا Service Role هرگز در Android قرار نمی‌گیرد.

این جریان تا ثبت Web/Android OAuth Client، SHA-1های Debug/Release، فعال‌سازی Provider و تست روی دستگاه آماده انتشار محسوب نمی‌شود.

## فایل‌ها و رسانه

- Bucket user-files خصوصی است؛ اندازه مجاز هر فایل دقیقاً ۵۰٬۰۰۰٬۰۰۰ بایت.
- نام فایل اصلی فقط در metadata ذخیره و object path با UUID تولید می‌شود.
- Android فعلاً از ByteArrayOutputStream برای خواندن فایل استفاده می‌کند؛ برای فایل‌های حجیم باید به Worker و انتقال Stream/Resumable ارتقا یابد.
- دانلود باید با نشست معتبر و URL امضاشده کوتاه‌عمر یا SDK authenticated انجام شود.
- دسترسی نهایی مالک/عضو مجاز توسط RLS و Storage policies کنترل می‌شود.

## مرز اعتماد و حفظ داده

- تمام جداول عمومی در ممیزی زنده RLS فعال دارند.
- رتبه/امتیاز/نشان فقط از سمت سرور کنترل می‌شود.
- RPC create_direct_conversation یک wrapper با سطح دسترسی محدود است.
- Migration اجراشده دوباره اجرا نمی‌شود؛ چهار Migration اولیه در تاریخچه محلی کامل نیستند.
- archive/initial_schema_draft_NOT_FOR_DEPLOY.sql و remote-state-snapshot.md قابل اجرا/بازیابی فرض نمی‌شوند.
- دیتابیس در ممیزی جاری فقط Read-only بررسی شده است.
- TLS و RLS به‌تنهایی معادل E2EE نیستند.

## امکانات آینده

گروه، کانال، موضوع، استوری، نظرسنجی، FCM، تماس WebRTC/SFU و E2EE تنها پس از بررسی Schema/API/مجوز و تست امنیتی جداگانه اجرا خواهند شد؛ هیچ Placeholder به‌عنوان قابلیت واقعی اعلام نمی‌شود.
