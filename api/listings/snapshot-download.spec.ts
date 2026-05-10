import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './snapshot-download';

let dbRow: { blob_url: string } | null = null;
let dbThrows = false;
let stream: ReadableStream<Uint8Array> | null = null;
let throwOnGet = false;

vi.mock('@neondatabase/serverless', () => ({
  neon:
    () =>
    async (..._: unknown[]) => {
      if (dbThrows) throw new Error('db error');
      return dbRow ? [dbRow] : [];
    },
}));

vi.mock('@vercel/blob', () => ({
  get: async () => {
    if (throwOnGet) throw new Error('network error');
    return stream ? { stream } : null;
  },
}));

function makeStream(data: Uint8Array): ReadableStream<Uint8Array> {
  let done = false;
  return {
    getReader() {
      return {
        read(): Promise<{ done: boolean; value?: Uint8Array }> {
          if (done) return Promise.resolve({ done: true });
          done = true;
          return Promise.resolve({ done: false, value: data });
        },
      } as ReadableStreamDefaultReader<Uint8Array>;
    },
  } as ReadableStream<Uint8Array>;
}

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
    stream = null;
    throwOnGet = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
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

  it('returns 404 when blob stream is null', async () => {
    dbRow = { blob_url: 'https://blob.example.com/snapshots/42.html' };
    stream = null;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(404);
    expect((res._body as any)?.error).toContain('Blob not found');
  });

  it('serves HTML with correct headers', async () => {
    const data = new Uint8Array(Buffer.from('<html>Test</html>'));
    dbRow = { blob_url: 'https://blob.example.com/snapshots/42.html' };
    stream = makeStream(data);
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(res._headers['Content-Disposition']).toBe('attachment; filename="42.html"');
    expect(res._headers['Content-Length']).toBe(data.byteLength);
  });

  it('sets Content-Length to buffer byte length', async () => {
    const content = Buffer.from('<html>Test</html>');
    dbRow = { blob_url: 'https://blob.example.com/snapshots/42.html' };
    stream = makeStream(new Uint8Array(content));
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._headers['Content-Length']).toBe(content.length);
  });

  it('returns 500 on DB error', async () => {
    dbThrows = true;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error).toBe('Download failed');
  });

  it('returns 500 on blob get error', async () => {
    dbRow = { blob_url: 'https://blob.example.com/snapshots/42.html' };
    throwOnGet = true;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error).toBe('Download failed');
  });
});
