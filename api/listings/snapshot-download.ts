import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';

const SNAPSHOTS_DIR = path.join(process.cwd(), 'snapshots');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing ID' });
  }

  try {
    // Support local dev disk snapshots inside SnapshotViewerComponent when not running on Vercel
    if (!process.env['VERCEL'] && /^[a-zA-Z0-9_-]+$/.test(id)) {
      const htmlPath = path.join(SNAPSHOTS_DIR, `${id}.html`);
      const mhtmlPath = path.join(SNAPSHOTS_DIR, `${id}.mhtml`);
      if (existsSync(htmlPath) || existsSync(mhtmlPath)) {
        const target = existsSync(htmlPath) ? htmlPath : mhtmlPath;
        const contentType = existsSync(htmlPath)
          ? 'text/html; charset=utf-8'
          : 'multipart/related; charset=utf-8';
        const buffer = readFileSync(target);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', buffer.byteLength);
        return res.status(200).send(buffer);
      }
    }

    const sql = neon(process.env['DATABASE_URL']!);
    const row = await sql`SELECT blob_url FROM listing_snapshots WHERE listing_id = ${id}`;
    if (row.length === 0) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    const blobUrl = (row[0] as { blob_url: string }).blob_url;

    const token = process.env['BLOB_READ_WRITE_TOKEN'];
    const fetchRes = await fetch(blobUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!fetchRes.ok) {
      return res.status(502).json({ error: `Blob fetch failed: ${fetchRes.status}` });
    }

    const buffer = Buffer.from(await fetchRes.arrayBuffer());

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', buffer.byteLength);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[snapshot-download] error:', err);
    return res.status(500).json({ error: 'Download failed', detail: String(err) });
  }
}
