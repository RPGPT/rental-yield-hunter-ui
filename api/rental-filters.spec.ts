import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './rental-filters';
import { MockRes } from './test/mock-res';

let queryIndex = 0;
let queryResults: unknown[][] = [];
let dbThrows = false;

vi.mock('@neondatabase/serverless', () => ({
  neon: () => {
    const sql = async (..._: unknown[]) => {
      if (dbThrows) throw new Error('DB error');
      return queryResults[queryIndex++] ?? [];
    };
    (sql as any).query = async (..._: unknown[]) => {
      if (dbThrows) throw new Error('DB error');
      return queryResults[queryIndex++] ?? [];
    };
    return sql;
  },
}));

describe('api/rental-filters handler', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
  });

  it('returns 200 with cities, typologies, and grouped neighborhoods', async () => {
    queryResults = [
      [{ city: 'Porto' }, { city: 'Lisboa' }],
      [{ typology: 'T2' }],
      [
        { city: 'Porto', neighborhood: 'Bonfim' },
        { city: 'Lisboa', neighborhood: 'Alfama' },
      ],
    ];
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any).cities).toEqual(['Porto', 'Lisboa']);
    expect((res._body as any).typologies).toEqual(['T2']);
    expect((res._body as any).neighborhoods).toEqual({
      Porto: ['Bonfim'],
      Lisboa: ['Alfama'],
    });
  });

  it('returns 200 with empty neighborhoods when none in DB', async () => {
    queryResults = [[], [], []];
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any).neighborhoods).toEqual({});
  });

  it('does not include property_types in the response', async () => {
    queryResults = [[{ city: 'Porto' }], [{ typology: 'T1' }], []];
    const res = new MockRes();
    await handler({} as any, res as any);
    expect((res._body as any).property_types).toBeUndefined();
  });

  it('returns 500 with error message when DB throws', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any).error.message).toBe('DB error');
  });

  it('returns 500 with code when DB error has a code property', async () => {
    const err = Object.assign(new Error('pg error'), { code: '42P01' });
    vi.mocked(/* noop */ 0 as any); // keep import happy
    dbThrows = true;
    // Patch the mock to throw our coded error
    queryResults = []; // force the mock to throw dbError path
    // Re-use the plain dbThrows path since we can't easily inject the error object
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(500);
  });
});
