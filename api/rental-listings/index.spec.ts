import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './index';
import { MockRes } from '../test/mock-res';

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

function req(
  query: Record<string, string | undefined> = {},
  auth?: string,
): Record<string, unknown> {
  return {
    method: 'GET',
    query,
    headers: auth ? { authorization: auth } : {},
  };
}

describe('api/rental-listings/index handler', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
    process.env['NODE_ENV'] = 'test';
  });

  it('returns 405 for non-GET methods', async () => {
    const res = new MockRes();
    await handler({ method: 'POST', query: {}, headers: {} } as any, res as any);
    expect(res._status).toBe(405);
  });

  it('returns 200 with data and total on success (no auth)', async () => {
    queryResults = [[{ id: '1', title: 'T' }], [{ total: 1 }]];
    const res = new MockRes();
    await handler(req() as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any).data).toEqual([{ id: '1', title: 'T' }]);
    expect((res._body as any).total).toBe(1);
  });

  it('returns 500 when DB throws (no auth)', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler(req() as any, res as any);
    expect(res._status).toBe(500);
  });

  it('uses default limit 50 and offset 0', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req() as any, res as any);
    expect((res._body as any).limit).toBe(50);
    expect((res._body as any).offset).toBe(0);
  });

  it('clamps limit to max 100', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ limit: '999' }) as any, res as any);
    expect((res._body as any).limit).toBe(100);
  });

  it('clamps limit to min 1 for negative', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ limit: '-5' }) as any, res as any);
    expect((res._body as any).limit).toBe(1);
  });

  it('falls back to default limit 50 for non-numeric limit', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ limit: 'abc' }) as any, res as any);
    expect((res._body as any).limit).toBe(50);
  });

  it('applies custom offset', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ offset: '25' }) as any, res as any);
    expect((res._body as any).offset).toBe(25);
  });

  it('falls back to invalid sort to "price"', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ sort: 'DROP TABLE' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('accepts allowed sort "rent_price_per_m2" with desc order', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ sort: 'rent_price_per_m2', order: 'desc' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by price_min and price_max', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ price_min: '500', price_max: '1500' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by area_min and area_max', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ area_min: '50', area_max: '120' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by rent_price_per_m2_min and rent_price_per_m2_max', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      req({ rent_price_per_m2_min: '10', rent_price_per_m2_max: '25' }) as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by typology (comma-separated)', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ typology: 'T1,T2' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by city (comma-separated)', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ city: 'Porto,Lisboa' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by neighborhood (comma-separated)', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ neighborhood: 'Bonfim,Alfama' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by is_new=true', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ is_new: 'true' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by price_change=reduced', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ price_change: 'reduced' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by price_change=increased', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ price_change: 'increased' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by active=true', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ active: 'true' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by active=false', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ active: 'false' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('uses auth path when Authorization header is present (dev-token)', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({}, 'Bearer dev-token') as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by is_favorite=true with auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({ is_favorite: 'true' }, 'Bearer dev-token') as any, res as any);
    expect(res._status).toBe(200);
  });

  it('returns 500 when DB throws with auth path', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler(req({}, 'Bearer dev-token') as any, res as any);
    expect(res._status).toBe(500);
  });
});

// JWT auth path coverage
function makeJwtToken(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.fakesig`;
}

describe('api/rental-listings JWT auth paths', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
    process.env['NODE_ENV'] = 'test';
  });

  it('authenticates via JWT with id in payload', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      req({}, `Bearer ${makeJwtToken({ id: 'user1', email: 'u@test.com' })}`) as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('authenticates via JWT with sub in payload', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({}, `Bearer ${makeJwtToken({ sub: 'sub1' })}`) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('returns 200 unauthenticated for JWT with no id or sub', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(req({}, `Bearer ${makeJwtToken({ email: 'u@test.com' })}`) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('returns 200 unauthenticated for expired JWT', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      req(
        {},
        `Bearer ${makeJwtToken({ id: 'u', exp: Math.floor(Date.now() / 1000) - 3600 })}`,
      ) as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });
});
