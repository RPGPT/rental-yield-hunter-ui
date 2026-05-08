import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './[id]';

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

class MockRes {
  _status = 200;
  _body: unknown = null;
  status(code: number) {
    this._status = code;
    return this;
  }
  json(body: unknown) {
    this._body = body;
    return this;
  }
  send(body: unknown) {
    this._body = body;
    return this;
  }
  setHeader() {
    return this;
  }
}

describe('api/listings/[id] handler', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
  });

  it('returns 400 when id is missing', async () => {
    const res = new MockRes();
    await handler({ method: 'GET', query: {} } as any, res as any);
    expect(res._status).toBe(400);
    expect((res._body as any)?.error).toBe('Missing listing ID');
  });

  it('PATCH returns 400 when is_favorite param is not provided', async () => {
    queryResults = [[]];
    const res = new MockRes();
    await handler({ method: 'PATCH', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(400);
    expect((res._body as any)?.error).toBe('Missing is_favorite param');
  });

  it('PATCH sets is_favorite=true and returns 200', async () => {
    queryResults = [[]];
    const res = new MockRes();
    await handler({ method: 'PATCH', query: { id: '42', is_favorite: 'true' } } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.is_favorite).toBe(true);
    expect((res._body as any)?.id).toBe('42');
  });

  it('PATCH sets is_favorite=false and returns 200', async () => {
    queryResults = [[]];
    const res = new MockRes();
    await handler(
      { method: 'PATCH', query: { id: '42', is_favorite: 'false' } } as any,
      res as any,
    );
    expect(res._status).toBe(200);
    expect((res._body as any)?.is_favorite).toBe(false);
  });

  it('GET returns 404 when listing does not exist', async () => {
    queryResults = [[]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '999' } } as any, res as any);
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
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
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
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect((res._body as any)?.images).toEqual([]);
  });

  it('GET returns empty images when raw_data images is not an array', async () => {
    queryResults = [[{ id: '42', title: 'T', price: 100 }], [], [{ images: null }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect((res._body as any)?.images).toEqual([]);
  });

  it('GET returns 500 on database error', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error).toBe('Internal server error');
  });
});
