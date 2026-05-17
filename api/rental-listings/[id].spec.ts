import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './[id]';
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

describe('api/rental-listings/[id] handler', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
    process.env['NODE_ENV'] = 'test';
  });

  it('returns 400 when id is missing', async () => {
    const res = new MockRes();
    await handler({ method: 'GET', query: {}, headers: {} } as any, res as any);
    expect(res._status).toBe(400);
    expect((res._body as any).error).toBe('Missing listing ID');
  });

  it('returns 400 when id is not a string (e.g., array)', async () => {
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: ['a', 'b'] }, headers: {} } as any, res as any);
    expect(res._status).toBe(400);
  });

  it('returns 405 for non-GET methods', async () => {
    const res = new MockRes();
    await handler({ method: 'POST', query: { id: '42' }, headers: {} } as any, res as any);
    expect(res._status).toBe(405);
    expect((res._body as any).error).toBe('Method not allowed');
  });

  it('returns 405 for DELETE method', async () => {
    const res = new MockRes();
    await handler({ method: 'DELETE', query: { id: '42' }, headers: {} } as any, res as any);
    expect(res._status).toBe(405);
  });

  it('returns 404 when listing does not exist', async () => {
    queryResults = [[]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '999' }, headers: {} } as any, res as any);
    expect(res._status).toBe(404);
    expect((res._body as any).error).toBe('Rental listing not found');
  });

  it('returns 200 with listing, price_history, and images', async () => {
    queryResults = [
      [{ id: '42', title: 'Rental', price: 900 }],
      [{ price: 900, captured_at: '2024-01-01' }],
      [{ images: [{ large: 'http://img/1.jpg', medium: 'http://img/1m.jpg' }] }],
    ];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' }, headers: {} } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any).title).toBe('Rental');
    expect((res._body as any).price_history).toEqual([{ price: 900, captured_at: '2024-01-01' }]);
    expect((res._body as any).images).toEqual([
      { large: 'http://img/1.jpg', medium: 'http://img/1m.jpg' },
    ]);
  });

  it('returns empty images when raw_data has no rows', async () => {
    queryResults = [[{ id: '42', title: 'R', price: 800 }], [], []];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' }, headers: {} } as any, res as any);
    expect((res._body as any).images).toEqual([]);
  });

  it('returns empty images when raw_data images is not an array', async () => {
    queryResults = [[{ id: '42', title: 'R', price: 800 }], [], [{ images: null }]];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' }, headers: {} } as any, res as any);
    expect((res._body as any).images).toEqual([]);
  });

  it('returns 500 when DB throws', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' }, headers: {} } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any).error.message).toBe('DB error');
  });

  it('uses auth path when dev-token is provided', async () => {
    queryResults = [
      [{ id: '42', title: 'Rental', price: 900 }],
      [{ price: 900, captured_at: '2024-01-01' }],
      [],
    ];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { id: '42' },
        headers: { authorization: 'Bearer dev-token' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
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

describe('api/rental-listings/[id] JWT auth paths', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
    process.env['NODE_ENV'] = 'test';
  });

  it('authenticates via JWT with id in payload', async () => {
    queryResults = [
      [
        {
          id: '42',
          title: 'Test',
          price: 1000,
          area: 50,
          rent_price_per_m2: 10,
          typology: 'T2',
          neighborhood: 'B',
          city: 'Porto',
          is_favorite: true,
          active: true,
          first_seen_at: '2024-01-01',
          last_seen_at: '2024-01-01',
          images: null,
          price_history: null,
        },
      ],
      [], // price_history
      [], // images
    ];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { id: '42' },
        headers: { authorization: `Bearer ${makeJwtToken({ id: 'user1' })}` },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('serves listing unauthenticated when JWT has no id or sub', async () => {
    queryResults = [
      [
        {
          id: '42',
          title: 'Test',
          price: 1000,
          area: 50,
          rent_price_per_m2: 10,
          typology: 'T2',
          neighborhood: 'B',
          city: 'Porto',
          is_favorite: false,
          active: true,
          first_seen_at: '2024-01-01',
          last_seen_at: '2024-01-01',
          images: null,
          price_history: null,
        },
      ],
      [],
      [],
    ];
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: { id: '42' },
        headers: { authorization: `Bearer ${makeJwtToken({ email: 'u@test.com' })}` },
      } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });
});
