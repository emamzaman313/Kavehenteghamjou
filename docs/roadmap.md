# نقشه راه توسعه

## فاز ۰ — بررسی مرجع و معماری
- [x] شناسایی مخزن رسمی و نمونه‌برداری از فایل‌ها و کلاس‌های واقعی
- [x] بررسی مجوز GPL و تصمیم عدم کپی کد
- [ ] clone کامل، Submoduleها و commit SHA

## فاز ۱ — زیرساخت و هویت
- [x] پروژه Supabase فعال
- [x] ۲۶ جدول و ۶۸ policy؛ ۲۶/۲۶ RLS فعال
- [x] bucket خصوصی و hard limit ۵۰٬۰۰۰٬۰۰۰ بایت
- [x] Realtime publication پایه
- [x] RPC ایجاد گفتگوی مستقیم با wrapper کم‌دسترسی
- [x] کد Credential Manager → Supabase Auth و UI اولیه
- [ ] Google OAuth dashboard configuration و device test
- [ ] Build واقعی APK و CI تأییدشده
- [ ] اضافه‌کردن همان Asset لوگوی اصلی بدون تغییر (Asset فعلاً در workspace نیست)

## فاز ۲ — فایل و پیام‌رسانی
- [x] انتخاب هر نوع فایل و کد آپلود مستقیم/ثبت metadata در اپ
- [ ] تست آپلود واقعی روی دستگاه برای ۱ بایت، فارسی، ۴۹MB، ۵۰MB و بالاتر از سقف
- [ ] WorkManager، streaming/resumable transfer، cancel/retry/progress
- [ ] دانلود خصوصی، signed URL کوتاه‌عمر، دسترسی به پیوست‌های مشترک
- [ ] چت مستقیم UI، پیام/دریافت Realtime، reply/edit/delete/read receipt/typing
- [ ] گروه، topic و permission management

## فاز ۳ — شبکه اجتماعی
- [ ] profile editor و privacy UI
- [ ] پست، فید صفحه‌بندی‌شده، واکنش، نظر، follow/unfollow
- [ ] استوری، viewers، expiry و audience کامل
- [ ] search فارسی/انگلیسی و Saved Content

## فاز ۴ — اعلان و ابزارهای اجتماعی
- [ ] FCM، دستگاه‌ها و تنظیمات اعلان
- [ ] گروه/کانال و مدیریت/دعوت/نظرسنجی
- [ ] moderation، audit log و rate limiting
- [ ] رتبه و badgeهای server-authoritative

## فاز ۵ — امکانات پیشرفته
- [ ] WebRTC و SFU برای تماس
- [ ] sticker/GIF، bot APIs و business tools
- [ ] E2EE فقط با پروتکل ممیزی‌شده و مدیریت کلید امن

## فاز ۶ — انتشار
- [ ] تست واحد، integration، RLS، عملکرد و accessibility
- [ ] build reproducible، SBOM و license report
- [ ] Release signing با Keystore واقعی مالک
