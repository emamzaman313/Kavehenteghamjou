# وضعیت واقعی پیاده‌سازی و آزمون کاوه انتقامجو

آخرین بازبینی: ۱۸ نوامبر ۲۰۲۶

این گزارش بین «کد موجود»، «Build موفق» و «آزمایش end-to-end با کاربران واقعی» تفاوت می‌گذارد. Build موفق به‌تنهایی اثبات‌کننده کارکرد چندکاربره نیست.

## GitHub

- مخزن اصلی: https://github.com/emamzaman313/Kavehenteghamjou
- شاخه فعال: `main`
- آخرین Commit کد: `a3983ef065511b9c260352e3d14aa8b8e05ac68d` — پیش‌نمایش آخرین پیام و شمارنده خوانده‌نشده در فهرست چت Android.
- شاخه قدیمی `feature/phase-1-foundation` در مخزن جدید وجود ندارد.
- ZIP انتقالی فاقد پوشه `.git` بود و Commitهای قدیمی اعلام‌شده از API مخزن جدید قابل بازیابی نبودند؛ بنابراین تاریخچه Git قدیمی به این مخزن منتقل‌شده محسوب نمی‌شود.
- سورس Android، Web، Supabase، Migrationهای قابل دسترس، Workflowها و مستندات در مخزن ثبت شده‌اند.
- Gradle Wrapper رسمی در مخزن موجود است.

## Supabase زنده

- پروژه: `kaveh-avenger` — Project ref: `slwzjufipavuwcbwoyro`
- وضعیت: `ACTIVE_HEALTHY`، region: `ap-northeast-1`، PostgreSQL 17.12.
- ۲۶ جدول عمومی؛ هر ۲۶ جدول دارای RLS فعال.
- ۶۸ Policy عمومی؛ دسترسی مستقیم table/column برای نقش `anon`: صفر.
- تعداد Auth users، profiles، posts، messages، file assets و Storage objects در آخرین بازبینی: صفر.
- Bucket `user-files` خصوصی و سقف واقعی آن دقیقاً `50,000,000` بایت است.
- Realtime publication شامل `conversation_members`، `messages`، `notifications` و `posts` است.
- RPC `public.create_direct_conversation(p_other_user_id uuid)` موجود است؛ wrapper از نوع SECURITY INVOKER است و منطق privileged در schema خصوصی قرار دارد.
- Security Advisor و Health Advisor بدون finding بودند.
- Performance Advisor: ۳۳ پیام INFO برای ایندکس‌های استفاده‌نشده و یک هشدار چند SELECT policy روی `file_assets`. هیچ Policy یا Index بدون تحلیل و تست حذف نشده است.

## Migrationها

Remote migration ledger ده نسخه دارد:

1. `20261118082218` — `kaveh_foundation_schema`
2. `20261118082313` — `kaveh_message_edit_permissions`
3. `20261118083706` — `kaveh_rls_policy_hardening`
4. `20261118084046` — `kaveh_membership_and_privilege_hardening`
5. `20261118084455` — `kaveh_direct_conversation_rpc`
6. `20261118085149` — `kaveh_direct_pair_visibility_and_index`
7. `20261118090155` — `kaveh_hide_privileged_direct_conversation_rpc`
8. `20261118091018` — `kaveh_shared_file_read_access`
9. `20261118124842` — `kaveh_conversation_last_message_at_trigger`
10. `20261118131339` — `kaveh_realtime_conversation_read_receipts`

چهار Migration ابتدایی هنوز فایل اجرایی اصلی‌شان در مخزن بازیابی نشده‌اند. شش Migration بعدی در `supabase/migrations/` وجود دارند. فایل `archive/initial_schema_draft_NOT_FOR_DEPLOY.sql` یک draft قدیمی و غیرقابل اجراست؛ آن را روی پروژه زنده اجرا نکنید. `remote-state-snapshot.md` Snapshot مستنداتی است، نه Migration یا Backup قابل replay.

در آخرین بازبینی read-only هیچ DDL یا داده‌ای تغییر داده نشد و Migrationهای ثبت‌شده دوباره اجرا نشدند.

## سیستم چت

### Web — در سورس

- ساخت گفتگوی خصوصی با RPC موجود، فهرست گفتگوها و تاریخچه پیام.
- ارسال/دریافت پیام و Supabase Realtime.
- Read cursor و وضعیت خوانده‌شدن از `conversation_members.last_read_at`.
- پیش‌نمایش آخرین پیام و unread count در فهرست گفتگوها.
- Subscription جداگانه برای پیام‌ها و تغییرات اعضا تا inbox هنگام دریافت پیام در گفتگوی غیرفعال تازه شود.
- صفحه‌بندی پیام‌های قدیمی و بارگذاری پیوست‌های همان پیام‌ها.
- Storage خصوصی، metadata و دانلود امن.

### Android — در سورس و Build موفق

- جست‌وجوی مخاطب با نام/نام کاربری و شروع گفتگوی خصوصی با RPC.
- ارسال/دریافت پیام و Realtime؛ Subscription جداگانه برای تازه‌سازی inbox حتی وقتی گفتگوی دیگری باز است.
- پیش‌نمایش آخرین پیام و unread count؛ شمارنده Android تا ۱۰۰ پیام را می‌شمارد و برای مقدار ۱۰۰ یا بیشتر `99+` نشان می‌دهد.
- Read cursor و صفحه‌بندی پیام‌های قدیمی.
- پیوست فایل خصوصی، سقف ۵۰٬۰۰۰٬۰۰۰ بایت، SHA-256، ثبت metadata، دانلود احراز هویت‌شده و بازیابی پیوست‌های پیام‌های قدیمی.
- آپلود/دانلود در رابط کاربری نشانگر فعالیت دارد؛ درصد پیشرفت بایت‌به‌بایت و Resumable Upload هنوز وجود ندارد.

### مواردی که هنوز کامل یا آزمایش نشده‌اند

- تبادل end-to-end بین دو حساب مستقل Web و Android.
- تست RLS و Storage با JWT دو کاربر مستقل.
- Google OAuth و session restore با Provider واقعی.
- Delivered واقعی، typing، online presence، Reply، edit/delete از رابط هر دو نسخه و جست‌وجوی کامل پیام‌ها.
- پیش‌نمایش تصویر/ویدئو، retry پایدار، upload resumable و progress بایت‌به‌بایت.
- Push notifications، گروه/کانال، استوری، تماس صوتی/تصویری و پنل مدیریت.

در آخرین بازبینی Supabase صفر کاربر Auth و صفر پروفایل داشت؛ بنابراین سناریوی دوکاربره واقعی هنوز اجرا نشده است.

## CI و Build

### Web

- Web CI موفق: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44317894080
- Commit بررسی‌شده: `e7cf84ce6e0302a629d054c362999910bf9861c1`
- Node.js 22، npm ci، TypeScript، ESLint، Vitest و Next.js Production Build همگی موفق.
- Vercel Production deployment با وضعیت READY روی Commit `9a8b33d02405529b98aef69e7f38d7e700d98752` است و alias اصلی آن https://kaveh-avenger.vercel.app است. Commitهای بعدی فقط Android/مستندات را تغییر داده‌اند.

### Android

- Android CI موفق: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44318216746
- Commit بررسی‌شده: `a3983ef065511b9c260352e3d14aa8b8e05ac68d`
- JDK 21، Gradle 9.5.0، Android SDK 36، Unit Tests، `assembleDebug` و `bundleDebug` همگی موفق.
- Artifact واقعی: `14433493531`
- APK: 25,546,890 بایت؛ SHA-256: `2bd55155f6ac84be73966e35afdaab1145ffe843cfef451a2b8060710eb51ac1`
- AAB: 21,951,556 بایت؛ SHA-256: `a47aaeb1e89d2b0f4854cd3c17d77652fae7a0797ca66d12e5b13c51f3bce24b`
- هر دو فایل از Artifact استخراج شدند و `unzip -t` برای هر دو بدون خطا تمام شد.
- خروجی Debug است؛ Release signing انجام نشده و روی دستگاه واقعی تست نشده است.

### Security

- Security checks موفق: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44318216809
- Gitleaks، audit وابستگی‌های production و audit کل dependency graph موفق‌اند.

## Google OAuth

متغیر Repository با نام دقیق `GOOGLE_WEB_CLIENT_ID` در GitHub Actions تنظیم نشده است؛ بنابراین Google Sign-in در APK ساخته‌شده پیکربندی نشده است. راهنمای تنظیم Repository Variable در `docs/google-auth-setup.md` ثبت شده است. Web Client Secret باید فقط در Supabase Dashboard نگهداری شود و نباید در GitHub، Web client یا APK قرار گیرد.

## برند

فایل لوگوی اصلی در فایل‌های قابل دسترسی پیدا نشد؛ هیچ لوگوی ساختگی جایگزین آن نشده است. PWA کامل و قابل نصب نیز اعلام نمی‌شود.

## کارهای بعدی با اولویت

1. تنظیم Google OAuth Client ID در GitHub Repository Variables و تکمیل Provider/redirectها در Supabase.
2. ورود دو حساب واقعی و اجرای سناریوی پیام، read cursor، unread count و فایل بین Web و Android.
3. تست RLS و Storage با دو JWT مستقل و تست APK روی دستگاه فیزیکی.
4. تکمیل Delivered/typing/online، Reply/edit/delete، جست‌وجوی پیام و پیش‌نمایش رسانه.
5. اضافه‌کردن retry و resumable upload و progress بایت‌به‌بایت.
6. بازیابی تاریخچه قدیمی Git فقط در صورت دسترسی به clone اصلی یا Git bundle دارای `.git`.
