import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './snapshot-download';

let dbRow: { blob_url: string } | null = null;
let dbThrows = false;
let fetchStatus = 200;
let fetchBody = '<html>Test</html>';
let fetchThrows = false;

vi.mock('@neondatabase/serverless', () => ({
  neon:
    () =>
    async (..._: unknown[]) => {
      if (dbThrows) throw new Error('db error');
      return dbRow ? [dbRow] : [];
    },
}));

vi.stubGlobal(
  'fetch',
  vi.fn(async () => {
    if (fetchThrows) throw new Error('network error');
    const body = Buffer.from(fetchBody);
    return {
      ok: fetchStatus >= 200 && fetchStatus < 300,
      status: fetchStatus,
      headers: { get: (k: string) => (k === 'content-length' ? String(body.byteLength) : null) },
      arrayBuffer: async () => {
        const ab = new ArrayBuffer(body.byteLength);
        new Uint8Array(ab).set(body);
        return ab;
      },
    };
  }),
);

class MockRes {
  _status = 200;
  _body: unknown = null;
  _headers: Record<string, string | number> = {};
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
  setHeader(key: string, val: string | number) {
    this._headers[key] = val;
  }
}

describe('api/listings/snapshot-download handler', () => {
  beforeEach(() => {
    dbRow = null;
    dbThrows = false;
    fetchStatus = 200;
    fetchBody = '<html>Test</html>';
    fetchThrows = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
    process.env['BLOB_READ_WRITE_TOKEN'] = 'mock-token';
  });

  it('returns 400 when id is missing', async () => {
    const res = new MockRes();
    await handler({ method: 'GET', query: {} } as any, res as any);
    expect(res._status).toBe(400);
    expect((res._body as any)?.error).toBe('Missing listing ID');
  });

  it('returns 404 when no snapshot in DB', async () => {
    dbRow = null;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(404);
    expect((res._body as any)?.error).toBe('Snapshot not found');
  });

  it('returns 502 when blob fetch fails', async () => {
    dbRow = { blob_url: 'https://blob.example.com/snapshots/42.html' };
    fetchStatus = 403;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(502);
  });

  it('serves HTML with correct headers', async () => {
    dbRow = { blob_url: 'https://blob.example.com/snapshots/42.html' };
    fetchBody = '<html>Test</html>';
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(res._headers['Content-Disposition']).toBe('attachment; filename="42.html"');
    expect(res._headers['Content-Length']).toBe(Buffer.from(fetchBody).byteLength);
  });

  it('returns 500 on DB error', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error).toBe('Download failed');
  });

  it('returns 500 on fetch error', async () => {
    dbRow = { blob_url: 'https://blob.example.com/snapshots/42.html' };
    fetchThrows = true;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error).toBe('Download failed');
  });
});
