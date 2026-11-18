# API و قراردادهای اولیه

API محصول فعلاً بر Supabase Data API، Storage و Realtime استوار است؛ هنوز REST backend با versioning اختصاصی یا مجموعه Edge Functionهای production-ready منتشر نشده است.

## جداول اصلی

- Identity: `profiles`, `user_settings`
- Social graph: `follows`, `posts`, `post_media`, `post_reactions`, `comments`, `stories`, `story_views`
- Messaging: `conversations`, `conversation_members`, `direct_conversation_pairs`, `messages`, `message_attachments`, `group_spaces`, `channel_spaces`, `chat_topics`
- Files: `file_assets` + private Storage bucket `user-files`
- Trust & safety: `reports`, `notifications`, `device_tokens`
- Gamification: `rank_levels`, `user_rank_state`, `badges`, `user_badges`

## RPC فعلی

`create_direct_conversation(p_other_user_id uuid) -> uuid`

- فقط role احراز هویت‌شده اجازهٔ اجرای wrapper را دارد.
- wrapper عمومی `SECURITY INVOKER` است.
- منطق privileged داخل `private.create_direct_conversation` و خارج از schemaهای exposed قرار دارد.
- `auth.uid()` اجباری است؛ شروع گفتگو با خود یا مخاطب غیرقابل‌دسترسی رد می‌شود.
- UUIDها canonical شده و advisory lock از ایجاد دو گفتگو تکراری هم‌زمان جلوگیری می‌کند.

## قواعد امنیتی

- تمام درخواست‌های محصول نیازمند JWT معتبرند.
- RLS و مجوزهای ستونی مرز اصلی authorization هستند؛ مخفی‌کردن UI امنیت ایجاد نمی‌کند.
- فایل حداکثر ۵۰٬۰۰۰٬۰۰۰ بایت است؛ bucket خصوصی و بدون allowlist پسوند است. خواندن فایل‌های پیوست‌شده از Storage بر اساس مالکیت، عضویت گفتگو و مخاطب پست/استوری در policy سمت سرور کنترل می‌شود.
- نام اصلی در `file_assets.original_name` ذخیره می‌شود؛ object path با UUID ساخته می‌شود.
- امتیاز/رتبه و Badge از کلاینت قابل نوشتن نیستند.
- service-role فقط در محیط سرور و هرگز در APK استفاده می‌شود.

## Realtime

- `messages`: تغییرات پیام
- `conversation_members`: تغییرات وضعیت خواندن و cursor اعضا
- `notifications`: اعلان‌های حساب
- `posts`: تغییرات feed

Web و Android در سورس به کانال Realtime پیام‌ها متصل‌اند و هنگام دریافت رویداد، پیام‌ها و فهرست گفتگو را تازه می‌کنند. هر دو کلاینت یک کانال جداگانه برای رویدادهای `messages` و `conversation_members` دارند تا پیش‌نمایش و unread count گفتگوهای غیرفعال نیز به‌روز شود. Android هنگام خروج از صفحه کانال‌های صفحه را آزاد می‌کند. وضعیت Read از `conversation_members.last_read_at` استخراج می‌شود؛ مقدار cursor از آخرین پیام دریافت‌شده از سرور گرفته می‌شود، نه ساعت دستگاه.

**وضعیت آزمون:** Android Unit Tests و Build در GitHub Actions در Run `44318216746` موفق‌اند؛ Web TypeScript، ESLint، Vitest و Production Build در Run `44317894080` نیز موفق‌اند. بااین‌حال، تبادل end-to-end بین دو حساب مستقل هنوز آزمایش نشده، چون پروژه Supabase هنگام آخرین بررسی صفر کاربر Auth و صفر پروفایل داشت. بنابراین Realtime در محیط واقعی چندکاربره را هنوز تأییدشده اعلام نمی‌کنیم.

فعال‌بودن publication به‌تنهایی مجوز دسترسی نمی‌دهد؛ RLS باید هم‌زمان رعایت شود.
