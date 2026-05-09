import type { VercelRequest, VercelResponse } from './_types';
import { neon } from '@neondatabase/serverless';
import { sendError } from './_lib/errors';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const dbUrl = process.env['DATABASE_URL'];
  console.log('[stats] DATABASE_URL set:', !!dbUrl);
  if (!dbUrl)
    return res.status(500).json({ error: { message: 'DATABASE_URL is not set', status: 500 } });
  const sql = neon(dbUrl);

  try {
    const result = await sql`
      SELECT
        count(*) FILTER (WHERE active)::int AS total_active,
        count(*) FILTER (WHERE active AND is_rented)::int AS rented,
        count(*) FILTER (WHERE active AND lifetime_rent)::int AS lifetime_rent,
        COALESCE(round(avg(price) FILTER (WHERE active))::int, 0) AS avg_price,
        COALESCE(round(avg(price_per_m2) FILTER (WHERE active))::int, 0) AS avg_price_per_m2,
        (SELECT count(DISTINCT listing_id)::int FROM listing_price_history) AS price_drops
      FROM listings
    `;

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return sendError(res, error);
  }
}
