import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSavedSearches } from './saved-searches';
import { MockRes } from '../_test/mock-res';

describe('api/_lib/saved-searches', () => {
  let taggedResults: unknown[][];
  let queryResults: unknown[][];
  let tagIdx: number;
  let qIdx: number;

  function makeSql() {
    const fn = async () => taggedResults[tagIdx++] ?? [];
    fn.query = async () => queryResults[qIdx++] ?? [];
    return fn as any;
  }

  beforeEach(() => {
    taggedResults = [];
    queryResults = [];
    tagIdx = 0;
    qIdx = 0;
  });

  it('GET returns saved searches with single-pass alert counts (skipping SQL for rent mode)', async () => {
    taggedResults = [
      [
        {
          id: 1,
          name: 'Buy Porto',
          filters: { mode: 'buy', city: 'Porto', rental_yield_min: '0.05' },
          last_checked_at: '2026-01-01',
          created_at: '2026-01-01',
        },
        {
          id: 2,
          name: 'Rent Porto',
          filters: { mode: 'rent', city: 'Porto' },
          last_checked_at: '2026-01-01',
          created_at: '2026-01-01',
        },
      ],
    ];
    queryResults = [[{ new_matches: 4, price_drops: 2 }]];

    const res = new MockRes();
    await handleSavedSearches({ method: 'GET', query: {} }, res as any, makeSql(), 'u1');

    expect(res._status).toBe(200);
    expect(qIdx).toBe(1); // Only 1 query executed for buy search; 0 for rent search!
    expect(res._body).toEqual([
      expect.objectContaining({ id: 1, new_matches: 4, price_drops: 2 }),
      expect.objectContaining({ id: 2, new_matches: 0, price_drops: 0 }),
    ]);
  });

  it('POST creates a new saved search when id is omitted and validates input', async () => {
    const badRes = new MockRes();
    await handleSavedSearches(
      { method: 'POST', query: {}, body: { name: '  ' } },
      badRes as any,
      makeSql(),
      'u1',
    );
    expect(badRes._status).toBe(400);

    taggedResults = [[{ id: 10, name: 'Test', filters: { city: 'Porto' } }]];
    const okRes = new MockRes();
    await handleSavedSearches(
      { method: 'POST', query: {}, body: { name: 'Test', filters: { city: 'Porto' } } },
      okRes as any,
      makeSql(),
      'u1',
    );
    expect(okRes._status).toBe(201);
    expect((okRes._body as any).new_matches).toBe(0);
  });

  it('POST with id marks search checked, DELETE removes search, and unsupported method returns 405', async () => {
    const checkRes = new MockRes();
    await handleSavedSearches(
      { method: 'POST', query: { id: '10' } },
      checkRes as any,
      makeSql(),
      'u1',
    );
    expect(checkRes._status).toBe(200);

    const missingIdDel = new MockRes();
    await handleSavedSearches(
      { method: 'DELETE', query: {} },
      missingIdDel as any,
      makeSql(),
      'u1',
    );
    expect(missingIdDel._status).toBe(400);

    const delRes = new MockRes();
    await handleSavedSearches(
      { method: 'DELETE', query: { id: '10' } },
      delRes as any,
      makeSql(),
      'u1',
    );
    expect(delRes._status).toBe(200);

    const putRes = new MockRes();
    await handleSavedSearches({ method: 'PUT', query: {} }, putRes as any, makeSql(), 'u1');
    expect(putRes._status).toBe(405);
  });
});
