import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { existsSync, mkdirSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const SNAPSHOTS_DIR = path.join(process.cwd(), 'snapshots');
const CHROMIUM_VERSION = '148.0.0';
const CHROMIUM_ARCH = process.arch === 'arm64' ? 'arm64' : 'x64';
const CHROMIUM_URL =
  process.env['CHROMIUM_DOWNLOAD_URL'] ??
  `https://github.com/Sparticuz/chromium/releases/download/v${CHROMIUM_VERSION}/chromium-v${CHROMIUM_VERSION}-pack.${CHROMIUM_ARCH}.tar`;

async function capturePageHTML(pageUrl: string): Promise<string> {
  const chromium = (await import('@sparticuz/chromium-min')).default;
  const { chromium: pw } = await import('playwright-core');

  const browser = await pw.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(CHROMIUM_URL),
    headless: true,
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Intercept every response and cache the raw bytes + content-type
    const resourceCache = new Map<string, { body: Buffer; type: string }>();
    await page.route('**/*', async (route) => {
      try {
        const response = await route.fetch();
        const body = await response.body();
        const type = response.headers()['content-type'] ?? 'application/octet-stream';
        resourceCache.set(route.request().url(), { body, type });
        await route.fulfill({ response });
      } catch {
        await route.abort();
      }
    });

    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 45_000 });

    // Strip scripts & noscript before serialising
    await page.evaluate(() => {
      document.querySelectorAll('script, noscript').forEach(el => el.remove());
    });

    let html = await page.content();

    // Replace every resource URL (src, href, url(...)) with a data URI
    // using the bytes captured during the real page load
    for (const [url, { body, type }] of resourceCache) {
      if (!type.startsWith('image/') && !type.startsWith('text/css') && !type.startsWith('font/')) continue;
      const dataUri = `data:${type.split(';')[0]};base64,${body.toString('base64')}`;
      // Escape the URL for use in regex
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escaped, 'g'), dataUri);
    }

    return `<!DOCTYPE html>\n${html}`;
  } finally {
    await browser.close();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing ID' });
  }

  const useBlob = !!process.env['BLOB_READ_WRITE_TOKEN'];
  const isVercel = !!process.env['VERCEL'];
  const blobKey = `snapshots/${id}.html`;

  if (req.method === 'GET') {
    if (useBlob) {
      const { list } = await import('@vercel/blob');
      // check both new .html and old .mhtml keys
      const { blobs } = await list({ prefix: `snapshots/${id}` });
      const found = blobs.find(b => b.size > 0);
      if (found) {
        return res.status(200).json({ exists: true, url: `/api/listings/snapshot-download?id=${id}` });
      }
      return res.status(200).json({ exists: false });
    } else {
      const htmlPath = path.join(SNAPSHOTS_DIR, `${id}.html`);
      const mhtmlPath = path.join(SNAPSHOTS_DIR, `${id}.mhtml`);
      if (existsSync(htmlPath) || existsSync(mhtmlPath)) {
        return res.status(200).json({ exists: true, url: `/api/snapshots/${id}` });
      }
      return res.status(200).json({ exists: false });
    }
  }

  if (req.method === 'POST') {
    const sql = neon(process.env['DATABASE_URL']!);

    try {
      const result = await sql`SELECT url FROM listings WHERE id = ${id}`;
      if (result.length === 0) return res.status(404).json({ error: 'Listing not found' });
      const { url } = result[0] as { url: string };

      if (isVercel || useBlob) {
        // Delete any existing snapshot (old .mhtml or previous .html) before re-capturing
        const { list, del, put } = await import('@vercel/blob');
        const { blobs: existing } = await list({ prefix: `snapshots/${id}` });
        if (existing.length > 0) {
          await del(existing.map(b => b.url));
          console.log(`[snapshot] deleted ${existing.length} existing blob(s) for ${id}`);
        }

        const html = await capturePageHTML(url);
        if (!html || html.length < 100) {
          return res.status(500).json({ error: 'Snapshot captured empty content' });
        }
        const buffer = Buffer.from(html, 'utf-8');
        console.log(`[snapshot] captured ${buffer.byteLength} bytes for ${id}`);
        const blob = await put(blobKey, buffer, {
          access: 'private',
          addRandomSuffix: false,
          contentType: 'text/html; charset=utf-8',
        });
        console.log(`[snapshot] stored at ${blob.url} (${buffer.byteLength} bytes)`);
        return res.status(200).json({ exists: true, url: `/api/listings/snapshot-download?id=${id}` });
      } else {
        if (!existsSync(SNAPSHOTS_DIR)) mkdirSync(SNAPSHOTS_DIR, { recursive: true });
        const snapshotPath = path.join(SNAPSHOTS_DIR, `${id}.html`);
        const singleFileBin = path.join(process.cwd(), 'node_modules', '.bin', 'single-file');
        await execFileAsync(
          singleFileBin,
          [url, snapshotPath, '--browser-wait-until=networkidle0'],
          { timeout: 90_000 }
        );
        console.log(`[snapshot] ${snapshotPath}`);
        return res.status(200).json({ exists: true, url: `/api/snapshots/${id}` });
      }
    } catch (err) {
      console.error('[snapshot]', err);
      return res.status(500).json({ error: 'Snapshot failed', detail: String(err) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
