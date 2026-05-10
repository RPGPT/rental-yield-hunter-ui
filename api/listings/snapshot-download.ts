import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  console.log(`[snapshot-download] request id=${id}`);
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing ID' });
  }

  try {
    const sql = neon(process.env['DATABASE_URL']!);
    const row = await sql`SELECT blob_url FROM listing_snapshots WHERE listing_id = ${id}`;
    console.log(`[snapshot-download] db row count=${row.length}`);
    if (row.length === 0) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    const blobUrl = (row[0] as { blob_url: string }).blob_url;
    console.log(`[snapshot-download] blob_url=${blobUrl}`);

    const token = process.env['BLOB_READ_WRITE_TOKEN'];
    const fetchRes = await fetch(blobUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    console.log(
      `[snapshot-download] fetch status=${fetchRes.status} ok=${fetchRes.ok} content-length=${fetchRes.headers.get('content-length')}`,
    );
    if (!fetchRes.ok) {
      return res.status(502).json({ error: `Blob fetch failed: ${fetchRes.status}` });
    }

    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    console.log(`[snapshot-download] buffer bytes=${buffer.byteLength}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', buffer.byteLength);
    console.log(`[snapshot-download] sending ${buffer.byteLength} bytes`);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[snapshot-download] error:', err);
    return res.status(500).json({ error: 'Download failed', detail: String(err) });
  }
}
