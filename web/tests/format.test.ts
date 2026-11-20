import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, formatBytes, safeDisplayName, validateUpload } from '../lib/format';

describe('file rules', () => {
  it('uses the exact decimal 50 MB cap', () => {
    expect(MAX_FILE_BYTES).toBe(50_000_000);
    expect(validateUpload({ size: 50_000_000 })).toBeNull();
    expect(validateUpload({ size: 50_000_001 })).not.toBeNull();
  });
  it('does not reject file extensions', () => {
    expect(validateUpload({ size: 1024 })).toBeNull();
  });
  it('preserves Unicode names while neutralizing path separators', () => {
    expect(safeDisplayName('گزارش 📁.zip')).toBe('گزارش 📁.zip');
    expect(safeDisplayName('../../secret.txt')).toBe('.._.._secret.txt');
  });
  it('formats decimal megabytes', () => {
    expect(formatBytes(50_000_000)).toBe('50.00 MB');
  });
});
