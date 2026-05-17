import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './stats';
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

describe('api/stats handler', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
  });

  it('returns 200 with the first row from the query', async () => {
    const mockStats = {
      total_active: 100,
      rented: 20,
      lifetime_rent: 5,
      avg_price: 150000,
      avg_price_per_m2: 2000,
      price_drops: 10,
    };
    queryResults = [[mockStats]];
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(200);
    expect(res._body).toEqual(mockStats);
  });

  it('returns 200 with undefined (result[0]) when result is empty', async () => {
    queryResults = [[]];
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(200);
    expect(res._body).toBeUndefined();
  });

  it('returns 500 with error message when DB throws', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any).error.message).toBe('DB error');
  });

  it('returns 500 with code when DB error has a code', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({} as any, res as any);
    expect(res._status).toBe(500);
  });
});
