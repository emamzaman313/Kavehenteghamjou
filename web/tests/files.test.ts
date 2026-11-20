import { describe, expect, it } from 'vitest';
import { hashBlob, verifyBlobIntegrity } from '../lib/files';

const helloHash = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

describe('private file download integrity', () => {
  it('accepts a Blob with the recorded byte size and SHA-256 digest', async () => {
    const blob = new Blob(['hello']);
    expect(await hashBlob(blob)).toBe(helloHash);
    expect(await verifyBlobIntegrity(blob, 5, helloHash)).toBe(true);
  });

  it('rejects a byte-size mismatch', async () => {
    expect(await verifyBlobIntegrity(new Blob(['hello']), 4, helloHash)).toBe(false);
  });

  it('rejects a digest mismatch', async () => {
    expect(await verifyBlobIntegrity(new Blob(['hello']), 5, '0'.repeat(64))).toBe(false);
  });

  it('rejects missing or malformed digests', async () => {
    expect(await verifyBlobIntegrity(new Blob(['hello']), 5, '')).toBe(false);
    expect(await verifyBlobIntegrity(new Blob(['hello']), 5, 'not-a-sha256')).toBe(false);
  });
});
