import type { VercelRequest, VercelResponse } from './_types';
import { neon } from '@neondatabase/serverless';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);

  try {
    const [cities, typologies, propertyTypes] = await Promise.all([
      sql`SELECT DISTINCT city FROM listings WHERE city IS NOT NULL ORDER BY city`,
      sql`SELECT DISTINCT typology FROM listings WHERE typology IS NOT NULL ORDER BY typology`,
      sql`SELECT DISTINCT property_type FROM listings WHERE property_type IS NOT NULL ORDER BY property_type`,
    ]);

    res.status(200).json({
      cities: cities.map((r: Record<string, unknown>) => r['city']),
      typologies: typologies.map((r: Record<string, unknown>) => r['typology']),
      property_types: propertyTypes.map((r: Record<string, unknown>) => r['property_type']),
    });
  } catch (error) {
    console.error('Error fetching filters:', error);
    res
      .status(500)
      .json({
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: (error as { code?: string }).code,
        },
      });
  }
}
