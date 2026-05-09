import type { VercelRequest, VercelResponse } from './_types';
import { neon } from '@neondatabase/serverless';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);

  try {
    const [cities, typologies, neighborhoodRows] = await Promise.all([
      sql`SELECT DISTINCT city FROM listings WHERE city IS NOT NULL ORDER BY city`,
      sql`SELECT DISTINCT typology FROM listings WHERE typology IS NOT NULL ORDER BY typology`,
      sql`SELECT DISTINCT city, neighborhood FROM listings WHERE city IS NOT NULL AND neighborhood IS NOT NULL ORDER BY city, neighborhood`,
    ]);

    const neighborhoods: Record<string, string[]> = {};
    for (const row of neighborhoodRows as Record<string, string>[]) {
      if (!neighborhoods[row['city']]) neighborhoods[row['city']] = [];
      neighborhoods[row['city']].push(row['neighborhood']);
    }

    res.status(200).json({
      cities: cities.map((r: Record<string, unknown>) => r['city']),
      typologies: typologies.map((r: Record<string, unknown>) => r['typology']),
      neighborhoods,
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
