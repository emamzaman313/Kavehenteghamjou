import { describe, expect, it } from 'vitest';
import { authErrorMessage, getOAuthCallbackError } from '../lib/auth-errors';

describe('authErrorMessage', () => {
  it('explains that Google sign-in must be enabled when Supabase rejects the provider', () => {
    expect(authErrorMessage({
      code: 'validation_failed',
      message: 'Unsupported provider: provider is not enabled',
    })).toContain('Google');
    expect(authErrorMessage({
      error_code: 'provider_disabled',
      msg: 'provider is not enabled',
    })).toContain('Google');
  });

  it('offers a retry for network failures', () => {
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toContain('اتصال');
  });

  it('uses email-specific guidance for unknown OTP errors', () => {
    const message = authErrorMessage({ message: 'unexpected OTP failure' });
    expect(message).toContain('ایمیل');
    expect(message).not.toContain('گوگل');
  });

  it('does not expose raw provider payloads for unknown authentication errors', () => {
    const message = authErrorMessage({ message: '{"access_token":"secret"}' });
    expect(message).not.toContain('access_token');
    expect(message).not.toContain('secret');
    expect(message).toContain('دوباره');
  });
});

describe('getOAuthCallbackError', () => {
  it('reads provider errors returned in the query string', () => {
    const error = getOAuthCallbackError(
      '?error=server_error&error_code=provider_disabled&error_description=Google+is+disabled',
      '',
    );
    expect(authErrorMessage(error)).toContain('Google');
  });

  it('reads provider errors returned in the URL fragment', () => {
    const error = getOAuthCallbackError(
      '',
      '#error=access_denied&error_description=User+cancelled',
    );
    expect(authErrorMessage(error)).toContain('لغو');
  });

  it('returns null when the callback contains no OAuth error', () => {
    expect(getOAuthCallbackError('?code=authorization-code', '')).toBeNull();
  });
});
