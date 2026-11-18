# وضعیت واقعی پیاده‌سازی و آزمون کاوه انتقامجو

آخرین بازبینی: ۱۸ نوامبر ۲۰۲۶ (UTC)
آخرین Commit کد بررسی‌شده در `main`: `398f5b39491ed5e5e198f567bcc38f601c7aa433`

این سند بین کد، تست خودکار، Build، تست End-to-End و آماده‌بودن Release تفاوت می‌گذارد. موفقیت Build اثبات ورود OAuth واقعی، تست دستگاه یا رفتار دوحسابی نیست.

## مخزن و Commitهای این مأموریت

- مخزن رسمی: https://github.com/emamzaman313/Kavehenteghamjou
- شاخه: `main`
- Commit اولیه هنگام شروع ممیزی: `60f46da6cad606430e8b306ce971423aa5caea27`
- Commit آخر کد: `d204f71253c129770dc69436a4373ffd7e46c05c`
- تغییرات Web: `34e8719`، `071b81f`، `bd98678`، `489fb96` و تست‌های `a9e9e23`.
- تغییرات Android auth: `bd08a219`، `19a99c7` و `d204f712`.

## Supabase زنده — فقط Read-only

- پروژه: `kaveh-avenger`
- Project Ref: `slwzjufipavuwcbwoyro`
- URL: `https://slwzjufipavuwcbwoyro.supabase.co`
- وضعیت: `ACTIVE_HEALTHY`، region: `ap-northeast-1`، PostgreSQL 17.12.
- جدول‌های public: ۲۹؛ RLS فعال: ۲۹ از ۲۹.
- Policyهای public: ۷۱.
- تعداد فعلی `auth.users`: ۳ و `public.profiles`: ۳؛ posts/messages/file_assets/storage objects در زمان بررسی هنوز صفر هستند.
- Bucket `user-files` خصوصی؛ حداکثر اندازه: `50,000,000` بایت.
- Realtime publication شامل `conversation_members`، `messages`، `notifications` و `posts` است.
- RPC `public.create_direct_conversation(p_other_user_id uuid)` موجود و wrapper آن SECURITY INVOKER است.
- جداول جدید `site_access_settings`، `site_access_admins` و `site_access_attempts` همگی RLS فعال دارند و دسترسی مستقیم `anon`/`authenticated` از آن‌ها سلب شده است؛ فقط Edge Function از Service Role استفاده می‌کند.
- پس از افزودن policyها، Security Advisor برای این جداول هشدار RLS ندارد؛ یک هشدار مستقل `auth_leaked_password_protection` همچنان وجود دارد. Performance Advisor شامل ۳۳ مورد INFO ایندکس‌های استفاده‌نشده و هشدار قبلی چند SELECT policy روی `file_assets` است.
- سه Migration مربوط به ورود با کد دسترسی در Production اعمال شده‌اند؛ وضعیت و مقداردهی اولیه با query فقط‌خواندنی تأیید شده است.

## Remote Migration Ledger

سیزده Migration موجود در Remote Ledger:

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
11. `20261118190325` — `kaveh_shared_access_code`
12. `20261118190529` — `kaveh_shared_access_code_live_init` (مقداردهی فقط روی Production؛ متن کد در Git قرار نگرفته است)
13. `20261118191056` — `kaveh_access_code_service_policies`

چهار Migration اول در تاریخچه محلی به‌طور کامل بازیابی نشده‌اند. شش فایل بعدی در `supabase/migrations/` وجود دارند. `archive/initial_schema_draft_NOT_FOR_DEPLOY.sql` هرگز اجرا نشود. `remote-state-snapshot.md` سند توصیفی است، نه backup/migration قابل اجرا.

## Web

### پیاده‌سازی و تست خودکار

- ورود ایمیلی وب از لینک یک‌بارمصرف Supabase با PKCE استفاده می‌کند؛ صفحه `/auth/callback` کد را با session مبادله می‌کند. قالب فعلی Auth لینک می‌فرستد، نه عدد ۶ رقمی؛ UI مطابق آن به‌روزرسانی شده است.
- مسیر «ورود با کد دسترسی» افزوده شده است؛ Edge Function کد را در سرور با bcrypt بررسی می‌کند و برای هر ورود یک حساب مهمان مستقل می‌سازد.
- پنل مدیر امکان روشن/خاموش‌کردن قابلیت و تغییر کد ۶ کاراکتری را دارد. مدیر اولیه از جدول خصوصی `site_access_admins` تعیین شده است.
- مقدار آغازین طبق درخواست مالک در Supabase به‌صورت bcrypt hash مقداردهی شده است؛ مقدار خام در مخزن عمومی قرار نگرفته است.
- پنج تلاش ناموفق باعث محدودیت ۱۵ دقیقه‌ای بر اساس HMAC مبدأ درخواست می‌شود.
- تست‌های جدید: `web/tests/auth-errors.test.ts` و `web/tests/access-code.test.ts`.
- Web CI run: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44377507753
- Commit تست‌شده: `aa99add7b985e868e2cc26e1ccfee85ecac648a0`.
- نتیجه: TypeScript، ESLint، تست‌های واحد و Next.js production build همگی موفق. اجرای Security checks برای آخرین تغییرات مخزن نیز موفق است: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44377908908.
- صفحه‌های خانه، گفتگو، فایل، اکتشاف، پروفایل، اعلان و تنظیمات در سورس به Supabase متصل هستند؛ با صفر بودن userها، صحت E2E آن‌ها ثابت نشده است.

### Google Provider

خطای کاربر `400 validation_failed / Unsupported provider: provider is not enabled` در لایه Auth رخ می‌دهد. این Commit پیام خطا را واضح می‌کند؛ آن را از بین نمی‌برد. مقدار Vercel Production برای `NEXT_PUBLIC_SUPABASE_URL` دقیقاً با URL پروژه Supabase برابر بود. Provider setting از ابزار متصل قابل مشاهده/تغییر نبود؛ باید در Supabase Dashboard، Google Provider و Web Client ID/Secret تأیید شوند.

## Android

### پیاده‌سازی و تست

- Google Credential Manager، ID Token، raw nonce و hash آن در سورس موجود است.
- Mapper پیام خطای Provider disabled، لغو و شبکه اضافه شده و ۴ تست Kotlin دارد.
- تست nonce نیز دو تست دارد؛ Android Unit Test کل suite در CI موفق شد.
- ChatScreen کد فهرست گفتگو، جست‌وجوی مخاطب، گفتگوی خصوصی، ارسال متن، Realtime، read cursor، صفحه‌بندی پیام قدیمی و پیوست دارد.
- کد آپلود فایل خصوصی، metadata، SHA-256 و دانلود پیوست موجود است.
- Explore/Profile در Android همچنان Placeholder است؛ تب Publish فعلاً به FileUploadScreen متصل است.
- FileUploadRepository محتوا را به‌صورت ByteArray در حافظه Buffer می‌کند؛ WorkManager، streaming، resumable، cancel/retry و progress بایت‌به‌بایت تکمیل نشده‌اند.

### Android CI و Artifact

- Android CI: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44326092783
- Commit: `d204f71253c129770dc69436a4373ffd7e46c05c`
- JDK 21، Gradle 9.5.0 و SDK 36.
- Unit tests موفق؛ `assembleDebug` و `bundleDebug` موفق؛ Artifact upload موفق.
- Artifact ID: `14437042579`; ZIP SHA-256: `a8001601fb583268db63bded3a6f720708ae43d2f94e8d9d80173c76e29068f5`.
- APK Debug: 25,546,890 بایت؛ SHA-256: `6706d41a34700ffba5f577cd88123545b7321c88eb0ef3c4502561980949c7ad`.
- AAB Debug: 21,953,039 بایت؛ SHA-256: `d1572472bc758141b00eeaba9da7297db268b3810c5a03212fa8f4197fca3089`.
- ZIP و هر دو فایل از نظر ساختار آرشیو سالم‌اند. خروجی‌ها Debug هستند؛ این بررسی معادل Release signing یا نصب روی گوشی فیزیکی نیست.
- لاگ همین CI نشان می‌دهد `GOOGLE_WEB_CLIENT_ID` خالی است؛ برنامه به‌دلیل نبود Client ID ورود Google فعال ندارد.

## Security CI

- Run: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44326093245
- Commit: `d204f71253c129770dc69436a4373ffd7e46c05c`
- Secret scanning: موفق.
- Web dependency audit: موفق.
- Pull request dependency review: به‌دلیل اجرا نشدن روی Pull Request، skipped.
- هشدار قبلی ۱۶ مورد High در dependency graph توسعه مربوط به زنجیره `picomatch` همچنان باید ریشه‌یابی شود؛ audit production موفق بودن آن را حذف نمی‌کند. Downgrade اجباری یا پنهان‌سازی هشدار انجام نشده است.

## Vercel

- Project: `kaveh-avenger`; دامنه اصلی: https://kaveh-avenger.vercel.app
- Vercel Production env `NEXT_PUBLIC_SUPABASE_URL` با `https://slwzjufipavuwcbwoyro.supabase.co` برابر بود؛ Publishable Key نیز تنظیم شده بود.
- Deployment قبلی READY: `dpl_A7bRxNEdXPfzdmk7iPo2F9sceKJg`، Commit `77dc96d4b4d9c02aa5962001fdf0f4777193fa22`.
- Deployment قبلی برای Commit `dd774609` با شناسه `dpl_3wkivPRGzz6ZhinkiK7hkoCEjtw2` وضعیت `READY` داشت؛ انتشار Commit جدیدِ شامل ورود با کد، جداگانه در سوابق Vercel بررسی می‌شود.
- Build موفق CI به‌تنهایی تست واقعی مرورگر، تحویل ایمیل، ایجاد حساب مهمان یا ورود عملی با کد را اثبات نمی‌کند.

## Google OAuth و Release gateها

- GitHub Repository Variable `GOOGLE_WEB_CLIENT_ID` در اجرای Android CI خالی بود.
- Supabase Google Provider/Client Secret باید در Dashboard مالک تنظیم و پس از ذخیره با ورود واقعی آزمایش شود.
- Callback Google Cloud: `https://slwzjufipavuwcbwoyro.supabase.co/auth/v1/callback`.
- Redirect وب: `https://kaveh-avenger.vercel.app/auth/callback`.
- چهار GitHub Secret امضا: `ANDROID_KEYSTORE_BASE64`، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS` و `ANDROID_KEY_PASSWORD`.
- چهار Secret حساب E2E: `KAVEH_E2E_USER_A_EMAIL`، `KAVEH_E2E_USER_A_PASSWORD`، `KAVEH_E2E_USER_B_EMAIL`، `KAVEH_E2E_USER_B_PASSWORD`.
- نه Release signing، نه test واقعی Google OAuth، نه Chat E2E دوحسابی و نه تست دستگاه فیزیکی انجام نشده‌اند.

## وضعیت هر قابلیت

| قابلیت | وضعیت |
|---|---|
| Backend schema/RLS/Storage | تست ممیزی read-only موفق |
| Web OAuth error/callback handling | تست خودکار موفق؛ Provider واقعی تأیید نشده |
| Web production build | CI موفق |
| Android nonce/error handling | Unit Test موفق |
| Android Debug APK/AAB | Build CI موفق |
| Android Release | پیاده‌سازی workflow موجود؛ secrets و امضای واقعی باقی |
| Android Explore/Profile/Publish social | ناقص/Placeholder |
| Android large-file transfer | کد اولیه؛ stream/resumable و تست حجیم باقی |
| دوحسابی Web/Android و RLS | E2E اجرا نشده |
| Google OAuth واقعی | آماده تست نیست؛ Client ID/Provider config باقی |
| گوشی فیزیکی | آزمایش نشده |

## گام‌های بعدی ضروری

1. تنظیم Google Cloud Web و Android OAuth clients، فعال کردن Provider در Supabase، ثبت Google Web Client ID به‌عنوان GitHub Repository Variable و افزودن Web Client Secret فقط در Supabase.
2. تأمین/انتخاب keystore دائمی مالک و ثبت چهار GitHub Release Secrets؛ سپس اجرای Android Release Workflow.
3. ساخت دو حساب اختصاصی تست و افزودن چهار GitHub E2E Secrets؛ سپس اجرای Chat E2E.
4. تست نصب Release روی گوشی واقعی، ورود Google، حفظ Session، Realtime و فایل.
5. پیاده‌سازی Explore/Profile/Publish اجتماعی بومی، سپس streaming upload و WorkManager.
6. تکمیل typing/presence/reply/edit/delete/search و Push.
7. آزمون محدودیت‌های فایل و RLS با حساب مجاز و غیرمجاز.

هیچ داده‌ای از Supabase حذف نشده، هیچ migration اجراشده‌ای دوباره اجرا نشده و هیچ secret در مخزن قرار داده نشده است.


## ورود با کد دسترسی — تغییرات ۱۸ نوامبر ۲۰۲۶

### Supabase
- سه جدول خصوصی برای تنظیمات، مدیران مجاز و تلاش‌های ناموفق اضافه شد؛ هر سه RLS-enabled هستند و دسترسی مستقیم `anon`/`authenticated` از آن‌ها لغو شده است.
- توابع بررسی hash، ذخیره تنظیمات و محدودسازی تلاش‌ها فقط برای `service_role` قابل اجرا هستند.
- Edge Function به نام `access-code-login` با `verify_jwt=false` مستقر شده؛ مسیرهای مدیریتی در بدنه تابع Bearer token را اعتبارسنجی و نقش مدیر را از جدول خصوصی می‌خوانند.
- بررسی دیتابیس: کد مقداردهی‌شده موفق، کد اشتباه ناموفق، قابلیت روشن، و یک مدیر در فهرست ثبت شده است.
- محدودیت: چون کد اولیه ساده و مشترک است، مالک باید بلافاصله آن را از پنل مدیریت عوض کند.

### آزمون و محدودیت شواهد
- Web CI run `44377507753` در Commit `aa99add7` شامل فرم ورود با کد، پنل مدیر، helper و تست‌های آن بود؛ TypeScript، lint، test و build موفق شدند.
- Security run `44377908908` برای Commit `456ef9e5` موفق شد؛ Secret scanning و dependency audit موفق، Dependency review به‌علت اجرا نشدن روی Pull Request skipped بود.
- کد مهمان و پنل مدیر در محیط واقعی با مرورگر/درخواست POST end-to-end آزمایش نشده‌اند؛ ابزار اجرای این نشست امکان درخواست مستقیم به Edge Function را نداد. Deployment Vercel و درخواست واقعی کاربر باید برای اثبات کامل ورود آزمایش شوند.
