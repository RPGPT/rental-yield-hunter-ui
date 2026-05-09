import type { VercelRequest, VercelResponse } from './_types';
import { neon } from '@neondatabase/serverless';
import { sendError } from './_lib/errors';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const dbUrl = process.env['DATABASE_URL'];
  console.log('[filters] DATABASE_URL set:', !!dbUrl);
  if (!dbUrl)
    return res.status(500).json({ error: { message: 'DATABASE_URL is not set', status: 500 } });
  const sql = neon(dbUrl);

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
    return sendError(res, error);
  }
}
