type AuthErrorFields = {
  code?: unknown;
  error_code?: unknown;
  message?: unknown;
  msg?: unknown;
  error?: unknown;
  error_description?: unknown;
  status?: unknown;
  name?: unknown;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Convert Supabase/GoTrue and browser failures into safe, actionable Persian copy.
 * Raw provider payloads are intentionally not shown to users.
 */
export function authErrorMessage(error: unknown): string {
  const fields: AuthErrorFields =
    typeof error === 'object' && error !== null
      ? (error as AuthErrorFields)
      : {};
  const message =
    asText(fields.message) ||
    asText(fields.msg) ||
    asText(fields.error_description) ||
    asText(fields.error) ||
    asText(error);
  const markers = [
    asText(fields.code),
    asText(fields.error_code),
    asText(fields.name),
    message,
  ]
    .join(' ')
    .toLowerCase();

  if (
    markers.includes('provider is not enabled') ||
    markers.includes('unsupported provider') ||
    markers.includes('provider_disabled') ||
    (markers.includes('validation_failed') && markers.includes('google'))
  ) {
    return 'ورود با گوگل در تنظیمات احراز هویت فعال نیست یا اطلاعات OAuth آن کامل نیست. مدیر سرویس باید Google Provider و Client ID/Secret را در Supabase بررسی کند؛ سپس دوباره تلاش کنید.';
  }

  if (
    fields.status === 0 ||
    markers.includes('failed to fetch') ||
    markers.includes('networkerror') ||
    markers.includes('network request failed') ||
    markers.includes('load failed') ||
    markers.includes('timeout') ||
    markers.includes('timed out')
  ) {
    return 'اتصال به سرویس ورود برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.';
  }

  if (
    markers.includes('access_denied') ||
    markers.includes('popup_closed_by_user') ||
    markers.includes('user_cancelled') ||
    markers.includes('user canceled') ||
    markers.includes('user cancelled')
  ) {
    return 'فرایند ورود لغو شد. برای ادامه دوباره تلاش کنید.';
  }

  return 'ورود با ایمیل تکمیل نشد. آدرس ایمیل و اتصال اینترنت را بررسی کنید و دوباره تلاش کنید. اگر مشکل ادامه داشت، تنظیمات ارسال ایمیل و احراز هویت Supabase باید بررسی شود.';
}

/** Read provider errors returned in either the query string or URL fragment. */
export function getOAuthCallbackError(search: string, hash: string): unknown | null {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const params = [query, fragment];

  for (const source of params) {
    const errorCode = source.get('error_code') || source.get('error');
    const description = source.get('error_description') || source.get('msg');
    if (errorCode || description) {
      return {
        code: errorCode || undefined,
        error_code: source.get('error_code') || undefined,
        message: description || errorCode || 'OAuth sign-in failed',
      };
    }
  }

  return null;
}
