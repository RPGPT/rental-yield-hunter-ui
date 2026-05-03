import type { VercelRequest, VercelResponse } from '../_types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing ID' });
  }

  const blobKey = `snapshots/${id}.mhtml`;
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: blobKey });

  if (blobs.length === 0 || blobs[0].size === 0) {
    return res.status(404).json({ error: 'Snapshot not found or empty' });
  }

  try {
    const response = await fetch(blobs[0].url, {
      headers: {
        Authorization: `Bearer ${process.env['BLOB_READ_WRITE_TOKEN']}`,
      },
    });
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch snapshot from storage' });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', 'multipart/related; type="text/html"');
    res.setHeader('Content-Disposition', `attachment; filename="${id}.mhtml"`);
    res.setHeader('Content-Length', buffer.byteLength);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[snapshot-download]', err);
    return res.status(500).json({ error: 'Download failed', detail: String(err) });
  }
}

