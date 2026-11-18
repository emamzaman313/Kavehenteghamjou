export function getGoogleAuthErrorMessage(
  message?: string | null,
  code?: string | null,
): string {
  const normalized = `${code ?? ''} ${message ?? ''}`.toLowerCase();

  if (
    normalized.includes('provider') &&
    (normalized.includes('not enabled') || normalized.includes('unsupported'))
  ) {
    return 'ورود با Google هنوز در تنظیمات سرور فعال نشده است. مدیر سامانه باید ارائه‌دهنده Google را در Supabase فعال و Client ID و Client Secret معتبر را ثبت کند.';
  }

  if (
    normalized.includes('access_denied') ||
    normalized.includes('user denied') ||
    normalized.includes('cancelled') ||
    normalized.includes('canceled')
  ) {
    return 'درخواست ورود با Google لغو شد. برای ورود دوباره، تلاش مجدد را انتخاب کنید.';
  }

  if (
    normalized.includes('network') ||
    normalized.includes('fetch failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('timeout')
  ) {
    return 'اتصال به سرویس ورود برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.';
  }

  return 'ورود با Google کامل نشد. لطفاً دوباره تلاش کنید؛ در صورت تکرار مشکل، تنظیمات ورود Google در سرویس احراز هویت باید بررسی شود.';
}
