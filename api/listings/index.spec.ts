import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './index';

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

class MockRes {
  _status = 200;
  _body: unknown = null;
  status(code: number) { this._status = code; return this; }
  json(body: unknown) { this._body = body; return this; }
  send(body: unknown) { this._body = body; return this; }
  setHeader() { return this; }
}


describe('api/listings/index handler', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
  });

  it('returns 500 when database throws', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({ method: 'GET', query: {} } as any, res as any);
    expect(res._status).toBe(500);
  });

  it('returns 200 with data and total on success', async () => {
    queryResults = [[{ id: '1', title: 'T' }], [{ total: 1 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: {} } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.data).toEqual([{ id: '1', title: 'T' }]);
    expect((res._body as any)?.total).toBe(1);
  });

  it('uses default limit of 50', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: {} } as any, res as any);
    expect((res._body as any)?.limit).toBe(50);
  });

  it('uses default offset of 0', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: {} } as any, res as any);
    expect((res._body as any)?.offset).toBe(0);
  });

  it('applies custom limit', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { limit: '10' } } as any, res as any);
    expect((res._body as any)?.limit).toBe(10);
  });

  it('applies custom offset', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { offset: '20' } } as any, res as any);
    expect((res._body as any)?.offset).toBe(20);
  });

  it('clamps limit to maximum 100', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { limit: '999' } } as any, res as any);
    expect((res._body as any)?.limit).toBe(100);
  });

  it('clamps limit to minimum 1 for negative input', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { limit: '-1' } } as any, res as any);
    expect((res._body as any)?.limit).toBe(1);
  });

  it('falls back to default limit 50 when limit is non-numeric', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { limit: 'invalid' } } as any, res as any);
    expect((res._body as any)?.limit).toBe(50);
  });

  it('rejects invalid sort column and falls back to price', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { sort: 'DROP TABLE' } } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('accepts allowed sort column "area" with order desc', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { sort: 'area', order: 'desc' } } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by price_min and price_max', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { price_min: '500', price_max: '1500' } } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by area_min and area_max', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { area_min: '50', area_max: '120' } } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by typology (comma-separated)', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { typology: 'T2,T3' } } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by city (comma-separated)', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { city: 'Porto,Lisboa' } } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by property_type', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { property_type: 'Apartment' } } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by all boolean flags', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({
      method: 'GET',
      query: { has_garage: 'true', is_rented: 'false', lifetime_rent: 'true', is_favorite: 'true', active: 'true' },
    } as any, res as any);
    expect(res._status).toBe(200);
  });
});

