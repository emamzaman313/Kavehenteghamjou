# راه‌اندازی ارسال Push و ایمیل کاوه انتقامجو

این مخزن اکنون مسیر ثبت توکن FCM در Android، دریافت اعلان Firebase در برنامه، و Edge Function امن برای ارسال Push و ایمیل را دارد. ارسال واقعی تا زمانی که کلیدهای سرویس خارجی در محل امن قرار نگیرند فعال نمی‌شود.

## ۱) Firebase Cloud Messaging برای Android

1. در Firebase Console یک پروژه بسازید یا پروژه موجود را باز کنید.
2. یک Android App با Package name دقیق `com.kaveh.avenger` ثبت کنید.
3. در Project settings اطلاعات Android app را بردارید:
   - Firebase App ID
   - API Key
   - Project ID
   - Cloud Messaging Sender ID
4. در GitHub مخزن `emamzaman313/Kavehenteghamjou` به مسیر Settings → Secrets and variables → Actions → Variables بروید و این Repository Variables را بسازید:
   - `FIREBASE_APP_ID`
   - `FIREBASE_API_KEY`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_SENDER_ID`
5. در Firebase Console → Project settings → Service accounts یک کلید خصوصی برای سرویس ارسال بسازید. فایل JSON را در GitHub یا مخزن قرار ندهید.
6. در Supabase Dashboard → Edge Functions → Secrets این Secret را اضافه کنید:
   - `FCM_SERVICE_ACCOUNT_JSON` = محتوای کامل JSON حساب سرویس Firebase
7. پس از افزودن چهار GitHub Variable، اجرای Android CI را دوباره اجرا کنید و APK جدید را نصب کنید. برنامه مجوز اعلان Android 13+ را می‌گیرد و توکن دستگاه را از طریق RPC امن `register_device_token` ثبت می‌کند.

Firebase App ID و API Key و Project ID شناسه‌های سمت کلاینت هستند؛ کلید خصوصی Service Account فقط در Supabase Edge Function Secrets نگهداری شود.

## ۲) ایمیل اعلان‌ها

1. در سرویس ایمیل Resend یک دامنه ارسال را تأیید کنید.
2. یک API Key برای ارسال ایمیل ایجاد کنید.
3. در Supabase Dashboard → Edge Functions → Secrets این موارد را اضافه کنید:
   - `RESEND_API_KEY` = کلید Resend
   - `NOTIFICATION_FROM_EMAIL` = فرستنده تأییدشده، مانند `Kaveh <notifications@example.com>`
4. کاربر در صفحه اعلان‌های وب، دریافت ایمیل را جداگانه فعال می‌کند. ایمیل فقط برای کاربران opt-in ارسال می‌شود.

## ۳) استقرار و رفتار

- Edge Function: `notification-dispatch`
- احراز هویت JWT اجباری است؛ تابع فقط پیام متعلق به کاربر فراخواننده را پردازش می‌کند.
- پس از ارسال پیام در وب یا Android، تابع فراخوانی می‌شود.
- پیام داخل برنامه مستقل از Push و ایمیل باقی می‌ماند.
- توکن‌های FCM نامعتبر حذف می‌شوند.
- در نبود هر یک از کلیدهای سرویس، آن کانال ارسال غیرفعال می‌ماند و پیام‌رسانی اصلی مختل نمی‌شود.

## ۴) محافظت رمزهای افشاشده

پروژه فعلی Supabase روی پلن Free است. بررسی رمزهای افشاشده با HaveIBeenPwned در Supabase Auth فقط در Pro و بالاتر در دسترس است؛ بنابراین این گزینه را نمی‌توان با SQL یا کد برنامه دور زد. برای فعال‌سازی کامل باید پلن پروژه ارتقا یابد و سپس در Authentication → Sign In / Providers → Email گزینه Prevent use of leaked passwords روشن شود.

تا آن زمان، در Supabase Dashboard → Authentication → Sign In / Providers → Email، حداقل طول رمز را روی ۱۰ و الزام حروف کوچک و بزرگ، عدد و نماد را فعال کنید؛ این تنظیمات پایه در پلن Free قابل استفاده‌اند و سمت سرور اعمال می‌شوند. فرم ثبت‌نام وب و Android نیز همین سیاست را بررسی می‌کند. این موارد جایگزین بررسی رمزهای افشاشده با HaveIBeenPwned نیستند.
