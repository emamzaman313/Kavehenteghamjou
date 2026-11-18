import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '../lib/auth-errors';

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

  it('does not expose raw provider payloads for unknown authentication errors', () => {
    const message = authErrorMessage({ message: '{"access_token":"secret"}' });
    expect(message).not.toContain('access_token');
    expect(message).not.toContain('secret');
    expect(message).toContain('دوباره');
  });
});
