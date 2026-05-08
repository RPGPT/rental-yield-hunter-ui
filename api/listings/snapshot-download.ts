import type { VercelRequest, VercelResponse } from '../_types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing ID' });
  }

  try {
    const { list, get } = await import('@vercel/blob');

    // Find the blob — support both new .html and legacy .mhtml
    const { blobs } = await list({ prefix: `snapshots/${id}` });
    const blob = blobs.find((b) => b.size > 0);
    if (!blob) {
      return res.status(404).json({ error: 'Snapshot not found or empty' });
    }

    // get() handles private blob authentication correctly
    const result = await get(blob.url, { access: 'private' });
    if (!result?.stream) {
      return res.status(404).json({ error: 'Blob not found in storage' });
    }

    // Read all chunks from the ReadableStream
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    const buffer = Buffer.from(out);

    const isHtml = blob.pathname.endsWith('.html');
    const filename = `${id}${isHtml ? '.html' : '.mhtml'}`;
    const contentType = isHtml ? 'text/html; charset=utf-8' : 'multipart/related; type="text/html"';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.byteLength);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error('[snapshot-download]', err);
    return res.status(500).json({ error: 'Download failed', detail: String(err) });
  }
}
