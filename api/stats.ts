import type { VercelRequest, VercelResponse } from './_types';
import { neon } from '@neondatabase/serverless';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);

  try {
    const result = await sql`
      SELECT
        count(*) FILTER (WHERE active)::int AS total_active,
        count(*) FILTER (WHERE active AND is_rented)::int AS rented,
        count(*) FILTER (WHERE active AND lifetime_rent)::int AS lifetime_rent,
        COALESCE(round(avg(price) FILTER (WHERE active))::int, 0) AS avg_price,
        COALESCE(round(avg(price_per_m2) FILTER (WHERE active))::int, 0) AS avg_price_per_m2,
        (SELECT count(DISTINCT lph.listing_id)::int
          FROM listing_price_history lph
          JOIN listings l ON l.id = lph.listing_id
          WHERE lph.price > l.price
        ) AS price_drops
      FROM listings
    `;

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: (error as { code?: string }).code,
      },
    });
  }
}
