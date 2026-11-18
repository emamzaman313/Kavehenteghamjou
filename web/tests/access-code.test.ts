import { describe, expect, it } from 'vitest';
import { isValidAccessCode, normalizeAccessCode } from '../lib/access-code';

describe('shared access code', () => {
  it('normalizes letters to uppercase and removes separators', () => {
    expect(normalizeAccessCode(' ab-12 3 ')).toBe('AB123');
  });

  it('limits input to six characters', () => {
    expect(normalizeAccessCode('123456789')).toBe('123456');
  });

  it('accepts exactly six alphanumeric characters', () => {
    expect(isValidAccessCode('123456')).toBe(true);
    expect(isValidAccessCode('AB12CD')).toBe(true);
  });

  it('rejects short, long, and non-ASCII codes', () => {
    expect(isValidAccessCode('12345')).toBe(false);
    expect(isValidAccessCode('1234567')).toBe(false);
    expect(isValidAccessCode('۱۲۳۴۵۶')).toBe(false);
    expect(isValidAccessCode('12-456')).toBe(false);
  });
});
