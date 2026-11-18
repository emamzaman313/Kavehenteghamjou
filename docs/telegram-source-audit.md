# گزارش ممیزی اولیه سورس رسمی Telegram Android

تاریخ بررسی: ۱۸ نوامبر ۲۰۲۶ (UTC+03:30)

## منبع و محدودیت بررسی

مخزن رسمی معرفی‌شده: [DrKLO/Telegram](https://github.com/DrKLO/Telegram)، شاخهٔ `master`.

دریافت کامل `git clone --recursive --shallow-submodules` در محیط اجرای فعلی ممکن نشد؛ محیط ترمینال DNS/شبکهٔ خروجی به `github.com` نداشت. اتصال GitHub برای خواندن برخی فایل‌های مخزن و صفحات رسمی وب برای خواندن صفحات Source استفاده شد. بنابراین این یک **ممیزی اولیهٔ مبتنی بر فایل‌های واقعی قابل مشاهده** است، نه ادعای بررسی خط‌به‌خط تمام مخزن یا Submoduleها. Commit hash و وضعیت همهٔ Submoduleها در این محیط ثبت نشده‌اند.

## ساختار قابل مشاهده

فایل [settings.gradle](https://github.com/DrKLO/Telegram/blob/master/settings.gradle) ماژول‌های زیر را معرفی می‌کند:

- `:TMessagesProj`
- `:TMessagesProj_App`
- `:TMessagesProj_AppHuawei`
- `:TMessagesProj_AppHockeyApp`
- `:TMessagesProj_AppStandalone`
- `:TMessagesProj_AppTests`

در ریشهٔ مخزن، پوشه‌های `TMessagesProj_Modules`, `Tools`, `buildSrc` و `gradle/wrapper` نیز در صفحهٔ مخزن قابل مشاهده‌اند. فایل `TMessagesProj/build.gradle` از ماژول Android Library، ماژول build plugin اختصاصی و External Native Build با CMake استفاده می‌کند و وابستگی‌ها/کدهای Native شامل WebRTC، FFmpeg، libvpx، OpenH264، BoringSSL، SQLite و اجزای دیگر را فهرست می‌کند. این ساختار یک کلاینت Android بزرگ و Native-heavy است، نه یک backend مستقل آماده.

## کلاس‌ها و فایل‌های واقعی بررسی‌شده

| حوزه | کلاس/فایل واقعی | آنچه از کد قابل مشاهده است | وابستگی و امکان استفاده در محصول مستقل |
|---|---|---|---|
| مدیریت گفتگو و پیام | `org.telegram.messenger.MessagesController` | فایل واقعی با حدود ۲۵٬۵۵۲ خط در GitHub نمایش داده شده است | به AccountInstance/TLRPC و مدل سرور تلگرام گره خورده؛ فقط الگوی orchestration قابل مطالعه است |
| ارسال پیام/رسانه | `SendMessagesHelper` | فایل واقعی با حدود ۱۲٬۲۶۱ خط وجود دارد | منطق ارسال مبتنی بر Telegram TL/MTProto؛ برای backend جدید بازنویسی شود |
| بارگیری و آپلود فایل | `FileLoader` | صف‌های فایل کوچک/بزرگ، اولویت، عملیات upload/download، cache و مدل `TLRPC.Document` در فایل دیده می‌شود | معماری صف/اولویت/لغو قابل الهام است؛ شبکه، مدل فایل و state به تلگرام وابسته‌اند |
| تصویر و Thumbnail | `ImageLoader` | مدیریت taskهای تصویر و تولید thumbnail/cache مشاهده شد | اصول cache و thumbnail قابل اقتباس مفهومی؛ کد مستقیماً کپی نشود |
| UI گفت‌وگو | `org.telegram.ui.ChatActivity` | فایل واقعی UI با اندازهٔ حدود ۲٫۵ مگابایت | UI Android سفارشی تلگرام است؛ طراحی مستقل با Compose مناسب‌تر است |
| Activity اصلی | `org.telegram.ui.LaunchActivity` | فایل واقعی با حدود ۹٬۲۴۰ خط | بسیار گسترده و وابسته به Navigation و سرویس تلگرام؛ بازنویسی |
| لایه شبکه | `org.telegram.tgnet.ConnectionsManager` | حدود ۱٬۵۵۴ خط؛ نوع اتصال، صف اجرا و فراخوانی native دیده می‌شود | هستهٔ ارتباطی اختصاصی Telegram/MTProto؛ کنار گذاشته شود |
| ذخیره‌سازی کاربر | `UserConfig` | حساب‌های چندگانه، شناسه کاربر فعلی، تنظیمات و پرچم‌های گفتگو/اعلان/Push | مفهوم تنظیمات محلی قابل استفاده است؛ مدل حساب و داده با سیستم مستقل جایگزین شود |
| تماس | `org.telegram.messenger.voip.VoIPController` | JNI/native calls مانند `nativeInit`, `nativeStart`, `nativeConnect`, `nativeSetEncryptionKey` قابل مشاهده است | به کد native و زیرساخت تماس تلگرام متکی؛ WebRTC/SFU مستقل لازم است |
| ذخیره‌سازی پیام | `MessagesStorage` | به‌عنوان کنترلر وابسته در معماری account مشاهده/ارجاع شده، ولی ممیزی کامل SQL و schema انجام نشده | ساختار cache/local database را می‌توان بررسی کرد؛ schema و sync جدید نوشته شود |
| اعلان‌ها و مخاطبان | `NotificationsController`, `ContactsController` | نام‌ها/نقش‌ها در معماری پروژه قابل جست‌وجو/مراجعه‌اند؛ بررسی کامل بدنه در این مرحله انجام نشده | ایده‌ها قابل انتقال؛ Push و مخاطبان باید با سرویس/مجوزهای محصول جدید بازنویسی شوند |

## نتیجه معماری

- Telegram Android یک کلاینت است. FAQ رسمی تلگرام تصریح می‌کند که کلاینت‌ها متن‌بازند، ولی کد سرور تلگرام منتشر نشده است؛ بنابراین از این مخزن نمی‌توان backend مستقل تلگرام را استخراج کرد.
- `ConnectionsManager`, `TLRPC`, `AccountInstance`, `UserConfig` و controllerهای account-scoped اتصال عمیق به شبکه/حساب تلگرام دارند.
- `FileLoader` یک الگوی قابل توجه برای صف‌های جداگانهٔ کوچک/بزرگ، اولویت و پیشرفت آپلود/دانلود دارد؛ ولی پیاده‌سازی مستقیمش برای Supabase مناسب نیست.
- UI عمدتاً View/Activity سفارشی Android است؛ برای طراحی جدید و توسعهٔ سریع‌تر، Compose انتخاب شده است.
- بخش تماس دارای JNI/native bridge است و نباید «بدون backend و زیرساخت» کپی شود.

## مجوز

`LICENSE` رسمی مخزن، GNU GPL Version 2 را ارائه می‌کند و صفحهٔ رسمی Telegram Apps، مجوز Android را GNU GPL v2 or later معرفی می‌کند. اگر کد یا فایل مشتق‌شده از Telegram در محصول توزیع‌شده کپی شود، تکالیف GPL از جمله حفظ اعلان‌ها و فراهم‌کردن متن متناظر سورس طبق شروط مجوز باید رعایت شود. در این پروژه فعلاً **هیچ کد منبع Telegram کپی نشده است**؛ فقط ساختار و الگوهای مهندسی بررسی شده‌اند.

## کارهای ممیزی باقیمانده

- دریافت کامل clone و ثبت commit SHA.
- بررسی همهٔ Submoduleها و مجوز تک‌تک آن‌ها.
- بررسی خط‌به‌خط `MessagesStorage`, `NotificationsController`, `ContactsController`, media controllers, stories, polls, channels, topics و UIهای مربوط.
- اجرای Build رسمی در محیط دارای Android SDK/NDK و تمام پیکربندی‌های Firebase/BuildVars لازم.
- استخراج ماتریس دقیق قابلیت با آزمون‌های واحد/یکپارچهٔ سورس؛ این گزارش به‌تنهایی چنین آزمونی نیست.
