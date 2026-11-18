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
