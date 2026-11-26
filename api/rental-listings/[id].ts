import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getFastUserFromRequest } from '../_lib/auth.js';
import { sendError } from '../_lib/errors.js';
import { buildPriceHistory, extractRawImages, type RawPricePoint } from '../_lib/price-history.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);
  const { id } = req.query;

  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing listing ID' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = getFastUserFromRequest(req);
    const userId = user?.id ?? null;

    const isFavoriteSelect = userId
      ? `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`
      : `false AS is_favorite`;
    const joinClause = userId
      ? `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $2`
      : '';
    const listingParams: unknown[] = userId ? [id, userId] : [id];

    const listingResult = (await sql.query(
      `SELECT l.id, l.source, l.url, l.title, l.description, l.price,
              l.initial_price, l.price_drop_amount, l.price_drop_pct::float AS price_drop_pct, l.price_change_count,
              l.area, l.rent_price_per_m2,
              l.location, l.city, l.neighborhood, l.typology, l.floor,
              ${isFavoriteSelect}, l.active, l.inactive_since, l.first_seen, l.last_seen
       FROM rental_listings l ${joinClause}
       WHERE l.id = $1 AND COALESCE(l.is_deleted, false) = false`,
      listingParams,
    )) as Record<string, unknown>[];

    if (listingResult.length === 0) {
      return res.status(404).json({ error: 'Rental listing not found' });
    }

    const [rawPriceHistory, rawDataResult] = (await Promise.all([
      sql`SELECT price, previous_price, captured_at FROM rental_listing_price_history WHERE listing_id = ${id} ORDER BY captured_at ASC, id ASC`,
      sql`SELECT raw_json->'images' AS images FROM rental_raw_data WHERE listing_id = ${id} LIMIT 1`,
    ])) as [RawPricePoint[], Array<Record<string, unknown>>];

    const row = listingResult[0];
    const priceHistory = buildPriceHistory(row, rawPriceHistory);
    const images = extractRawImages(rawDataResult, false);

    return res.status(200).json({ ...row, price_history: priceHistory, images });
  } catch (error) {
    return sendError(res, error);
  }
}
