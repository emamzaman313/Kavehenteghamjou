/** Normalize the six-character shared access code before sending it to Supabase. */
export function normalizeAccessCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
}

export function isValidAccessCode(value: string): boolean {
  return /^[A-Z0-9]{6}$/.test(value);
}
