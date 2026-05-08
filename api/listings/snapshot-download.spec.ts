import { describe, it, expect, beforeEach, vi } from 'vitest';
import handler from './snapshot-download';

let blobs: { size: number; pathname: string; url: string }[] = [];
let stream: ReadableStream<Uint8Array> | null = null;
let throwOnList = false;

vi.mock('@vercel/blob', () => ({
  list: async () => {
    if (throwOnList) throw new Error('network error');
    return { blobs };
  },
  get: async () => (stream ? { stream } : null),
}));

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
    blobs = [];
    stream = null;
    throwOnList = false;
  });

  it('returns 400 when id is missing', async () => {
    const res = new MockRes();
    await handler({ method: 'GET', query: {} } as any, res as any);
    expect(res._status).toBe(400);
    expect((res._body as any)?.error).toBe('Missing listing ID');
  });

  it('returns 404 when no blobs found', async () => {
    blobs = [];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(404);
  });

  it('returns 404 when all blobs have size 0', async () => {
    blobs = [{ size: 0, pathname: 'snapshots/42.html', url: 'blob://x' }];
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(404);
  });

  it('returns 404 when blob stream is null', async () => {
    blobs = [{ size: 100, pathname: 'snapshots/42.html', url: 'blob://x' }];
    stream = null;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(404);
    expect((res._body as any)?.error).toContain('Blob not found');
  });

  it('serves HTML with correct Content-Type header', async () => {
    const data = new Uint8Array(Buffer.from('<html>Test</html>'));
    let done = false;
    blobs = [{ size: data.length, pathname: 'snapshots/42.html', url: 'blob://x' }];
    stream = {
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
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toBe('text/html; charset=utf-8');
  });

  it('sets attachment filename to <id>.html for HTML blobs', async () => {
    const data = new Uint8Array(Buffer.from('<html>Test</html>'));
    let done = false;
    blobs = [{ size: data.length, pathname: 'snapshots/42.html', url: 'blob://x' }];
    stream = {
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
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._headers['Content-Disposition']).toBe('attachment; filename="42.html"');
  });

  it('serves MHTML with multipart content-type header', async () => {
    const data = new Uint8Array(Buffer.from('MHTML here'));
    let done = false;
    blobs = [{ size: data.length, pathname: 'snapshots/42.mhtml', url: 'blob://x' }];
    stream = {
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
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._headers['Content-Type']).toBe('multipart/related; type="text/html"');
    expect(res._headers['Content-Disposition']).toBe('attachment; filename="42.mhtml"');
  });

  it('sets Content-Length to buffer byte length', async () => {
    const content = Buffer.from('<html>Test</html>');
    const data = new Uint8Array(content);
    let done = false;
    blobs = [{ size: content.length, pathname: 'snapshots/42.html', url: 'blob://x' }];
    stream = {
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
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._headers['Content-Length']).toBe(content.length);
  });

  it('returns 500 on unexpected error', async () => {
    throwOnList = true;
    const res = new MockRes();
    await handler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error).toBe('Download failed');
  });
});
