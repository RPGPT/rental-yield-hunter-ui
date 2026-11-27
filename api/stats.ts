import type { VercelRequest, VercelResponse } from './_types';
import { neon } from '@neondatabase/serverless';
import { sendError } from './_lib/errors.js';
import { handleAnalytics } from './_lib/analytics.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);

  try {
    if (req.query?.['view'] === 'analytics') {
      return await handleAnalytics(req, res, sql);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    const result = await sql`
      SELECT
        count(*) FILTER (WHERE active)::int AS total_active,
        count(*) FILTER (WHERE active AND is_rented)::int AS rented,
        count(*) FILTER (WHERE active AND lifetime_rent)::int AS lifetime_rent,
        COALESCE(round(avg(price) FILTER (WHERE active))::int, 0) AS avg_price,
        COALESCE(round(avg(price_per_m2) FILTER (WHERE active))::int, 0) AS avg_price_per_m2,
        (SELECT count(DISTINCT l.id)::int
          FROM listings l
          LEFT JOIN listing_price_history lph ON lph.listing_id = l.id
          WHERE COALESCE(l.is_deleted, false) = false
            AND (
              COALESCE(l.price_drop_amount, 0) > 0
              OR COALESCE(lph.previous_price, lph.price) > l.price
            )
        ) AS price_drops
      FROM listings
      WHERE COALESCE(is_deleted, false) = false
    `;

    return res.status(200).json(result[0]);
  } catch (error) {
    return sendError(res, error);
  }
}
