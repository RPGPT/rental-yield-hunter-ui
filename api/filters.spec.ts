import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './filters';
import { MockRes } from './test/mock-res';

let queryIndex = 0;
let queryResults: unknown[][] = [];
let dbThrows = false;
let dbError: Error | null = null;

vi.mock('@neondatabase/serverless', () => ({
  neon: () => {
    const sql = async (..._: unknown[]) => {
      if (dbThrows) throw dbError ?? new Error('DB error');
      return queryResults[queryIndex++] ?? [];
    };
    (sql as any).query = async (..._: unknown[]) => {
      if (dbThrows) throw dbError ?? new Error('DB error');
      return queryResults[queryIndex++] ?? [];
    };
    return sql;
  },
}));

describe('api/filters handler', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    dbError = null;
    process.env['DATABASE_URL'] = 'postgresql://mock';
  });

  it('returns 200 with cities, typologies, property_types, and grouped neighborhoods', async () => {
    queryResults = [
      [{ city: 'Porto' }, { city: 'Lisboa' }],
      [{ typology: 'T2' }, { typology: 'T3' }],
      [{ property_type: 'Apartment' }],
      [
        { city: 'Porto', neighborhood: 'Bonfim' },
        { city: 'Porto', neighborhood: 'Paranhos' },
        { city: 'Lisboa', neighborhood: 'Alfama' },
      ],
    ];
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any).cities).toEqual(['Porto', 'Lisboa']);
    expect((res._body as any).typologies).toEqual(['T2', 'T3']);
    expect((res._body as any).property_types).toEqual(['Apartment']);
    expect((res._body as any).neighborhoods).toEqual({
      Porto: ['Bonfim', 'Paranhos'],
      Lisboa: ['Alfama'],
    });
  });

  it('returns 200 with empty neighborhoods when none in DB', async () => {
    queryResults = [[], [], [], []];
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any).neighborhoods).toEqual({});
  });

  it('returns 500 with error message when DB throws plain Error', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any).error.message).toBe('DB error');
  });

  it('returns 500 with code when DB error has a code property', async () => {
    const err = Object.assign(new Error('pg error'), { code: '23505' });
    dbError = err;
    dbThrows = true;
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any).error.code).toBe('23505');
  });

  it('returns 500 with stringified error when error is not an Error instance', async () => {
    // Make the neon mock throw a string
    queryResults = [];
    dbThrows = true;
    dbError = 'string error' as any;
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(500);
  });
});
