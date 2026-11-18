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
- Web CI موفق: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44320577871
- Commit بررسی‌شده: `f9989232a076646e3528a99329d94902ff938d37`؛ شامل اسکریپت E2E و فرمان تست آن.
- npm ci، TypeScript، ESLint، Vitest و Next.js Production Build موفق شدند.
- Vitest: ۴ تست موفق؛ ESLint: صفر خطا و ۹ هشدار.
- آخرین Vercel Production deployment: `dpl_A7bRxNEdXPfzdmk7iPo2F9sceKJg`، وضعیت READY، Commit: `77dc96d4b4d9c02aa5962001fdf0f4777193fa22`.
- دامنه اصلی https://kaveh-avenger.vercel.app و مسیر `/auth/callback` هر دو HTTP 200؛ manifest نیز HTTP 200 است.

### Android
- Android CI موفق: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44320228293
- Commit بررسی‌شده: `4847386942727c373d4bf841240e40e3339c0f54`.
- JDK 21، Gradle 9.5.0، Android SDK 36، دو Unit Test مربوط به nonce، `assembleDebug` و `bundleDebug` موفق.
- Artifact واقعی: `14434103107`.
- APK Debug: 25,546,890 بایت؛ SHA-256: `8e747548addafcff155a7ceeb8b53330b4d139b6c73258ed2659a29b2a847fdc`.
- AAB Debug: 21,951,740 بایت؛ SHA-256: `d0a447e17322da5d898d15b748e665e4c6baacdcd02a8f45abb6a3ede90c2735`.
- ZIP artifact سالم بود و APK به‌عنوان Android package شناسایی شد. این خروجی‌ها Debug هستند؛ Release signing انجام نشده و روی دستگاه فیزیکی تست نشده‌اند.

### Security
- آخرین Security checks موفق: https://github.com/emamzaman313/Kavehenteghamjou/actions/runs/44321023690
- Commit بررسی‌شده: `77dc96d4b4d9c02aa5962001fdf0f4777193fa22`.
- Gitleaks و audit وابستگی‌های production موفق‌اند؛ audit وابستگی‌های production هیچ آسیب‌پذیری گزارش نکرد.
- در کل dependency graph توسعه ۱۶ هشدار High از زنجیره وابستگی `picomatch` گزارش شد؛ advisory فعلی هنوز نسخه اصلاح‌شده معرفی نکرده است. این هشدار را پنهان یا با downgrade اجباری حل‌شده اعلام نکنید.
- هیچ secret واقعی در مخزن شناسایی نشد.

## Workflowهای پذیرش و انتشار افزوده‌شده

- `.github/workflows/android-release.yml`: ساخت Release APK/AAB با keystore رمزگذاری‌شده در GitHub Secrets، بررسی امضا و SHA-256. این Workflow هنوز اجرا نشده؛ چهار Secret امضای Release و Repository Variable مربوط به Google Client ID لازم است.
- `docs/android-release-signing.md`: راهنمای ساخت/نگهداری keystore و ثبت secrets.
- `.github/workflows/chat-e2e.yml` و `web/scripts/e2e-chat.mjs`: آزمون دوحسابی واقعی ورود، RPC گفتگوی خصوصی، پیام، Realtime، read cursor، آپلود/دانلود فایل و رد دسترسی anonymous.
- `docs/chat-e2e-setup.md`: راهنمای ساخت دو حساب آزمایشی و ثبت چهار GitHub Secrets. آزمون E2E هنوز اجرا نشده؛ حساب‌های Auth در Supabase صفر هستند.
- این اسکریپت داده‌های آزمایشی را حذف نمی‌کند؛ باید فقط با دو حساب اختصاصی تست اجرا شود.

## Google OAuth

- Repository Variable با نام دقیق `GOOGLE_WEB_CLIENT_ID` در GitHub Actions هنوز تنظیم نشده است؛ لاگ Android CI این مقدار را خالی نشان داد.
- بنابراین Google Sign-in در APK ساخته‌شده پیکربندی نشده است؛ وجود کد Google Credential Manager به معنی آماده بودن ورود نیست.
- وضعیت Google Provider در Supabase Dashboard هنوز از راه دور قابل تأیید نبود؛ باید Web Client ID و Web Client Secret در Provider ثبت شوند.
- راهنمای `docs/google-auth-setup.md` اکنون URIهای دقیق را ثبت می‌کند: Google authorized redirect URI برابر `https://slwzjufipavuwcbwoyro.supabase.co/auth/v1/callback` و Supabase Redirect URL برابر `https://kaveh-avenger.vercel.app/auth/callback`.
- Web Client Secret فقط باید در Supabase Dashboard بماند؛ آن را در چت، GitHub Variables یا APK قرار ندهید.

## برند

فایل لوگوی اصلی در فایل‌های قابل دسترسی پیدا نشد؛ هیچ لوگوی ساختگی جایگزین آن نشده است. PWA کامل و قابل نصب نیز اعلام نمی‌شود.

## کارهای بعدی با اولویت

1. ایجاد یا انتخاب keystore دائمی Release و ثبت چهار Secret: `ANDROID_KEYSTORE_BASE64`، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS`، `ANDROID_KEY_PASSWORD`.
2. ساخت Web OAuth Client در Google Cloud، تنظیم Supabase Google Provider، ثبت `GOOGLE_WEB_CLIENT_ID` به‌عنوان GitHub Repository Variable و ثبت SHA-1 گواهی Release در Android OAuth Client.
3. ساخت دو حساب اختصاصی آزمایش با ایمیل تأییدشده و ثبت Secrets: `KAVEH_E2E_USER_A_EMAIL`، `KAVEH_E2E_USER_A_PASSWORD`، `KAVEH_E2E_USER_B_EMAIL`، `KAVEH_E2E_USER_B_PASSWORD`؛ سپس اجرای Workflow با نام Chat E2E.
4. اجرای Android Release Workflow، بررسی APK/AAB امضاشده و آزمایش روی دستگاه فیزیکی.
5. آزمون واقعی Google OAuth و session restore در Web و Android؛ آزمون دسترسی فایل برای عضو گفتگو و کاربر غیرعضو.
6. تکمیل Delivered/typing/online، Reply/edit/delete، جست‌وجوی پیام، پیش‌نمایش رسانه، retry و resumable upload.
7. بازیابی تاریخچه قدیمی Git فقط در صورت دسترسی به clone اصلی یا Git bundle دارای `.git`.

هیچ داده‌ای در Supabase حذف یا تغییر داده نشده و Migration جدیدی روی پروژه زنده اجرا نشده است.


## ممیزی تکمیلی و شواهد زنده — ۱۸ نوامبر ۲۰۲۶

این بخش مرجع جدیدتر برای وضعیت متغیرهای Production، Provider و تست‌های وب است و بندهای تاریخی بالاتر را به‌روزرسانی می‌کند.

- Supabase Project Ref slwzjufipavuwcbwoyro در هر دو اتصال مدیریتی ACTIVE_HEALTHY بود. SQL صرفاً Read-only: تعداد ۲۶ جدول عمومی، ۲۶ جدول RLS-enabled، ۶۸ Policy، صفر Auth user، صفر profile، صفر message و صفر file_asset. Bucket user-files private با سقف ۵۰٬۰۰۰٬۰۰۰ بایت. هیچ داده، Policy یا Migration تغییر نکرد.
- Vercel Production مقدار NEXT_PUBLIC_SUPABASE_URL برابر https://slwzjufipavuwcbwoyro.supabase.co داشت. Deployment جاری READY بود ولی روی Commit 77dc96d4b4d9c02aa5962001fdf0f4777193fa22 قرار داشت؛ HTTP 200 سایت و callback به معنای OAuth موفق نیست.
- Auth settings زنده external.google=false بود. این نتیجه، عبارت تاریخی «Provider از راه دور قابل‌تأیید نبود» را اصلاح می‌کند: Google Provider اکنون به‌طور قطعی غیرفعال مشاهده شد. فعال‌سازی آن به Supabase Dashboard مالک و ثبت Web Client ID/Secret از Google Cloud نیاز دارد.
- main در Commit d204f71253c129770dc69436a4373ffd7e46c05c شامل helper خطای Google وب، مدیریت callback error و مدیریت خطای Google Android همراه تست واحد بود.
- شاخه fix/web-pkce-single-exchange-2026-11-18 از همین main منشعب شد. Commit کد تست‌شده b9ad73e9c0d8dd67a7678aecfba723ea18ebeffe: npm ci موفق، TypeScript موفق، Vitest دو فایل/۱۰ تست موفق، Next.js Production Build موفق، ESLint صفر خطا/۹ هشدار و npm audit --omit=dev صفر آسیب‌پذیری.
- npm audit کل زنجیره توسعه ۱۶ High و صفر Critical گزارش کرد. picomatch@4.0.7 آخرین نسخه npm registry بود و advisory نسخه‌های <=4.0.7 را پوشش می‌داد؛ 4.0.8 موجود نبود. npm فقط downgrade عمده Vitest به 3.1.4 را پیشنهاد کرد؛ downgrade یا workaround اجباری اعمال نشد.
- Android Release workflow و Chat E2E در این ممیزی اجرا نشدند؛ keystore، signing secrets و دو حساب اختصاصی در دسترس نبودند. APK/AAB Release و تست گوشی واقعی تولید یا ادعا نشده است.
