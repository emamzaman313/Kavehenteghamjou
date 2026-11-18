# Supabase Edge Functions

در حال حاضر تابع Edge مستقر نشده است. موارد موردنیاز فاز بعد:

- تولید Signed URL برای دانلود فقط پس از بررسی عضویت/مجوز فایل
- تکمیل وضعیت فایل و cleanup فایل‌های orphaned بعد از آپلود
- FCM sender و fan-out اعلان
- rate limiting و moderation
- عملیات امتیازدهی/نشان‌ها و نقش‌های مدیریتی از سمت سرور

هیچ service-role یا secret را در Android قرار ندهید.
