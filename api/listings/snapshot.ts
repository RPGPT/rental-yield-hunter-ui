import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { existsSync, mkdirSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const SNAPSHOTS_DIR = path.join(process.cwd(), 'snapshots');
const CHROMIUM_URL =
  process.env['CHROMIUM_DOWNLOAD_URL'] ??
  'https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.tar';

async function capturePageMHTML(pageUrl: string): Promise<string> {
  const chromium = (await import('@sparticuz/chromium-min')).default;
  const { chromium: pw } = await import('playwright-core');

  const browser = await pw.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(CHROMIUM_URL),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 45_000 });
    const client = await page.context().newCDPSession(page);
    const { data } = await client.send('Page.captureSnapshot', { format: 'mhtml' }) as { data: string };
    return data;
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
  const blobKey = `snapshots/${id}.mhtml`;

  if (req.method === 'GET') {
    if (useBlob) {
      const { list } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: blobKey });
      if (blobs.length > 0 && blobs[0].size > 0) {
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
        const mhtml = await capturePageMHTML(url);
        if (!mhtml || mhtml.length < 100) {
          return res.status(500).json({ error: 'Snapshot captured empty content' });
        }
        const buffer = Buffer.from(mhtml, 'utf-8');
        console.log(`[snapshot] captured ${buffer.byteLength} bytes for ${id}`);
        const { put } = await import('@vercel/blob');
        const blob = await put(blobKey, buffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'multipart/related; type="text/html"',
        });
        console.log(`[snapshot] stored at ${blob.url} (${buffer.byteLength} bytes)`);
        // Return a proxy URL so the file can be force-downloaded
        const downloadUrl = `/api/listings/snapshot-download?id=${id}`;
        return res.status(200).json({ exists: true, url: downloadUrl });
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
