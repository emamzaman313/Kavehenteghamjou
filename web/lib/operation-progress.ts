export function advanceOperationPercent(current: number, requested: number): number {
  const bounded = Math.max(6, Math.min(95, Math.round(requested)));
  return Math.max(Math.max(6, Math.min(95, Math.round(current))), bounded);
}

export function formatOperationPercent(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value))).toLocaleString('fa-IR')}٪`;
}
