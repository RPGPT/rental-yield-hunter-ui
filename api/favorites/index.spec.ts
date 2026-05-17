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

describe('api/favorites handler', () => {
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

  it('returns 401 when Authorization is not Bearer', async () => {
    const res = new MockRes();
    await handler(
      { method: 'GET', query: {}, headers: { authorization: 'Basic abc' } } as any,
      res as any,
    );
    expect(res._status).toBe(401);
  });

  it('returns 405 for unsupported methods', async () => {
    const res = new MockRes();
    await handler(makeDevReq('PUT') as any, res as any);
    expect(res._status).toBe(405);
    expect((res._body as any).error).toBe('Method not allowed');
  });

  it('returns 405 for PATCH method', async () => {
    const res = new MockRes();
    await handler(makeDevReq('PATCH') as any, res as any);
    expect(res._status).toBe(405);
  });

  describe('GET', () => {
    it('returns 200 with list of favorite listing ids', async () => {
      queryResults = [[{ listing_id: 'a' }, { listing_id: 'b' }]];
      const res = new MockRes();
      await handler(makeDevReq('GET') as any, res as any);
      expect(res._status).toBe(200);
      expect(res._body).toEqual(['a', 'b']);
    });

    it('returns 200 with empty array when no favorites', async () => {
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

    it('returns 200 with is_favorite: true on success', async () => {
      queryResults = [[]];
      const res = new MockRes();
      await handler(makeDevReq('POST', { id: '42' }) as any, res as any);
      expect(res._status).toBe(200);
      expect((res._body as any).listing_id).toBe('42');
      expect((res._body as any).is_favorite).toBe(true);
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

    it('returns 200 with is_favorite: false on success', async () => {
      queryResults = [[]];
      const res = new MockRes();
      await handler(makeDevReq('DELETE', { id: '42' }) as any, res as any);
      expect(res._status).toBe(200);
      expect((res._body as any).listing_id).toBe('42');
      expect((res._body as any).is_favorite).toBe(false);
    });

    it('returns 500 when DB throws', async () => {
      dbThrows = true;
      const res = new MockRes();
      await handler(makeDevReq('DELETE', { id: '42' }) as any, res as any);
      expect(res._status).toBe(500);
    });
  });

  it('authenticates via JWT with id in payload', async () => {
    queryResults = [[{ listing_id: 'x' }]];
    const payload = Buffer.from(JSON.stringify({ id: 'user1', email: 'u@test.com', name: 'U' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const header = Buffer.from(JSON.stringify({ alg: 'none' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const token = `${header}.${payload}.fakesig`;
    const res = new MockRes();
    await handler(
      { method: 'GET', query: {}, headers: { authorization: `Bearer ${token}` } } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('authenticates via JWT with sub in payload', async () => {
    queryResults = [[{ listing_id: 'x' }]];
    const payload = Buffer.from(JSON.stringify({ sub: 'sub-user', email: 'u@test.com' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const header = Buffer.from(JSON.stringify({ alg: 'none' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const token = `${header}.${payload}.fakesig`;
    const res = new MockRes();
    await handler(
      { method: 'GET', query: {}, headers: { authorization: `Bearer ${token}` } } as any,
      res as any,
    );
    expect(res._status).toBe(200);
  });

  it('returns 401 for JWT with expired exp', async () => {
    const payload = Buffer.from(
      JSON.stringify({ id: 'u', exp: Math.floor(Date.now() / 1000) - 3600 }),
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const header = Buffer.from(JSON.stringify({ alg: 'none' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const token = `${header}.${payload}.fakesig`;
    const res = new MockRes();
    await handler(
      { method: 'GET', query: {}, headers: { authorization: `Bearer ${token}` } } as any,
      res as any,
    );
    expect(res._status).toBe(401);
  });

  it('returns 401 for JWT with wrong part count', async () => {
    const res = new MockRes();
    await handler(
      {
        method: 'GET',
        query: {},
        headers: { authorization: 'Bearer only.two' },
      } as any,
      res as any,
    );
    expect(res._status).toBe(401);
  });

  it('returns 401 for JWT with no id or sub', async () => {
    const payload = Buffer.from(JSON.stringify({ email: 'noid@test.com' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const header = Buffer.from(JSON.stringify({ alg: 'none' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const token = `${header}.${payload}.fakesig`;
    const res = new MockRes();
    await handler(
      { method: 'GET', query: {}, headers: { authorization: `Bearer ${token}` } } as any,
      res as any,
    );
    expect(res._status).toBe(401);
  });
});
