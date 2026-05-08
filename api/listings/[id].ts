import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing ID' });
  }

  // Only GET is supported — favorites are managed via /api/favorites
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    const userId = user?.id ?? null;

    // Build the is_favorite expression based on auth state
    const isFavoriteSelect = userId
      ? `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`
      : `false AS is_favorite`;
    const joinClause = userId
      ? `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $2`
      : '';

    const listingParams: unknown[] = [id];
    if (userId) listingParams.push(userId);

    const listingResult = await sql.query(
      `SELECT l.id, l.source, l.url, l.title, l.description, l.price, l.area, l.price_per_m2,
              l.location, l.city, l.property_type, l.typology, l.floor,
              l.has_garage, l.is_rented, l.lifetime_rent,
              l.active, l.inactive_since, l.first_seen, l.last_seen,
              ${isFavoriteSelect}
       FROM listings l
       ${joinClause}
       WHERE l.id = $1`,
      listingParams,
    );

    if (listingResult.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const priceHistory = await sql`
      SELECT price, captured_at
       FROM listing_price_history
       WHERE listing_id = ${id}
       ORDER BY captured_at ASC
    `;

    const rawDataResult = await sql`
      SELECT raw_json->'images' AS images
       FROM raw_data
       WHERE listing_id = ${id}
       LIMIT 1
    `;

    const images: Array<{ large: string; medium: string }> =
      rawDataResult.length > 0 && Array.isArray(rawDataResult[0]['images'])
        ? rawDataResult[0]['images']
        : [];

    res.status(200).json({
      ...listingResult[0],
      price_history: priceHistory,
      images,
    });

    return;
  } catch (error) {
    console.error('Error fetching listing:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
