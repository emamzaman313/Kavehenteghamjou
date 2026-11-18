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

  it('gives a specific instruction when a one-time sign-in link is expired', () => {
    const message = authErrorMessage({
      code: 'otp_expired',
      message: 'token has expired or is invalid',
    });
    expect(message).toContain('لینک ورود');
    expect(message).toContain('لینک تازه');
  });

  it('explains the email send rate limit without suggesting an SMTP failure', () => {
    const message = authErrorMessage({
      status: 429,
      code: 'over_email_send_rate_limit',
      message: 'For security purposes, you can only request this after 8 seconds.',
    });
    expect(message).toContain('چند لحظه صبر');
    expect(message).not.toContain('SMTP');
  });

  it('explains when the Supabase redirect URL is not allow-listed', () => {
    const message = authErrorMessage({
      message: 'redirect_to is not allowed',
    });
    expect(message).toContain('URL Configuration');
    expect(message).toContain('kaveh-avenger.vercel.app');
  });

  it('uses email-specific guidance for unknown sign-in errors', () => {
    const message = authErrorMessage({ message: 'unexpected email sign-in failure' });
    expect(message).toContain('لینک ورود ایمیل');
    expect(message).not.toContain('گوگل');
  });

  it('does not expose raw provider payloads for unknown authentication errors', () => {
    const message = authErrorMessage({ message: '{"access_token":"secret"}' });
    expect(message).not.toContain('access_token');
    expect(message).not.toContain('secret');
    expect(message).toContain('بررسی');
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

  it('reads an expired magic-link callback error', () => {
    const error = getOAuthCallbackError(
      '?error=access_denied&error_code=otp_expired&error_description=Token+has+expired',
      '',
    );
    expect(authErrorMessage(error)).toContain('لینک ورود');
  });

  it('returns null when the callback contains no OAuth error', () => {
    expect(getOAuthCallbackError('?code=authorization-code', '')).toBeNull();
  });
});
