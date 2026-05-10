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

    const { get } = await import('@vercel/blob');
    const result = await get(blobUrl, { access: 'private' });
    console.log(
      `[snapshot-download] blob get result=${JSON.stringify({ hasStream: !!result?.stream, url: result?.url, size: result?.size })}`,
    );
    if (!result?.stream) {
      return res.status(404).json({ error: 'Blob not found in storage' });
    }

    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    console.log(`[snapshot-download] total bytes read=${total}`);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    const buffer = Buffer.from(out);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${id}.html"`);
    res.setHeader('Content-Length', buffer.byteLength);
    console.log(`[snapshot-download] sending ${buffer.byteLength} bytes`);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[snapshot-download] error:', err);
    return res.status(500).json({ error: 'Download failed', detail: String(err) });
  }
}
