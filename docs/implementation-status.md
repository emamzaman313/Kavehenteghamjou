# وضعیت واقعی پیاده‌سازی و آزمون کاوه انتقامجو

آخرین بازبینی: ۱۸ نوامبر ۲۰۲۶ (UTC)
آخرین Commit کد بررسی‌شده در `main`: `61684899711c286f809503271d360624ff14fb58`

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
- آخرین Production Deployment در این بررسی: `dpl_H9yqYhHQ57cY6Bb3HkCKjPSo3B94`، Commit `b70b0a98ee7b711f238198c080183dde8ef4d99e`، وضعیت `READY` و alias شامل `kaveh-avenger.vercel.app`.
- پس از آن، فقط Edge Function نسخه ۳ به‌روزرسانی شده و نیازی به تغییر باندل وب ندارد؛ به‌روزرسانی Edge Function مستقل از Vercel انجام می‌شود.
- Build موفق CI به‌تنهایی تحویل ایمیل، ایجاد حساب مهمان یا ورود عملی با کد را اثبات نمی‌کند.

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
- Edge Function به نام `access-code-login` با `verify_jwt=false` و نسخه ۳ مستقر است؛ مسیرهای مدیریتی در بدنه تابع Bearer token را اعتبارسنجی و نقش مدیر را از جدول خصوصی می‌خوانند. Rate limit فقط از هدر IP پروکسی مورد اعتماد استفاده می‌کند. CORS دامنه اصلی و زیردامنه‌های Vercel مختص همین پروژه را می‌پذیرد و Origin مبهم `null` را نیز برای preflight پاسخ می‌دهد.
- بررسی دیتابیس: کد مقداردهی‌شده موفق، کد اشتباه ناموفق، قابلیت روشن، و یک مدیر در فهرست ثبت شده است.
- محدودیت: چون کد اولیه ساده و مشترک است، مالک باید بلافاصله آن را از پنل مدیریت عوض کند.

### آزمون و محدودیت شواهد
- Web CI run `44377507753` در Commit `aa99add7` شامل فرم ورود با کد، پنل مدیر، helper و تست‌های آن بود؛ TypeScript، lint، test و build موفق شدند.
- Security run `44377908908` برای Commit `456ef9e5` موفق شد؛ Secret scanning و dependency audit موفق، Dependency review به‌علت اجرا نشدن روی Pull Request skipped بود.
- کد مهمان و پنل مدیر در محیط واقعی با مرورگر/درخواست POST end-to-end آزمایش نشده‌اند؛ ابزار اجرای این نشست امکان درخواست مستقیم به Edge Function را نداد. Deployment Vercel و درخواست واقعی کاربر باید برای اثبات کامل ورود آزمایش شوند.


---

## شاخه توسعه محصول — به‌روزرسانی ۲۰ نوامبر ۲۰۲۶

این بخش وضعیت جدید شاخه `feat/kaveh-premium-experience` را ثبت می‌کند؛ گزارش تاریخی `main` بالا را بازنویسی نمی‌کند.

- آخرین Commit کد هنگام ثبت این بخش: `97117704f89b2683cb7caef567682252db3a9521`.
- PR مرتبط: [#3](https://github.com/emamzaman313/Kavehenteghamjou/pull/3)، همچنان Draft/Open و Merge نشده است.
- اصلاحات فاز ۱ روی OTP اندروید، unread count دقیق، rollback آپلود ناموفق، حریم فیلد رمز، حذف mutation غیرضروری پس از ورود و rollback پیوست ناقص چت در تاریخچه همین شاخه ثبت شده‌اند.
- روی وب، ناوبری صفحه‌کلیدپذیر بهبود یافت: پیوند پرش به محتوای اصلی، landmarkهای نام‌گذاری‌شده برای ناوبری، `aria-current=page` برای مسیر فعال، فوکوس‌پذیری main و live region برای اعلان‌های درون‌برنامه‌ای.
- لایه دسترس‌پذیری CSS مشترک اضافه شد: focus-visible، رعایت reduced-motion، حداقل هدف لمسی در موبایل و استایل forced-colors.
- این تغییرات دسترس‌پذیری هنوز از نظر screen reader و صفحه‌کلید به‌صورت دستی آزمایش نشده‌اند؛ تا پایان CI فقط کد پیاده‌سازی‌شده محسوب می‌شوند.
- CI برای Commit `19745dc5ce51b257b686e6f171d8cc549849ca91` موفق شد: Android CI، Web CI و Security checks هر سه success.
- CI برای Commit فعلی `97117704f89b2683cb7caef567682252db3a9521` در زمان ثبت: Android در حال اجرا، Web در صف، Security در صف. نتیجه نهایی هنوز تأیید نشده است.
- تست واقعی دو حساب مستقل، نصب روی دستگاه فیزیکی، Android Release signing و تست دستی دسترس‌پذیری هنوز انجام نشده‌اند.
- هیچ Production deployment/promotion، Merge یا Production migration انجام نشده است.


---

## Phase 1 follow-up — verified private downloads across Web and Android

- Android chat attachments now include the persisted `sha256_hex` metadata when reading file assets. Before opening the Android save dialog, the download must pass both exact byte-size and SHA-256 validation using the shared `verifyFileIntegrity` helper. A missing or malformed digest fails closed; no unverified bytes are saved.
- The Web chat and Vault download paths no longer open a signed URL directly. They download through the authenticated Supabase Storage client, which keeps private-bucket RLS in force, verify the Blob's exact size and SHA-256, and only then create a local browser download.
- Added incremental Blob hashing in `web/lib/files.ts` and four unit tests covering a valid file, a size mismatch, a digest mismatch, and a missing/malformed digest.
- The live Supabase inspection was read-only: `user-files` is still private with a 50,000,000-byte limit; the current `file_assets` table contained one row, no missing/blank digest rows and no oversized metadata rows. Owner-scoped file access, conversation-member shared reads, and attachment insertion tied to the sender and file owner were verified in the active RLS policies. No schema, policy or data changes were made.
- Code commits: Android chat validation `25ccc3676ec548288ee5423547f3a3da012ccd04`; Web verified downloads `a30a7e15695a2f1b6a17489b903b85ebe0aee099` plus helper completion `c684faa3f133202256827f61e798ac884277670f`.
- Exact-head CI for `c684faa3f133202256827f61e798ac884277670f`: Android CI success (unit tests and Debug APK/AAB), Web CI success (TypeScript, ESLint, unit tests and Next.js production build), and Security checks success (dependency review, dependency audit and Gitleaks).
- Supabase Security Advisor still reports leaked-password protection disabled and flags the authenticated `public.create_support_ticket` SECURITY DEFINER function for review. The function was read-only inspected: it requires `auth.uid()`, validates inputs, has an empty search path and has no anon execute grant. It was not changed in this pass; leaked-password protection remains an owner-level Auth setting to review.
- Manual multi-account Web/Android E2E, cross-account negative authorization tests, physical-device checks, Android Release signing and manual screen-reader/keyboard verification remain pending. This file-integrity slice is CI-validated, not a claim that all of Phase 1 or all product modules are complete.
- No production migration, production data mutation, merge, Vercel deployment or production promotion was performed.


---

## Edge Function authentication contract — guest access code

- Read-only inspection of the live project found `access-code-login` active at version 7 with gateway `verify_jwt=true`; `admin-console` is active at version 34 with `verify_jwt=false`. `notification-dispatch` and `rank-management` remain gateway-JWT protected.
- Web and Android client configuration use the modern Supabase publishable key. The access-code handler intentionally exposes only `status` and `login` as public actions. Its `admin_get` and `admin_update` branches verify the actual user token with Auth `getUser()` and enforce site-admin roles in the handler.
- Added `supabase/config.toml` to declare the intended function contract explicitly: guest-code access is reachable without depending on gateway handling of publishable keys; `admin-console` keeps its in-handler JWT/RBAC checks; notification dispatch and rank management retain gateway JWT verification. The access-code function import map remains explicitly pinned to its existing `deno.json`.
- Added `web/tests/edge-function-config.test.ts` so CI checks these four deployment settings and catches accidental auth-mode drift.
- Supabase documentation updated 2026-11-18 explains that publishable/secret API keys are not user JWTs, should be sent on `apikey`, and that functions using handler-side authorization should set `verify_jwt=false`. The compatibility behavior of the gateway is documented separately; this finding is a configuration-contract hardening, not proof that the current guest login is failing on every client.
- The live deployment remains unchanged: the currently active `access-code-login` still reports `verify_jwt=true` until the owner approves and performs a function deployment using this branch configuration. No Edge Function, database, or production setting was changed.
- Code commits: `2253615420e563d7aeef49e74450acbc40ea16fb` (function config) and `9d1003ac05e2d62cf27b55fe369c7f43694f4dfd` (configuration regression test).
- Exact-head CI on `9d1003ac05e2d62cf27b55fe369c7f43694f4dfd`: Android CI success (unit tests + Debug APK/AAB), Web CI success (TypeScript, ESLint, tests including function config, Next.js production build), and Security checks success (Dependency Review, dependency audit and Gitleaks).
- Owner action: authorize the one-function deployment after reviewing this PR. No Production deployment or PR merge was performed.


---

## Phase 1 continuation — CI verification and E2E authorization hardening (20 November 2026)

- Active development branch: `feat/kaveh-premium-experience`.
- Latest branch commit at this update: `55e2db63d29fe32c1fcce66d61015e24ee692b90` (strengthens the three-account chat E2E test).
- PR #3 remains Draft/Open; no merge or production deployment was performed.
- On the immediately preceding commit `973b53f255bc0059ad76c66e3a97d8aabdb08170`, Web CI run `44696753170` passed (TypeScript, ESLint, unit tests, Next.js production build) and Android CI run `44696753201` passed (Android unit tests, Debug APK and Debug AAB build/upload).
- Security Checks run `44696753208` for that preceding commit was still pending at the time of verification; it is not counted as passed.
- The E2E outsider-membership assertion was tightened: Account C now queries all visible membership rows for the private conversation and must receive an empty result. The earlier assertion only queried C's own user ID and could miss accidental visibility of A/B membership rows.
- The E2E workflow still requires three dedicated test accounts and six GitHub Actions secrets. It has not been executed against live accounts; do not treat CI build success as E2E success.
- Android Release signing, physical-device tests, and owner-approved deployment of the Edge Function config remain outstanding.
- No live Supabase data/schema changes, Production migration, Vercel Production promotion, or PR merge were made in this continuation.
