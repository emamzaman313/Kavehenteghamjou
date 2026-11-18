export const MAX_FILE_BYTES = 50_000_000;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1_000) return `${bytes} بایت`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

export function validateUpload(file: Pick<File, 'size'>): string | null {
  if (file.size <= 0) return 'فایل خالی است.';
  if (file.size > MAX_FILE_BYTES) return 'حجم فایل از سقف ۵۰٬۰۰۰٬۰۰۰ بایت بیشتر است.';
  return null;
}

export function safeDisplayName(name: string): string {
  return name.replace(/[\\/\u0000-\u001f\u007f]/g, '_').slice(0, 255) || 'file';
}

export function initials(value: string): string {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('') || 'ک';
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
