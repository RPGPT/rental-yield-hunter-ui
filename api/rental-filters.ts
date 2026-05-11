import type { VercelRequest, VercelResponse } from './_types';
import { neon } from '@neondatabase/serverless';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);

  try {
    const [cities, typologies, neighborhoods] = await Promise.all([
      sql`SELECT DISTINCT city FROM rental_listings WHERE city IS NOT NULL ORDER BY city`,
      sql`SELECT DISTINCT typology FROM rental_listings WHERE typology IS NOT NULL ORDER BY typology`,
      sql`SELECT DISTINCT city, neighborhood FROM rental_listings WHERE city IS NOT NULL AND neighborhood IS NOT NULL ORDER BY city, neighborhood`,
    ]);

    const neighborhoodsByCity: Record<string, string[]> = {};
    for (const row of neighborhoods as Record<string, string>[]) {
      if (!neighborhoodsByCity[row['city']]) neighborhoodsByCity[row['city']] = [];
      neighborhoodsByCity[row['city']].push(row['neighborhood']);
    }

    return res
      .status(200)
      .json({
        cities: cities.map((r: Record<string, unknown>) => r['city']),
        typologies: typologies.map((r: Record<string, unknown>) => r['typology']),
        neighborhoods: neighborhoodsByCity,
      });
  } catch (error) {
    console.error('Error fetching rental filters:', error);
    return res
      .status(500)
      .json({
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: (error as { code?: string }).code,
        },
      });
  }
}
