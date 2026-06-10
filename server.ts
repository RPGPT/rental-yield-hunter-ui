import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const PORT = 3000;

function parseQuery(url: string): Record<string, string | undefined> {
  const parsed = new URL(url, 'http://localhost');
  const query: Record<string, string | undefined> = {};
  parsed.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

function wrapResponse(res: http.ServerResponse) {
  const wrapped = res as http.ServerResponse & {
    status: (code: number) => typeof wrapped;
    json: (body: unknown) => typeof wrapped;
    send: (body: unknown) => typeof wrapped;
  };
  wrapped.status = (code: number) => {
    res.statusCode = code;
    return wrapped;
  };
  wrapped.json = (body: unknown) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
    return wrapped;
  };
  wrapped.send = (body: unknown) => {
    if (Buffer.isBuffer(body)) {
      res.end(body);
    } else {
      res.end(typeof body === 'string' ? body : JSON.stringify(body));
    }
    return wrapped;
  };
  return wrapped;
}

import listingsHandler from './api/listings/index';
import listingByIdHandler from './api/listings/[id]';
import listingDescriptionHandler from './api/listings/description';
import snapshotHandler from './api/listings/snapshot';
import snapshotDownloadHandler from './api/listings/snapshot-download';
import statsHandler from './api/stats';
import filtersHandler from './api/filters';
import rentalFiltersHandler from './api/rental-filters';
import favoritesHandler from './api/favorites/index';
import hiddenHandler from './api/hidden/index';
import rentalListingsHandler from './api/rental-listings/index';
import rentalListingByIdHandler from './api/rental-listings/[id]';

const SNAPSHOTS_DIR = path.join(process.cwd(), 'snapshots');

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = req.url ?? '/';
  const query = parseQuery(url);

  // Parse JSON body for methods that may carry a payload
  let parsedBody: unknown = null;
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
    parsedBody = await new Promise<unknown>((resolve) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        if (!raw) return resolve(null);
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve(null);
        }
      });
    });
  }

  const fakeReq = Object.assign(req, { query, cookies: {}, body: parsedBody }) as any;
  const fakeRes = wrapResponse(res) as any;

  try {
    const pathname = new URL(url, 'http://localhost').pathname;

    if (pathname === '/api/listings' && (req.method === 'GET' || req.method === 'POST')) {
      await listingsHandler(fakeReq, fakeRes);
    } else if (pathname === '/api/listings/description') {
      await listingDescriptionHandler(fakeReq, fakeRes);
    } else if (pathname === '/api/listings/snapshot') {
      await snapshotHandler(fakeReq, fakeRes);
    } else if (pathname === '/api/listings/snapshot-download') {
      await snapshotDownloadHandler(fakeReq, fakeRes);
    } else if (pathname.startsWith('/api/listings/')) {
      const id = pathname.replace('/api/listings/', '');
      fakeReq.query = { ...query, id };
      await listingByIdHandler(fakeReq, fakeRes);
    } else if (pathname === '/api/stats') {
      await statsHandler(fakeReq, fakeRes);
    } else if (pathname === '/api/filters') {
      await filtersHandler(fakeReq, fakeRes);
    } else if (pathname === '/api/rental-filters') {
      await rentalFiltersHandler(fakeReq, fakeRes);
    } else if (pathname === '/api/rental-listings' && req.method === 'GET') {
      await rentalListingsHandler(fakeReq, fakeRes);
    } else if (pathname.startsWith('/api/rental-listings/')) {
      const id = pathname.replace('/api/rental-listings/', '');
      fakeReq.query = { ...query, id };
      await rentalListingByIdHandler(fakeReq, fakeRes);
    } else if (pathname === '/api/favorites') {
      await favoritesHandler(fakeReq, fakeRes);
    } else if (pathname === '/api/hidden') {
      await hiddenHandler(fakeReq, fakeRes);
    } else if (pathname.match(/^\/api\/snapshots\/([^/]+)$/)) {
      const id = pathname.replace('/api/snapshots/', '');
      const htmlPath = path.join(SNAPSHOTS_DIR, `${id}.html`);
      const mhtmlPath = path.join(SNAPSHOTS_DIR, `${id}.mhtml`);
      const [filePath, contentType] = fs.existsSync(htmlPath)
        ? [htmlPath, 'text/html; charset=utf-8']
        : fs.existsSync(mhtmlPath)
          ? [mhtmlPath, 'multipart/related; charset=utf-8']
          : [null, null];
      if (!filePath) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Snapshot not found' }));
      } else {
        res.setHeader('Content-Type', contentType!);
        fs.createReadStream(filePath).pipe(res);
      }
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    console.error('Server error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`✅ API dev server running at http://localhost:${PORT}`);
  console.log(`   DATABASE_URL:   ${process.env['DATABASE_URL'] ? '✓ loaded' : '✗ MISSING'}`);
  console.log(
    `   NEON_AUTH_URL:  ${process.env['NEON_AUTH_URL'] ? '✓ loaded' : '✗ MISSING (session validation will fail)'}`,
  );
});
