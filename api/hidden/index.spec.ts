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

function makeDevReq(
  method: string,
  query: Record<string, string | undefined> = {},
): Record<string, unknown> {
  return {
    method,
    query,
    headers: { authorization: 'Bearer dev-token' },
  };
}

describe('api/hidden handler', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
    process.env['NODE_ENV'] = 'test';
  });

  it('returns 401 when no Authorization header', async () => {
    const res = new MockRes();
    await handler({ method: 'GET', query: {}, headers: {} } as any, res as any);
    expect(res._status).toBe(401);
    expect((res._body as any).error).toBe('Unauthorized');
  });

  it('returns 405 for unsupported methods', async () => {
    const res = new MockRes();
    await handler(makeDevReq('PUT') as any, res as any);
    expect(res._status).toBe(405);
    expect((res._body as any).error).toBe('Method not allowed');
  });

  describe('GET', () => {
    it('returns 200 with list of hidden listing ids', async () => {
      queryResults = [[{ listing_id: 'a' }, { listing_id: 'b' }]];
      const res = new MockRes();
      await handler(makeDevReq('GET') as any, res as any);
      expect(res._status).toBe(200);
      expect(res._body).toEqual(['a', 'b']);
    });

    it('returns 200 with empty array when no hidden listings', async () => {
      queryResults = [[]];
      const res = new MockRes();
      await handler(makeDevReq('GET') as any, res as any);
      expect(res._status).toBe(200);
      expect(res._body).toEqual([]);
    });

    it('returns 500 when DB throws', async () => {
      dbThrows = true;
      const res = new MockRes();
      await handler(makeDevReq('GET') as any, res as any);
      expect(res._status).toBe(500);
    });
  });

  describe('POST', () => {
    it('returns 400 when id is missing', async () => {
      const res = new MockRes();
      await handler(makeDevReq('POST') as any, res as any);
      expect(res._status).toBe(400);
      expect((res._body as any).error).toBe('Missing listing id');
    });

    it('returns 200 with is_hidden: true on success', async () => {
      queryResults = [[]];
      const res = new MockRes();
      await handler(makeDevReq('POST', { id: '42' }) as any, res as any);
      expect(res._status).toBe(200);
      expect((res._body as any).listing_id).toBe('42');
      expect((res._body as any).is_hidden).toBe(true);
    });

    it('returns 500 when DB throws', async () => {
      dbThrows = true;
      const res = new MockRes();
      await handler(makeDevReq('POST', { id: '42' }) as any, res as any);
      expect(res._status).toBe(500);
    });
  });

  describe('DELETE', () => {
    it('returns 400 when id is missing', async () => {
      const res = new MockRes();
      await handler(makeDevReq('DELETE') as any, res as any);
      expect(res._status).toBe(400);
      expect((res._body as any).error).toBe('Missing listing id');
    });

    it('returns 200 with is_hidden: false on success', async () => {
      queryResults = [[]];
      const res = new MockRes();
      await handler(makeDevReq('DELETE', { id: '42' }) as any, res as any);
      expect(res._status).toBe(200);
      expect((res._body as any).listing_id).toBe('42');
      expect((res._body as any).is_hidden).toBe(false);
    });

    it('returns 500 when DB throws', async () => {
      dbThrows = true;
      const res = new MockRes();
      await handler(makeDevReq('DELETE', { id: '42' }) as any, res as any);
      expect(res._status).toBe(500);
    });
  });
});

// JWT auth path coverage
function makeJwtReq(
  method: string,
  payload: Record<string, unknown>,
  query: Record<string, string> = {},
) {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  const token = `${b64url({ alg: 'none' })}.${b64url(payload)}.fakesig`;
  return { method, query, headers: { authorization: `Bearer ${token}` } };
}

describe('api/hidden JWT auth paths', () => {
  beforeEach(() => {
    queryIndex = 0;
    queryResults = [];
    dbThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
    process.env['NODE_ENV'] = 'test';
  });

  it('authenticates via JWT with id in payload (GET)', async () => {
    queryResults = [[{ listing_id: 'x' }]];
    const res = new MockRes();
    await handler(makeJwtReq('GET', { id: 'user1', email: 'u@test.com' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('authenticates via JWT with sub in payload (GET)', async () => {
    queryResults = [[{ listing_id: 'x' }]];
    const res = new MockRes();
    await handler(makeJwtReq('GET', { sub: 'sub1', email: 'u@test.com' }) as any, res as any);
    expect(res._status).toBe(200);
  });

  it('returns 401 for JWT with no id or sub', async () => {
    const res = new MockRes();
    await handler(makeJwtReq('GET', { email: 'u@test.com' }) as any, res as any);
    expect(res._status).toBe(401);
  });

  it('returns 401 for expired JWT', async () => {
    const res = new MockRes();
    await handler(
      makeJwtReq('GET', { id: 'u', exp: Math.floor(Date.now() / 1000) - 3600 }) as any,
      res as any,
    );
    expect(res._status).toBe(401);
  });

  it('returns 401 for malformed JWT (not 3 parts)', async () => {
    const res = new MockRes();
    await handler(
      { method: 'GET', query: {}, headers: { authorization: 'Bearer onlyone' } } as any,
      res as any,
    );
    expect(res._status).toBe(401);
  });
});
