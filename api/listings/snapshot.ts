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
    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 45_000 });

    // Make the page self-contained: inline CSS, base64 images, strip scripts.
    // Runs inside the browser context so the listing site sees a real browser
    // (no CloudFront / anti-bot blocking when resources are fetched).
    const html = await page.evaluate(async () => {
      // 1. Inline <link rel="stylesheet"> as <style>
      const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')];
      await Promise.all(links.map(async link => {
        try {
          const r = await fetch(link.href);
          const css = await r.text();
          const style = document.createElement('style');
          style.textContent = css;
          link.replaceWith(style);
        } catch { link.remove(); }
      }));

      // 2. Convert <img src> to data URLs
      const imgs = [...document.querySelectorAll<HTMLImageElement>('img[src]')];
      await Promise.all(imgs.map(async img => {
        if (img.src.startsWith('data:')) return;
        try {
          const r = await fetch(img.src);
          const blob = await r.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          img.src = dataUrl;
        } catch { img.removeAttribute('src'); }
      }));

      // 3. Strip scripts and noscript (no JS needed in static snapshot)
      document.querySelectorAll('script, noscript').forEach(el => el.remove());

      return `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;
    });

    return html;
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
        const html = await capturePageHTML(url);
        if (!html || html.length < 100) {
          return res.status(500).json({ error: 'Snapshot captured empty content' });
        }
        const buffer = Buffer.from(html, 'utf-8');
        console.log(`[snapshot] captured ${buffer.byteLength} bytes for ${id}`);
        const { put } = await import('@vercel/blob');
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
