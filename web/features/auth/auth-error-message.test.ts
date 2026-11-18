import { describe, expect, it } from 'vitest';
import { getGoogleAuthErrorMessage } from './auth-error-message';

describe('getGoogleAuthErrorMessage', () => {
  it('explains that the administrator must enable a disabled provider', () => {
    expect(getGoogleAuthErrorMessage(
      'Unsupported provider: provider is not enabled',
      'validation_failed',
    )).toContain('در تنظیمات سرور فعال نشده است');
  });

  it('explains user cancellation without exposing the raw provider error', () => {
    expect(getGoogleAuthErrorMessage('The user denied the request', 'access_denied'))
      .toContain('لغو شد');
  });

  it('provides a retryable network message', () => {
    expect(getGoogleAuthErrorMessage('Failed to fetch'))
      .toContain('اتصال اینترنت');
  });

  it('provides a safe fallback for unknown errors', () => {
    expect(getGoogleAuthErrorMessage('opaque upstream detail'))
      .toContain('دوباره تلاش کنید');
  });
});
