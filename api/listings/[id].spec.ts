import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './[id]';
import { MockRes } from '../test/mock-res';

let queryIndex = 0;
let queryResults: unknown[][] = [];
let dbThrows = false;

vi.mock('@neondatabase/serverless', () => ({
  neon: () => {
    const fn = async (..._: unknown[]) => {
      if (dbThrows) throw new Error('DB error');
      return queryResults[queryIndex++] ?? [];
    };
    (fn as any).query = async (..._: unknown[]) => {
      if (dbThrows) throw new Error('DB error');
      return queryResults[queryIndex++] ?? [];
    };
    return fn;
  },
}));

describe('api/listings/[id] handler', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
  });

  it('returns 400 when id is missing', async () => {
    const res = new MockRes();
    await handler({ method: 'GET', query: {}, headers: {} } as any, res as any);
    expect(res._status).toBe(400);
    expect((res._body as any)?.error).toBe('Missing listing ID');
  });

  it('returns 405 for unsupported methods', async () => {
    const res = new MockRes();
    await handler({ method: 'POST', query: { id: '42' }, headers: {} } as any, res as any);
    expect(res._status).toBe(405);
    expect((res._body as any)?.error).toBe('Method not allowed');
  });

  it('returns 405 for DELETE method', async () => {
    const res = new MockRes();
    await handler({ method: 'DELETE', query: { id: '42' }, headers: {} } as any, res as any);
    expect(res._status).toBe(405);
  });

  describe('PATCH', () => {
    it('returns 400 when body is missing', async () => {
      const res = new MockRes();
      await handler(
        { method: 'PATCH', query: { id: '42' }, headers: {}, body: null } as any,
        res as any,
      );
      expect(res._status).toBe(400);
      expect((res._body as any)?.error).toBe('Invalid request body');
    });

    it('returns 400 when body has no valid fields', async () => {
      const res = new MockRes();
      await handler(
        { method: 'PATCH', query: { id: '42' }, headers: {}, body: { foo: 'bar' } } as any,
        res as any,
      );
      expect(res._status).toBe(400);
      expect((res._body as any)?.error).toBe('No valid fields to update');
    });

    it('updates is_rented and returns 200', async () => {
      queryResults = [[]]; // UPDATE returns empty
      const res = new MockRes();
      await handler(
        {
          method: 'PATCH',
          query: { id: '42' },
          headers: {},
          body: { is_rented: true },
        } as any,
        res as any,
      );
      expect(res._status).toBe(200);
      expect((res._body as any)?.ok).toBe(true);
    });

    it('updates lifetime_rent and returns 200', async () => {
      queryResults = [[]];
      const res = new MockRes();
      await handler(
        {
          method: 'PATCH',
          query: { id: '42' },
          headers: {},
          body: { lifetime_rent: false },
        } as any,
        res as any,
      );
      expect(res._status).toBe(200);
      expect((res._body as any)?.ok).toBe(true);
    });

    it('updates both fields at once and returns 200', async () => {
      queryResults = [[]];
      const res = new MockRes();
      await handler(
        {
          method: 'PATCH',
          query: { id: '42' },
          headers: {},
          body: { is_rented: false, lifetime_rent: true },
        } as any,
        res as any,
      );
      expect(res._status).toBe(200);
    });

    it('returns 500 on database error', async () => {
      dbThrows = true;
      const res = new MockRes();
      await handler(
        {
          method: 'PATCH',
          query: { id: '42' },
          headers: {},
          body: { is_rented: true },
        } as any,
        res as any,
      );
      expect(res._status).toBe(500);
    });
  });

  it('GET returns 404 when listing does not exist', async () => {
    queryResults = [[]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '999' }, headers: {} } as any, res as any);
    expect(res._status).toBe(404);
    expect((res._body as any)?.error).toBe('Listing not found');
  });

  it('GET returns listing with price_history and images', async () => {
    queryResults = [
      [{ id: '42', title: 'Test', price: 1000 }],
      [{ price: 1000, captured_at: '2024-01-01' }],
      [{ images: [{ large: 'http://img/1.jpg', medium: 'http://img/1m.jpg' }] }],
    ];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' }, headers: {} } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.title).toBe('Test');
    expect((res._body as any)?.price_history).toEqual([{ price: 1000, captured_at: '2024-01-01' }]);
    expect((res._body as any)?.images).toEqual([
      { large: 'http://img/1.jpg', medium: 'http://img/1m.jpg' },
    ]);
  });

  it('GET returns empty images when raw_data has no rows', async () => {
    queryResults = [[{ id: '42', title: 'T', price: 100 }], [], []];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' }, headers: {} } as any, res as any);
    expect((res._body as any)?.images).toEqual([]);
  });

  it('GET returns empty images when raw_data images is not an array', async () => {
    queryResults = [[{ id: '42', title: 'T', price: 100 }], [], [{ images: null }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' }, headers: {} } as any, res as any);
    expect((res._body as any)?.images).toEqual([]);
  });

  it('GET returns 500 on database error', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' }, headers: {} } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error?.message).toBe('DB error');
  });
});
