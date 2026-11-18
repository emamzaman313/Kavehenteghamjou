package com.kaveh.avenger.auth

/**
 * Keeps provider, network, and cancellation failures understandable without
 * leaking raw authentication payloads into the UI.
 */
internal object GoogleAuthErrorMessage {
    fun from(error: Throwable): String {
        val details = generateSequence(error) { it.cause }
            .mapNotNull { it.message }
            .joinToString(" ")
            .lowercase()

        return when {
            details.contains("provider is not enabled") ||
                details.contains("unsupported provider") ||
                details.contains("provider_disabled") ->
                "ورود با گوگل در تنظیمات احراز هویت فعال نیست یا اطلاعات OAuth آن کامل نیست. مدیر سرویس باید Google Provider و Client ID/Secret را در Supabase بررسی کند."

            details.contains("cancel") ->
                "فرایند ورود لغو شد. برای ادامه دوباره تلاش کنید."

            details.contains("failed to connect") ||
                details.contains("unable to resolve host") ||
                details.contains("network") ||
                details.contains("timeout") ||
                details.contains("timed out") ->
                "اتصال به سرویس ورود برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید."

            else ->
                "ورود با گوگل تکمیل نشد. دوباره تلاش کنید؛ اگر مشکل ادامه داشت، تنظیمات ورود گوگل باید بررسی شود."
        }
    }
}
