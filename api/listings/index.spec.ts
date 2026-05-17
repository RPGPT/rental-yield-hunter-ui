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
    await handler({ method: 'GET', query: {}, headers: {} } as any, res as any);
    expect(res._status).toBe(500);
  });

  it('returns 200 with data and total on success', async () => {
    queryResults = [[{ id: '1', title: 'T' }], [{ total: 1 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: {}, headers: {} } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.data).toEqual([{ id: '1', title: 'T' }]);
    expect((res._body as any)?.total).toBe(1);
  });

  it('returns rent_current_rent and rent_contract_expiry from contract details join', async () => {
    queryResults = [
      [{ id: '1', rent_current_rent: 750, rent_contract_expiry: '2027-06-01' }],
      [{ total: 1 }],
    ];
    const res = new MockRes();
    await handler({ method: 'GET', query: {}, headers: {} } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.data[0].rent_current_rent).toBe(750);
    expect((res._body as any)?.data[0].rent_contract_expiry).toBe('2027-06-01');
  });

  it('returns null contract fields when no contract details for listing', async () => {
    queryResults = [
      [{ id: '1', rent_current_rent: null, rent_contract_expiry: null }],
      [{ total: 1 }],
    ];
    const res = new MockRes();
    await handler({ method: 'GET', query: {}, headers: {} } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.data[0].rent_current_rent).toBeNull();
    expect((res._body as any)?.data[0].rent_contract_expiry).toBeNull();
  });

  it('uses default limit of 50', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: {}, headers: {} } as any, res as any);
    expect((res._body as any)?.limit).toBe(50);
  });

  it('uses default offset of 0', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: {}, headers: {} } as any, res as any);
    expect((res._body as any)?.offset).toBe(0);
  });

  it('applies custom limit', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { limit: '10' }, headers: {} } as any, res as any);
    expect((res._body as any)?.limit).toBe(10);
  });

  it('applies custom offset', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { offset: '20' }, headers: {} } as any, res as any);
    expect((res._body as any)?.offset).toBe(20);
  });

  it('clamps limit to maximum 100', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { limit: '999' }, headers: {} } as any, res as any);
    expect((res._body as any)?.limit).toBe(100);
  });

  it('clamps limit to minimum 1 for negative input', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { limit: '-1' }, headers: {} } as any, res as any);
    expect((res._body as any)?.limit).toBe(1);
  });

  it('falls back to default limit 50 when limit is non-numeric', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { limit: 'invalid' }, headers: {} } as any, res as any);
    expect((res._body as any)?.limit).toBe(50);
  });

  it('rejects invalid sort column and falls back to price', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { sort: 'DROP TABLE' }, headers: {} } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('accepts allowed sort column "area" with order desc', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { sort: 'area', order: 'desc' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by price_min and price_max', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { price_min: '500', price_max: '1500' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by area_min and area_max', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { area_min: '50', area_max: '120' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by typology (comma-separated)', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { typology: 'T2,T3' }, headers: {} } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('filters by city (comma-separated)', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { city: 'Porto,Lisboa' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by property_type', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { property_type: 'Apartment' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by all boolean flags', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: {
          has_garage: 'true',
          is_rented: 'false',
          lifetime_rent: 'true',
          is_favorite: 'true',
          active: 'true',
        },
        headers: {},
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by is_new=true using 2-day interval', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { is_new: 'true' }, headers: {} } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('does not add is_new condition when is_new is not "true"', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { is_new: 'false' }, headers: {} } as any, res as any);
    expect(res._status).toBe(200);
  });

  it('excludes hidden listings when is_hidden=false', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { is_hidden: 'false' },
        headers: { authorization: 'Bearer token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('shows only hidden listings when is_hidden=true', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { is_hidden: 'true' },
        headers: { authorization: 'Bearer token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('shows all listings (no hidden filter) when is_hidden is absent', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: {},
        headers: { authorization: 'Bearer token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by price_change=reduced', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { price_change: 'reduced' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by price_change=increased', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { price_change: 'increased' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by rental_yield_min', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { rental_yield_min: '5' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('sorts by estimated_rent (re column) without auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { sort: 'estimated_rent' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('sorts by rental_yield (re column) without auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: { sort: 'rental_yield' }, headers: {} } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('returns 200 with data using dev-token (auth path)', async () => {
    queryResults = [[{ id: '1', title: 'Auth Test' }], [{ total: 1 }]];
    const res = new MockRes();
    await handler(
      { method: 'GET', query: {}, headers: { authorization: 'Bearer dev-token' } } as any,
      res as any,
    );
    expect(res._status).toBe(200);
    expect((res._body as any).data).toEqual([{ id: '1', title: 'Auth Test' }]);
  });

  it('filters by price_change=reduced with auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { price_change: 'reduced' },
        headers: { authorization: 'Bearer dev-token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by price_change=increased with auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { price_change: 'increased' },
        headers: { authorization: 'Bearer dev-token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by rental_yield_min with auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { rental_yield_min: '4' },
        headers: { authorization: 'Bearer dev-token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('sorts by estimated_rent (re column) with auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { sort: 'estimated_rent' },
        headers: { authorization: 'Bearer dev-token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('sorts by rental_yield (re column) with auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { sort: 'rental_yield' },
        headers: { authorization: 'Bearer dev-token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('returns 500 when DB throws with auth path', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler(
      { method: 'GET', query: {}, headers: { authorization: 'Bearer dev-token' } } as any,
      res as any,
    );
    expect(res._status).toBe(500);
  });

  it('filters by is_favorite=true with auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { is_favorite: 'true' },
        headers: { authorization: 'Bearer dev-token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by is_hidden=true with auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { is_hidden: 'true' },
        headers: { authorization: 'Bearer dev-token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('filters by is_hidden=false with auth', async () => {
    queryResults = [[], [{ total: 0 }]];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { is_hidden: 'false' },
        headers: { authorization: 'Bearer dev-token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });
});
