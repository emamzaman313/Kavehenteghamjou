# فهرست قابلیت‌ها و ممیزی مرجع Telegram Android

این فهرست وضعیت مشاهدهٔ سورس مرجع را از وضعیت پیاده‌سازی کاوه جدا می‌کند. مخزن رسمی قابل‌خواندن بود، اما clone کامل و همهٔ Submoduleها دریافت نشد؛ پس این سند گزارش ممیزی اولیه است، نه ادعای ممیزی خط‌به‌خط کل repository.

| قابلیت | مرجع رسمی قابل مشاهده | وابستگی تلگرام | استفادهٔ مستقیم در محصول مستقل | تصمیم کاوه | وضعیت کاوه |
|---|---|---|---|---|---|
| ساختار چندماژولی Android | `settings.gradle`, `TMessagesProj`, `TMessagesProj_App*` | کم | ساختار Gradle فقط الگو | Kotlin/Compose تک‌ماژولی اولیه | اسکلت نوشته شده |
| ارسال پیام | `SendMessagesHelper` | زیاد؛ MTProto/TLRPC | پایین | API/Realtime مستقل | فقط schema |
| دریافت/همگام‌سازی | `MessagesController`, `ConnectionsManager` | زیاد | پایین | Realtime/Postgres | publication آماده، client ناقص |
| UI چت | `ChatActivity` | متوسط تا زیاد | پایین؛ View-based و وابسته | Compose از نو | نوشته نشده |
| ذخیره پیام | `MessagesStorage` | زیاد؛ account/storage مدل تلگرام | پایین | cache/sync مستقل (Room بعداً) | بررسی کامل مرجع نشده |
| آپلود/دانلود | `FileLoader` | زیاد؛ TL Document/DC | ایدهٔ صف و progress قابل الهام | Supabase Storage + WorkManager | upload مستقیم کدنویسی شده؛ build/test نشده |
| thumbnail و cache رسانه | `ImageLoader` | متوسط تا زیاد | کپی مستقیم توصیه نمی‌شود | Coil/Media3 | بعداً |
| حساب و تنظیمات | `UserConfig` | زیاد | پایین | Supabase Auth + profiles | کد ورود و DB trigger |
| لایه شبکه | `ConnectionsManager` | بسیار زیاد؛ MTProto و native | نامناسب | Supabase SDK | backend independent |
| تماس | `VoIPController` و JNI | بسیار زیاد | پایین | WebRTC/SFU | بعداً |
| گروه/کانال | controllers و TL models | زیاد | مدل و protocol نامناسب برای reuse | schema و permission مستقل | schema اولیه |
| استوری | سورس مرجع در این مرحله کامل ممیزی نشده | بررسی‌نشده | تعیین‌نشده | مدل مستقل stories | schema اولیه |
| اعلان | `NotificationsController` | زیاد | پایین | notifications table + FCM | DB آماده، FCM نه |
| مخاطبان | `ContactsController` | account/permission dependent | پایین | discovery با username؛ contacts مجاز اختیاری | بعداً |
| Google Login | معادل محصولی در Telegram ref هدف این مأموریت نیست | ندارد | ندارد | Credential Manager + Supabase Auth | کد native نوشته، OAuth test نشده |
| رتبه و نشان | محصول‌اختصاصی | ندارد | ندارد | قواعد server-authoritative | schema و seed |

## کلاس‌ها/فایل‌های واقعی که روی آن‌ها نمونه‌برداری شد

- `MessagesController.java` (حدود ۲۵٬۵۵۲ خط در نمایش GitHub)
- `SendMessagesHelper.java` (حدود ۱۲٬۲۶۱ خط)
- `ChatActivity.java` (فایل بسیار بزرگ UI)
- `LaunchActivity.java` (حدود ۹٬۲۴۰ خط)
- `FileLoader.java` (صف‌های فایل، progress/delegate و عملیات بارگیری/ارسال)
- `ImageLoader.java` (cache و thumbnail/taskهای تصویر)
- `ConnectionsManager.java` (لایه ارتباط با native/شبکه)
- `UserConfig.java` (وضعیت حساب و تنظیمات)
- `VoIPController.java` (JNI/native bridge تماس)

بدنهٔ کامل همهٔ فایل‌ها، `MessagesStorage`, `NotificationsController`, `ContactsController`, Stories و Polls هنوز ممیزی نشده‌اند.

## جدول دامنه محصول و وضعیت فعلی

| دامنه | Schema در Supabase | Android | وضعیت نهایی |
|---|---|---|---|
| پروفایل و تنظیمات | `profiles`, `user_settings` | shell/Google session | ناقص؛ فرم profile هنوز نیست |
| رتبه و Badge | `rank_levels`, `user_rank_state`, `badges`, `user_badges` | ندارد | فقط schema/seed |
| دنبال‌کردن | `follows` | ندارد | فقط schema |
| گفتگوهای مستقیم | `conversations`, `conversation_members`, `direct_conversation_pairs` | ندارد | RPC ایمن ساخته شده؛ UI ندارد |
| پیام و پیوست | `messages`, `message_attachments` | ندارد | فقط schema |
| گروه/موضوع/کانال | `group_spaces`, `chat_topics`, `channel_spaces` | ندارد | schema اولیه |
| فایل‌ها | `file_assets`, Storage bucket `user-files` | Document picker + upload code | نوشته شده؛ build و network test نشده |
| فید و تعامل | `posts`, `post_media`, `post_reactions`, `comments` | placeholder | schema آماده، UI/logic ناقص |
| استوری | `stories`, `story_views` | ندارد | schema اولیه |
| نظرسنجی | هنوز schema کامل ندارد | ندارد | برنامه‌ریزی‌شده |
| ذخیره‌شده‌ها | `saved_items` | ندارد | فقط schema |
| اعلان‌ها | `notifications`, `device_tokens` | ندارد | DB آماده، FCM ناقص |
| گزارش تخلف | `reports` | ندارد | فقط schema |
| جست‌وجو | ایندکس/موتور کامل ندارد | ندارد | برنامه‌ریزی‌شده |
| تماس صوتی/تصویری | ندارد | ندارد | برنامه‌ریزی‌شده |

## مجوز مرجع Telegram

سورس رسمی دارای GNU GPL v2 / v2-or-later اطلاع‌رسانی‌شده است. در این پروژه هیچ کد Telegram کپی نشده؛ از ایده‌ها و ساختارها به‌عنوان مرجع استفاده شده است. پیش از هر کپی/اقتباس کد، مجوز اصلی و مجوز هر Submodule باید جداگانه بررسی و تکالیف GPL اجرا شوند.
