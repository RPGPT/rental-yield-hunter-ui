import type { VercelRequest, VercelResponse } from './_types';
import { neon } from '@neondatabase/serverless';
import { sendError } from './_lib/errors.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  const sql = neon(process.env['DATABASE_URL']!);

  try {
    const [cities, typologies, neighborhoods] = await Promise.all([
      sql`SELECT DISTINCT city FROM rental_listings WHERE COALESCE(is_deleted, false) = false AND city IS NOT NULL ORDER BY city`,
      sql`SELECT DISTINCT typology FROM rental_listings WHERE COALESCE(is_deleted, false) = false AND typology IS NOT NULL ORDER BY typology`,
      sql`SELECT DISTINCT city, neighborhood FROM rental_listings WHERE COALESCE(is_deleted, false) = false AND city IS NOT NULL AND neighborhood IS NOT NULL ORDER BY city, neighborhood`,
    ]);

    const neighborhoodsByCity: Record<string, string[]> = {};
    for (const row of neighborhoods as Record<string, string>[]) {
      if (!neighborhoodsByCity[row['city']]) neighborhoodsByCity[row['city']] = [];
      neighborhoodsByCity[row['city']].push(row['neighborhood']);
    }

    return res.status(200).json({
      cities: cities.map((r: Record<string, unknown>) => r['city']),
      typologies: typologies.map((r: Record<string, unknown>) => r['typology']),
      neighborhoods: neighborhoodsByCity,
    });
  } catch (error) {
    return sendError(res, error);
  }
}
