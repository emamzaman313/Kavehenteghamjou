# ممیزی اکوسیستم اعلان KAVEH — ۲۰ نوامبر ۲۰۲۶

## خلاصه

پروژه مسیر واقعی اعلان درون‌برنامه‌ای، ثبت توکن FCM اندروید، ارسال Push پیام خصوصی از Edge Function و کمپین‌های زمان‌بندی‌شده دارد. این اجزا هنوز یک «موتور هوشمند چندکاناله» کامل نیستند: تنظیمات کاربر فقط Push/Email را کنترل می‌کند، Push رویدادها عمدتاً فقط پیام خصوصی را پوشش می‌دهد، و ارسال Push کمپین پس از زمان‌بندی نیازمند اقدام دستی مدیر است.

## منابع و وضعیت زنده

- مخزن عمومی `emamzaman313/Kavehenteghamjou`، شاخه پیش‌فرض `main`؛ هنگام ثبت این الحاقیه، آخرین commit بررسی‌شده `f27890d619ce8877019cc97b001518ace7bea1f0` در ۲۰ نوامبر ۲۰۲۶ است. شاخه main در جریان کار قابلیت‌های وب/اندروید، دسترس‌پذیری، عملیات مرحله‌ای و بهبودهای ورود دریافت کرد.
- وب: Next.js 16، React 19، TypeScript و Supabase JS در `web/`.
- Android: Kotlin، Jetpack Compose، Supabase Kotlin SDK و Firebase Messaging در `android/`؛ شناسه برنامه `com.kaveh.avenger` و target SDK 36.
- Backend مشترک: Supabase Auth، PostgreSQL 17.12، RLS، Realtime، Storage و Edge Functions.
- Supabase `kaveh-avenger` (`slwzjufipavuwcbwoyro`) در وضعیت `ACTIVE_HEALTHY`. جداول `notifications`، `device_tokens`، `scheduled_notifications` و `user_settings` همگی RLS فعال دارند. Cron فعال `kaveh-process-scheduled-notifications` هر دقیقه اجرا می‌شود.
- Edge Functions زنده: `notification-dispatch` (JWT اجباری) و `admin-console` (احراز هویت در کد تابع). نسخه‌های زنده به‌ترتیب ۱ و ۳۴ هستند.
- Vercel پروژه `kaveh-avenger` به همین مخزن وصل است. دامنه production `kaveh-avenger.vercel.app` است؛ deployment تولیدی روی commit `f27890d...` با موفقیت READY شد. دو متغیر عمومی Supabase برای preview/production ثبت‌اند؛ مقدارها خوانده یا گزارش نشده‌اند.
- CI: Android CI و Security checks روی commit اعلان قبلی موفق شدند. Web CI روی commit جدید در این نشست اجرا نشد؛ اجرای محلی وب روی درخت تازهٔ `main` موفق بود. issue باز GitHub یافت نشد.

## جریان فعلی اعلان

1. درج پیام در دیتابیس، trigger برای اعضای واجد شرایط گفتگو، اعلان درون‌برنامه‌ای می‌سازد؛ اعضای muted یا غیرفعال از آن کنار گذاشته می‌شوند.
2. وب و Android پس از ارسال پیام، `notification-dispatch` را فراخوانی می‌کنند. تابع مالکیت پیام را از نشست کاربر اعتبارسنجی می‌کند، تنظیمات گیرنده را می‌خواند، و در صورت وجود `FCM_SERVICE_ACCOUNT_JSON` به FCM HTTP v1 ارسال می‌کند. ایمیل نیز فقط با opt-in و Secretهای Resend ارسال می‌شود.
3. Android مجوز Android 13+ می‌گیرد، توکن را با RPC احراز‌شده ثبت می‌کند، کانال‌های اعلان عادی/فوری می‌سازد و پیام FCM را نمایش می‌دهد.
4. Cron دیتابیس کمپین سررسیدشده را به اعلان داخل‌برنامه‌ای تبدیل می‌کند. Push کمپین در صف می‌ماند تا مدیر آن را از پنل پردازش کند؛ ارسال خودکار Push کمپین به Cron داخلی متصل نیست.

## کمبودها و ریسک‌های مشخص

- سرویس Android برای کلیک اعلان Intent حاوی `click_url` می‌سازد، اما `MainActivity` و صفحه گفتگو آن را مصرف نمی‌کردند. Push پیام نیز لینک گفتگو را در data payload نمی‌فرستاد؛ بنابراین کلیک به گفتگوی صحیح نمی‌رسید.
- ثبت توکن هنگام ورود/بازشدن برنامه انجام می‌شود؛ `FirebaseMessagingService.onNewToken` پیاده‌سازی نشده است.
- تنظیمات کاربر فقط کلیدهای کلی Push و Email را دارد؛ دسته‌ها، ساعت سکوت، timezone، digest، سقف اعلان، رفتار dedupe و تنظیمات قفل صفحه ندارند.
- تابع ارسال پیام، صف تحویل پایدار/ثبت تلاش idempotent، backoff و dead-letter برای Push ندارد. پذیرفته‌شدن پیام توسط FCM نیز تضمین نمایش در گوشی نیست.
- Firebase MCP در این نشست در دسترس نبود. مقادیر GitHub Actions Variables/Secrets و Supabase Edge Function Secrets قابل خواندن از ابزارهای متصل‌شده نبودند؛ بنابراین وضعیت واقعی Firebase project، پیکربندی app، `FCM_SERVICE_ACCOUNT_JSON` و وجود توکن گوشی تأیید نشده است. هیچ secret یا دادهٔ خصوصی خوانده/منتشر نشد.
- Supabase Security Advisor دو هشدار زنده دارد: حفاظت گذرواژه‌های افشاشده خاموش است؛ `public.create_support_ticket(...)` یک تابع `SECURITY DEFINER` قابل اجرا برای کاربران واردشده است و باید مجوز/طراحی آن بازبینی شود.

## تغییر اجراشده در این مرحله

- پیام FCM اکنون data payload حاوی مسیر داخلی `/chat?conversation_id=...` می‌فرستد.
- Android اکنون route داخلی را parse و اعتبارسنجی می‌کند، با کلیک روی Push برنامه را به همان گفتگو می‌برد، و برای مسیرهای عمومی به صندوق اعلان می‌رود. URL خارجی و شناسه نامعتبر به‌عنوان deep link پذیرفته نمی‌شوند.
- متن خصوصی پیام از Push/ایمیل پیش‌نمایش حذف شد؛ اعلان فقط پیام جدید را اعلام می‌کند و محتوای واقعی پس از ورود به گفتگو دیده می‌شود. رویداد پیام با اولویت و کانال Android فوری ارسال می‌شود.
- تست واحد برای مسیر گفتگوی معتبر، inbox، URL خارجی و UUID نامعتبر اضافه شد.

## نتیجه بررسی محلی

- اجرای `:android:app:testDebugUnitTest` در این محیط پیش از کامپایل کد متوقف شد: artifact پلاگین Android Gradle `com.android.application:9.3.1` از repositoryهای تنظیم‌شده resolve نشد. Android SDK در محیط نیز نصب/تنظیم نشده و Firebase CLI در دسترس نیست؛ بنابراین تست دستگاه، APK و اتصال Firebase از این محیط تأیید نشده است.

## نقشه توسعه اولویت‌بندی‌شده

1. **تکمیل تحویل پایه:** secret/config Firebase و GitHub build variables را در منابع مالک تأیید؛ token refresh و unregister چرخه‌عمر را کامل؛ push click را روی دستگاه واقعی در foreground/background و حالت بسته عادی آزمایش کن.
2. **حریم خصوصی و ترجیحات:** تنظیمات backend برای دسته‌های اعلان، ساعت سکوت/timezone و متن صفحه قفل؛ اعمال تنظیمات در Edge Function با حفظ پیام‌های امنیتی/فوری.
3. **قابلیت اتکای ارسال:** ثبت تحویل/خطا، idempotency، retry/backoff و پاک‌سازی token نامعتبر؛ Push کمپین را به پردازش زمان‌بندی‌شدهٔ امن متصل کن، پس از پیکربندی Secret و آزمون staging.
4. **پوشش رویدادها:** اعلان‌های follow/comment/mention و moderation را از رویدادهای دیتابیس به صف پایدار و policy-based منتقل کن؛ اعلان‌های کم‌اهمیت را تجمیع کن.
5. **Web Push و digest:** subscription و Service Worker با رضایت صریح مرورگر، سپس خلاصه روزانه/هفتگی و گزارش‌های قابل اتکای کمپین.
6. **مرکز فرماندهی:** شمارش صف/تحویل/بازشدن بر اساس داده واقعی، audit log عملیات ارسال، توقف اضطراری و کنترل role-based سمت سرور.

## حدود این مرحله

هیچ Migration یا تغییر دادهٔ Supabase، تنظیم Firebase Secret، ارسال کمپین عمومی یا انتشار Android انجام نشد. deployment وب به `main` فعلی انجام شد. تحویل واقعی FCM هنوز به متغیرهای Firebase و secret سرویس وابسته است و تست گوشی واقعی انجام نشده است.
