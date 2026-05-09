import { describe, it, expect, beforeEach } from 'vitest';
import { EurPipe } from './eur.pipe';

describe('EurPipe', () => {
  let pipe: EurPipe;

  beforeEach(() => {
    pipe = new EurPipe();
  });

  it('returns em dash for null', () => {
    expect(pipe.transform(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('formats zero', () => {
    const result = pipe.transform(0);
    expect(result).toMatch(/€$/);
    expect(result).toContain('0');
  });

  it('formats a positive integer', () => {
    const result = pipe.transform(500);
    expect(result).toMatch(/€$/);
    expect(result).toContain('500');
  });

  it('strips decimal places (maximumFractionDigits: 0)', () => {
    const result = pipe.transform(1234.99);
    expect(result).not.toMatch(/[.,]\d{1,2}€$/);
    expect(result).toMatch(/€$/);
  });

  it('formats a large number', () => {
    const result = pipe.transform(100000);
    expect(result).toMatch(/€$/);
    expect(result.replace(/[€\s\u00a0,.]/g, '')).toContain('100000');
  });
});
