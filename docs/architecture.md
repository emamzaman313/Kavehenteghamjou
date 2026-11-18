# معماری فنی کاوه انتقامجو

## اصول

کاوه انتقامجو یک محصول مستقل است؛ به حساب تلگرام، MTProto یا سرورهای تلگرام وابستگی ندارد. Web و Android باید با یک Supabase Project و شناسه یکسان کاربر تعامل کنند. همه تصمیم‌های مجوز سمت سرور و RLS هستند؛ کلاینت فقط Publishable Key دارد.

## اجزای سیستم

| لایه | فناوری | وضعیت جاری |
|---|---|---|
| Android UI | Kotlin، Jetpack Compose، Material 3 | پوسته پنج‌بخشی و صفحات ورود/چت/فایل در سورس؛ Explore/Profile هنوز Placeholder |
| Web UI | Next.js App Router، React، TypeScript | صفحات خانه، چت، فایل، اکتشاف، پروفایل، اعلان و تنظیمات در سورس |
| Android Identity | Credential Manager، Google ID Token، nonce | جریان کدنویسی شده؛ Client ID در CI خالی و Google OAuth واقعی تست نشده |
| Web Identity | Supabase JS، OAuth، PKCE | پیاده‌سازی و تست واحد خطاها؛ Provider واقعی نیازمند تنظیم مالک |
| Auth | Supabase Auth | پروژه مشترک فعال؛ تعداد کاربران در ممیزی اخیر صفر |
| Database | PostgreSQL 17 | ۲۶ جدول عمومی؛ ۲۶/۲۶ دارای RLS |
| Authorization | PostgreSQL RLS و محدودیت مجوزها | ۶۸ Policy در ممیزی اخیر؛ Security Advisor بدون finding |
| Messaging | conversations، conversation_members، messages | چت مستقیم، پیام، Realtime، صفحه‌بندی و Read cursor در کد Web/Android |
| Social | posts، comments، reactions، follows، notifications | Web screens به DB متصل‌اند؛ اجرای چندکاربره هنوز E2E نشده؛ Android بخش‌های اجتماعی ناقص |
| Storage | Supabase Private Storage، bucket `user-files` | سقف واقعی ۵۰٬۰۰۰٬۰۰۰ بایت؛ Android upload/download اولیه دارد |
| Push | Firebase Cloud Messaging | پیاده‌سازی نشده |
| Calls | WebRTC و signaling/SFU | پیاده‌سازی نشده |

## هویت و نشست

### Android
جریان طراحی‌شده: Credential Manager → Google ID Token → Supabase Auth. مقدار nonce خام با SecureRandom تولید می‌شود؛ hash آن به Credential Manager داده می‌شود و مقدار خام طبق قرارداد SDK همراه ID Token به Supabase می‌رود. Session توسط Supabase Kotlin SDK مدیریت می‌شود. کد خطای Google در UI اکنون پیام‌های امن برای Provider غیرفعال، لغو و قطع شبکه نشان می‌دهد.

### Web
Supabase JS از `flowType: 'pkce'`، `persistSession` و `autoRefreshToken` استفاده می‌کند. مسیر `/auth/callback` authorization code را به session تبدیل می‌کند. شکست Provider، پارامترهای خطای query/hash و خطای شبکه پیام قابل‌فهم دارند. این تغییرات تست شده‌اند، اما ورود واقعی Google تا فعال‌سازی/تأیید Provider، Client ID و Client Secret در پنل Supabase قابل ادعا نیست.

## چت و Realtime

- ساخت گفتگوی مستقیم با RPC موجود `create_direct_conversation` و کنترل عضویت سمت سرور.
- ارسال/خواندن پیام و subscription روی `messages` و `conversation_members`.
- صفحه‌بندی پیام‌های قدیمی، پیش‌نمایش آخرین پیام، شمارنده unread و read cursor.
- نشان «ارسال شد» صرفاً به معنی موفقیت درج پیام از سمت کلاینت است؛ Delivered واقعی نیست.
- typing indicator، حضور Online معتبر، Reply، edit/delete کامل، جست‌وجوی پیام، idempotency key و retry پایدار هنوز تکمیل نشده‌اند.

## فایل و رسانه

- bucket خصوصی `user-files`؛ سقف سمت سرور و metadata برابر ۵۰٬۰۰۰٬۰۰۰ بایت.
- metadata در `file_assets` و SHA-256 ثبت می‌شود.
- Android کد فعلی محتوای فایل را به‌صورت کامل در حافظه Buffer می‌کند و آپلود Storage معمولی انجام می‌دهد؛ این روش برای فایل‌های بزرگ ایده‌آل نیست.
- WorkManager، stream-based upload/download، resumable multipart، لغو عملیات و پیشرفت واقعی بایت‌به‌بایت برای Android باقی مانده است.
- هر فایل باید با سیاست دسترسی RLS و Storage فقط برای مالک و اعضای مجاز قابل دریافت باشد.

## پایگاه داده و مهاجرت

پروژه زنده Ref برابر `slwzjufipavuwcbwoyro` دارد. ده Migration در Remote Ledger ثبت شده‌اند. چهار Migration نخست در تاریخچه محلی بازیابی نشده‌اند؛ Snapshot مستنداتی جایگزین backup یا migration نیست. هر تغییر ساختاری جدید باید migration مستقل، قابل بازبینی و با تست RLS داشته باشد. هیچ migration اجراشده‌ای را دوباره اجرا نکنید.

## امنیت

- RLS برای همه جدول‌های public فعال است.
- امتیاز، rank و badge نباید از کلاینت قابل ارتقا باشند.
- RPC عمومی ساخت گفتگوی مستقیم wrapper از نوع SECURITY INVOKER است؛ منطق حساس در schema خصوصی و با بررسی auth.uid اجرا می‌شود.
- Service Role Key، Google Client Secret و keystore خصوصی در کلاینت یا مخزن قرار نمی‌گیرند.
- E2EE ادعا نشده است؛ برای آن پروتکل استاندارد ممیزی‌شده و مدیریت کلید لازم است.

## محدودیت‌های شناخته‌شده

تعداد کاربران Auth/Profiles در ممیزی read-only اخیر صفر بود؛ بنابراین جریان دوحسابی واقعی و اشتراک فایل بین دو حساب هنوز اثبات نشده است. Android Explore/Profile و انتشار اجتماعی Placeholder/ناقص‌اند. Push، گروه/کانال، استوری و تماس به‌عنوان قابلیت آماده معرفی نمی‌شوند.
