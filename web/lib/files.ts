import { sha256 } from '@noble/hashes/sha256';

export async function hashFile(file: File): Promise<string> {
  const hasher = sha256.create();
  const reader = file.stream().getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      hasher.update(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return [...hasher.digest()].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}


/** Hashes a downloaded Blob incrementally without creating a second full-size buffer. */
export async function hashBlob(blob: Blob): Promise<string> {
  const hasher = sha256.create();
  const reader = blob.stream().getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      hasher.update(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return [...hasher.digest()].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Verifies a downloaded file against its persisted byte size and SHA-256 digest. */
export async function verifyBlobIntegrity(
  blob: Blob,
  expectedSize: number,
  expectedSha256: string,
): Promise<boolean> {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 0 || blob.size !== expectedSize) return false;
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) return false;
  return (await hashBlob(blob)) === expectedSha256.toLowerCase();
}

/** Saves a Blob using a local browser download after the caller verifies its integrity. */
export function saveBlobAs(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}
