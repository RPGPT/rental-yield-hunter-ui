import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);
  const { id } = req.query;

  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing listing ID' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getUserFromRequest(req);
    const userId = user?.id ?? null;

    const isFavoriteSelect = userId
      ? `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`
      : `false AS is_favorite`;
    const joinClause = userId
      ? `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $2`
      : '';
    const listingParams: unknown[] = userId ? [id, userId] : [id];

    const listingResult = await sql.query(
      `SELECT l.id, l.source, l.url, l.title, l.description, l.price, l.area, l.rent_price_per_m2,
              l.location, l.city, l.neighborhood, l.typology, l.floor,
              ${isFavoriteSelect}, l.active, l.inactive_since, l.first_seen, l.last_seen
       FROM rental_listings l ${joinClause}
       WHERE l.id = $1`,
      listingParams,
    );

    if (listingResult.length === 0)
      return res.status(404).json({ error: 'Rental listing not found' });

    const [priceHistory, rawDataResult] = await Promise.all([
      sql`SELECT price, captured_at FROM rental_listing_price_history WHERE listing_id = ${id} ORDER BY captured_at ASC`,
      sql`SELECT raw_json->'images' AS images FROM rental_raw_data WHERE listing_id = ${id} LIMIT 1`,
    ]);

    const images: Array<{ large: string; medium: string }> =
      rawDataResult.length > 0 && Array.isArray(rawDataResult[0]['images'])
        ? rawDataResult[0]['images']
        : [];

    return res.status(200).json({ ...listingResult[0], price_history: priceHistory, images });
  } catch (error) {
    console.error('[rental-listings/id] Error:', error);
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: (error as { code?: string }).code,
      },
    });
  }
}
