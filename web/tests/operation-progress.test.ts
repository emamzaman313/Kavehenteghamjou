import { describe, expect, it } from 'vitest';
import { advanceOperationPercent, formatOperationPercent } from '../lib/operation-progress';

describe('operation progress percentages', () => {
  it('never regresses when a late stage reports a smaller value', () => {
    expect(advanceOperationPercent(64, 24)).toBe(64);
    expect(advanceOperationPercent(86, 42)).toBe(86);
  });

  it('bounds running progress below completion until the operation resolves', () => {
    expect(advanceOperationPercent(6, -20)).toBe(6);
    expect(advanceOperationPercent(90, 150)).toBe(95);
    expect(advanceOperationPercent(95, 96)).toBe(95);
  });

  it('formats percentages using Persian digits', () => {
    expect(formatOperationPercent(79)).toBe('۷۹٪');
    expect(formatOperationPercent(100)).toBe('۱۰۰٪');
  });
});
