import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from '../_lib/auth';
import { sendError } from '../_lib/errors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);
  const user = await getUserFromRequest(req);

  try {
    const {
      price_min,
      price_max,
      area_min,
      area_max,
      typology,
      city,
      neighborhood,
      is_rented,
      lifetime_rent,
      is_favorite,
      is_new,
      active,
      sort = 'price',
      order = 'asc',
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string | undefined>;

    const params: unknown[] = [];
    let paramIndex = 1;

    // Optional per-user favorites join
    const userId = user?.id ?? null;
    let joinClause = '';
    let isFavoriteSelect = 'false AS is_favorite';

    if (userId) {
      params.push(userId);
      const p = paramIndex++;
      joinClause = `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $${p}`;
      isFavoriteSelect = `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`;
    }

    const conditions: string[] = [];

    if (price_min) {
      conditions.push(`l.price >= $${paramIndex++}`);
      params.push(Number(price_min));
    }
    if (price_max) {
      conditions.push(`l.price <= $${paramIndex++}`);
      params.push(Number(price_max));
    }
    if (area_min) {
      conditions.push(`l.area >= $${paramIndex++}`);
      params.push(Number(area_min));
    }
    if (area_max) {
      conditions.push(`l.area <= $${paramIndex++}`);
      params.push(Number(area_max));
    }

    if (typology) {
      const values = typology.split(',');
      const placeholders = values.map(() => `$${paramIndex++}`);
      conditions.push(`l.typology IN (${placeholders.join(',')})`);
      params.push(...values);
    }

    if (city) {
      const values = city.split(',');
      const placeholders = values.map(() => `$${paramIndex++}`);
      conditions.push(`l.city IN (${placeholders.join(',')})`);
      params.push(...values);
    }

    if (neighborhood) {
      const values = neighborhood.split(',');
      const placeholders = values.map(() => `$${paramIndex++}`);
      conditions.push(`l.neighborhood IN (${placeholders.join(',')})`);
      params.push(...values);
    }

    if (is_rented !== undefined) {
      conditions.push(`l.is_rented = $${paramIndex++}`);
      params.push(is_rented === 'true');
    }
    if (lifetime_rent !== undefined) {
      conditions.push(`l.lifetime_rent = $${paramIndex++}`);
      params.push(lifetime_rent === 'true');
    }

    // Favorites filter: requires an authenticated user
    if (is_favorite !== undefined) {
      if (!userId) {
        if (is_favorite === 'true') conditions.push('FALSE');
      } else if (is_favorite === 'true') {
        conditions.push(`uf.listing_id IS NOT NULL`);
      }
    }

    if (is_new === 'true') {
      conditions.push(`l.first_seen >= NOW() - INTERVAL '2 days'`);
    }
    if (active !== undefined) {
      conditions.push(`l.active = $${paramIndex++}`);
      params.push(active === 'true');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Whitelist sort columns (is_favorite is derived from the join)
    const allowedSorts = [
      'price',
      'area',
      'price_per_m2',
      'property_type',
      'typology',
      'city',
      'has_garage',
      'is_rented',
      'lifetime_rent',
      'active',
      'first_seen',
      'last_seen',
    ];
    const rawSort = sort as string;
    const sortCol =
      rawSort === 'is_favorite'
        ? userId
          ? '(uf.listing_id IS NOT NULL)'
          : 'false'
        : allowedSorts.includes(rawSort)
          ? `l.${rawSort}`
          : 'l.price';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

    const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    const dataQuery = `
      SELECT l.id, l.source, l.url, l.title, l.description, l.price, l.area, l.price_per_m2,
             l.location, l.city, l.neighborhood, l.typology, l.floor,
             l.is_rented, l.lifetime_rent,
             l.active, l.inactive_since, l.first_seen, l.last_seen,
             ${isFavoriteSelect}
      FROM listings l
      ${joinClause}
      ${whereClause}
      ORDER BY ${sortCol} ${sortOrder} NULLS LAST
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const countQuery = `
      SELECT count(*)::int AS total
      FROM listings l
      ${joinClause}
      ${whereClause}
    `;

    const [data, countResult] = await Promise.all([
      sql.query(dataQuery, params),
      sql.query(countQuery, params),
    ]);

    res.status(200).json({
      data,
      total: countResult[0]['total'],
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    return sendError(res, error);
  }
}
