import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RelativeDatePipe } from './relative-date.pipe';

describe('RelativeDatePipe', () => {
  let pipe: RelativeDatePipe;
  const BASE_TIME = new Date('2024-06-15T12:00:00Z').getTime();

  beforeEach(() => {
    pipe = new RelativeDatePipe();
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns em dash for null', () => {
    expect(pipe.transform(null)).toBe('—');
  });

  it('returns em dash for undefined', () => {
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('returns em dash for empty string', () => {
    expect(pipe.transform('')).toBe('—');
  });

  it('returns "just now" for less than 60 seconds ago', () => {
    const date = new Date(BASE_TIME - 30_000).toISOString();
    expect(pipe.transform(date)).toBe('just now');
  });

  it('returns "just now" for exactly 59 seconds ago', () => {
    const date = new Date(BASE_TIME - 59_000).toISOString();
    expect(pipe.transform(date)).toBe('just now');
  });

  it('returns "1 minute ago" for exactly 60 seconds ago', () => {
    const date = new Date(BASE_TIME - 60_000).toISOString();
    expect(pipe.transform(date)).toBe('1 minute ago');
  });

  it('returns "2 minutes ago" for 2 minutes ago', () => {
    const date = new Date(BASE_TIME - 2 * 60_000).toISOString();
    expect(pipe.transform(date)).toBe('2 minutes ago');
  });

  it('returns "1 hour ago" for exactly 60 minutes ago', () => {
    const date = new Date(BASE_TIME - 60 * 60_000).toISOString();
    expect(pipe.transform(date)).toBe('1 hour ago');
  });

  it('returns "3 hours ago" for 3 hours ago', () => {
    const date = new Date(BASE_TIME - 3 * 3600_000).toISOString();
    expect(pipe.transform(date)).toBe('3 hours ago');
  });

  it('returns "1 day ago" for exactly 24 hours ago', () => {
    const date = new Date(BASE_TIME - 24 * 3600_000).toISOString();
    expect(pipe.transform(date)).toBe('1 day ago');
  });

  it('returns "3 days ago" for 3 days ago', () => {
    const date = new Date(BASE_TIME - 3 * 24 * 3600_000).toISOString();
    expect(pipe.transform(date)).toBe('3 days ago');
  });

  it('returns "1 week ago" for exactly 7 days ago', () => {
    const date = new Date(BASE_TIME - 7 * 24 * 3600_000).toISOString();
    expect(pipe.transform(date)).toBe('1 week ago');
  });

  it('returns "2 weeks ago" for 14 days ago', () => {
    const date = new Date(BASE_TIME - 14 * 24 * 3600_000).toISOString();
    expect(pipe.transform(date)).toBe('2 weeks ago');
  });

  it('returns "1 month ago" for 35 days ago (> 4 weeks)', () => {
    const date = new Date(BASE_TIME - 35 * 24 * 3600_000).toISOString();
    expect(pipe.transform(date)).toBe('1 month ago');
  });

  it('returns "2 months ago" for 62 days ago', () => {
    const date = new Date(BASE_TIME - 62 * 24 * 3600_000).toISOString();
    expect(pipe.transform(date)).toBe('2 months ago');
  });

  it('returns "1 year ago" for 365 days ago', () => {
    const date = new Date(BASE_TIME - 365 * 24 * 3600_000).toISOString();
    expect(pipe.transform(date)).toBe('1 year ago');
  });

  it('returns "2 years ago" for 730 days ago', () => {
    const date = new Date(BASE_TIME - 730 * 24 * 3600_000).toISOString();
    expect(pipe.transform(date)).toBe('2 years ago');
  });
});

