import { describe, it, expect, beforeEach, vi } from 'vitest';

let dbListingRow: { url: string } | null = null;
let dbThrows = false;

let existingBlobs: { size: number; url: string; pathname: string }[] = [];
let blobPutResult = { url: 'blob://new' };

let pw_isBlocked = false;
let pw_capturedHtml = '<!DOCTYPE html><html><head></head><body>Valid listing page content here!!</body></html>';
let pw_launchThrows = false;
let pw_callRouteCallback = false;

let fsExistsResult = false;
let fsSnapDirExists = true;

let execFileFails = false;

vi.mock('@neondatabase/serverless', () => ({
  neon: () => async (..._: unknown[]) => {
    if (dbThrows) throw new Error('DB error');
    return dbListingRow ? [dbListingRow] : [];
  },
}));

vi.mock('@vercel/blob', () => ({
  list: async () => ({ blobs: existingBlobs }),
  put: async () => blobPutResult,
  del: async () => undefined,
}));

vi.mock('@sparticuz/chromium-min', () => ({
  default: { args: [], executablePath: async () => '/mock/chromium' },
}));

vi.mock('playwright-core', () => ({
  chromium: {
    launch: async () => {
      if (pw_launchThrows) throw new Error('Chromium unavailable');
      return {
        newContext: async () => ({
          addInitScript: async () => undefined,
          newPage: async () => ({
            route: async (_pattern: unknown, cb?: (route: any) => Promise<void>) => {
              if (pw_callRouteCallback && cb) {
                await cb({
                  fetch: async () => ({
                    body: async () => Buffer.from('js code'),
                    headers: () => ({ 'content-type': 'text/javascript' }),
                  }),
                  request: () => ({ url: () => 'https://example.com/script.js' }),
                  fulfill: async () => undefined,
                  abort: async () => undefined,
                });
                await cb({
                  fetch: async () => ({
                    body: async () => Buffer.from('fake-image-bytes'),
                    headers: () => ({ 'content-type': 'image/jpeg' }),
                  }),
                  request: () => ({ url: () => 'https://img.example.com/photo.jpg' }),
                  fulfill: async () => undefined,
                  abort: async () => undefined,
                });
                await cb({
                  fetch: async () => { throw new Error('network error'); },
                  request: () => ({ url: () => 'https://fail.example.com/img.jpg' }),
                  fulfill: async () => undefined,
                  abort: async () => undefined,
                });
              }
            },
            goto: async () => undefined,
            evaluate: async () => {
              return pw_isBlocked ? true : undefined;
            },
            content: async () => pw_capturedHtml,
          }),
        }),
        close: async () => undefined,
      };
    },
  },
}));

vi.mock('fs', () => {
  const existsSync = (p: unknown): boolean => {
    const s = String(p);
    if (s.endsWith('.html') || s.endsWith('.mhtml')) return fsExistsResult;
    return fsSnapDirExists;
  };
  const mkdirSync = (): void => undefined;
  return { default: { existsSync, mkdirSync }, existsSync, mkdirSync };
});

vi.mock('child_process', () => {
  const execFileMock = (...args: unknown[]) => {
    const cb = args[args.length - 1] as (err: Error | null) => void;
    setTimeout(() => cb(execFileFails ? new Error('single-file failed') : null), 0);
  };
  return { default: { execFile: execFileMock }, execFile: execFileMock };
});

import snapshotHandler from './snapshot';

class MockRes {
  _status = 200;
  _body: unknown = null;
  status(code: number) { this._status = code; return this; }
  json(body: unknown) { this._body = body; return this; }
  send(body: unknown) { this._body = body; return this; }
  setHeader() { return this; }
}

describe('api/listings/snapshot handler', () => {
  beforeEach(() => {
    dbListingRow = null;
    dbThrows = false;
    existingBlobs = [];
    blobPutResult = { url: 'blob://new' };
    pw_isBlocked = false;
    pw_capturedHtml = '<!DOCTYPE html><html><head></head><body>Valid listing page content here!!</body></html>';
    pw_launchThrows = false;
    pw_callRouteCallback = false;
    fsExistsResult = false;
    fsSnapDirExists = true;
    execFileFails = false;
    process.env['DATABASE_URL'] = 'postgresql://mock';
    process.env['VERCEL'] = '1';
    process.env['BLOB_READ_WRITE_TOKEN'] = 'mock-token';
  });

  it('returns 400 when id is missing in POST', async () => {
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: {} } as any, res as any);
    expect(res._status).toBe(400);
    expect((res._body as any)?.error).toBe('Missing listing ID');
  });

  it('returns 400 when id is missing in GET', async () => {
    const res = new MockRes();
    await snapshotHandler({ method: 'GET', query: {} } as any, res as any);
    expect(res._status).toBe(400);
  });

  it('returns 405 for unsupported method', async () => {
    const res = new MockRes();
    await snapshotHandler({ method: 'DELETE', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(405);
    expect((res._body as any)?.error).toBe('Method not allowed');
  });

  it('GET returns exists:true when a blob exists', async () => {
    existingBlobs = [{ size: 500, url: 'blob://x', pathname: 'snapshots/42.html' }];
    const res = new MockRes();
    await snapshotHandler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.exists).toBe(true);
    expect((res._body as any)?.url).toContain('snapshot-download');
  });

  it('GET returns exists:false when no blobs', async () => {
    existingBlobs = [];
    const res = new MockRes();
    await snapshotHandler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect((res._body as any)?.exists).toBe(false);
  });

  it('GET returns exists:false when all blobs are empty', async () => {
    existingBlobs = [{ size: 0, url: 'blob://x', pathname: 'snapshots/42.html' }];
    const res = new MockRes();
    await snapshotHandler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect((res._body as any)?.exists).toBe(false);
  });

  it('GET returns exists:false locally when file does not exist', async () => {
    delete process.env['BLOB_READ_WRITE_TOKEN'];
    delete process.env['VERCEL'];
    const res = new MockRes();
    await snapshotHandler({ method: 'GET', query: { id: 'nonexistent-xyz' } } as any, res as any);
    expect((res._body as any)?.exists).toBe(false);
  });

  it('GET returns exists:true when local html file is present', async () => {
    delete process.env['BLOB_READ_WRITE_TOKEN'];
    delete process.env['VERCEL'];
    fsExistsResult = true;
    const res = new MockRes();
    await snapshotHandler({ method: 'GET', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.exists).toBe(true);
    expect((res._body as any)?.url).toContain('/api/snapshots/');
  });

  it('POST returns 404 when listing is not in DB', async () => {
    dbListingRow = null;
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(404);
    expect((res._body as any)?.error).toBe('Listing not found');
  });

  it('POST returns existing snapshot URL without capturing', async () => {
    dbListingRow = { url: 'https://listing.example.com/42' };
    existingBlobs = [{ size: 1000, url: 'blob://existing', pathname: 'snapshots/42.html' }];
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.exists).toBe(true);
    expect((res._body as any)?.url).toContain('snapshot-download');
  });

  it('POST captures and stores a new snapshot', async () => {
    dbListingRow = { url: 'https://listing.example.com/42' };
    existingBlobs = [];
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.exists).toBe(true);
  });

  it('POST inlines image resources intercepted via route callback', async () => {
    dbListingRow = { url: 'https://listing.example.com/42' };
    existingBlobs = [];
    pw_callRouteCallback = true;
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.exists).toBe(true);
  });

  it('POST returns 500 when bot-wall is detected', async () => {
    dbListingRow = { url: 'https://listing.example.com/42' };
    existingBlobs = [];
    pw_isBlocked = true;
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.detail).toContain('Bot-wall');
  });

  it('POST returns 500 when captured HTML is empty', async () => {
    dbListingRow = { url: 'https://listing.example.com/42' };
    existingBlobs = [];
    pw_capturedHtml = '';
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error).toContain('empty');
  });

  it('POST returns 500 when captured HTML is too short', async () => {
    dbListingRow = { url: 'https://listing.example.com/42' };
    existingBlobs = [];
    pw_capturedHtml = '<html></html>';
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
  });

  it('POST returns 500 when Playwright fails to launch', async () => {
    dbListingRow = { url: 'https://listing.example.com/42' };
    existingBlobs = [];
    pw_launchThrows = true;
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error).toBe('Snapshot failed');
  });

  it('POST returns 500 on database error', async () => {
    dbThrows = true;
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(500);
    expect((res._body as any)?.error).toBe('Snapshot failed');
  });

  it('POST returns existing local snapshot when html file is already present', async () => {
    delete process.env['BLOB_READ_WRITE_TOKEN'];
    delete process.env['VERCEL'];
    dbListingRow = { url: 'https://listing.example.com/42' };
    fsExistsResult = true;
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.exists).toBe(true);
    expect((res._body as any)?.url).toContain('/api/snapshots/');
  });

  it('POST runs single-file capture locally when no snapshot exists and dir is present', async () => {
    delete process.env['BLOB_READ_WRITE_TOKEN'];
    delete process.env['VERCEL'];
    dbListingRow = { url: 'https://listing.example.com/42' };
    fsExistsResult = false;
    fsSnapDirExists = true;
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.exists).toBe(true);
    expect((res._body as any)?.url).toContain('/api/snapshots/');
  });

  it('POST creates snapshots directory when it does not exist', async () => {
    delete process.env['BLOB_READ_WRITE_TOKEN'];
    delete process.env['VERCEL'];
    dbListingRow = { url: 'https://listing.example.com/42' };
    fsExistsResult = false;
    fsSnapDirExists = false;
    const res = new MockRes();
    await snapshotHandler({ method: 'POST', query: { id: '42' } } as any, res as any);
    expect(res._status).toBe(200);
    expect((res._body as any)?.exists).toBe(true);
  });
});
