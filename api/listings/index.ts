import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);

  try {
    const user = await getUserFromRequest(req);
    const userId = user?.id ?? null;
    const {
      price_min,
      price_max,
      area_min,
      area_max,
      typology,
      city,
      property_type,
      has_garage,
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

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (price_min) {
      conditions.push(`price >= $${paramIndex++}`);
      params.push(Number(price_min));
    }
    if (price_max) {
      conditions.push(`price <= $${paramIndex++}`);
      params.push(Number(price_max));
    }
    if (area_min) {
      conditions.push(`area >= $${paramIndex++}`);
      params.push(Number(area_min));
    }
    if (area_max) {
      conditions.push(`area <= $${paramIndex++}`);
      params.push(Number(area_max));
    }

    if (typology) {
      const values = (typology as string).split(',');
      const placeholders = values.map(() => `$${paramIndex++}`);
      conditions.push(`typology IN (${placeholders.join(',')})`);
      params.push(...values);
    }

    if (city) {
      const values = (city as string).split(',');
      const placeholders = values.map(() => `$${paramIndex++}`);
      conditions.push(`city IN (${placeholders.join(',')})`);
      params.push(...values);
    }

    if (property_type) {
      const values = (property_type as string).split(',');
      const placeholders = values.map(() => `$${paramIndex++}`);
      conditions.push(`property_type IN (${placeholders.join(',')})`);
      params.push(...values);
    }

    if (has_garage !== undefined) {
      conditions.push(`has_garage = $${paramIndex++}`);
      params.push(has_garage === 'true');
    }
    if (is_rented !== undefined) {
      conditions.push(`is_rented = $${paramIndex++}`);
      params.push(is_rented === 'true');
    }
    if (lifetime_rent !== undefined) {
      conditions.push(`lifetime_rent = $${paramIndex++}`);
      params.push(lifetime_rent === 'true');
    }
    // is_favorite filter handled via user_favorites join — skip if no user
    if (is_new === 'true') {
      conditions.push(`first_seen >= NOW() - INTERVAL '2 days'`);
    }
    if (active !== undefined) {
      conditions.push(`active = $${paramIndex++}`);
      params.push(active === 'true');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column (whitelist to prevent SQL injection)
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
    const sortCol = allowedSorts.includes(sort as string) ? sort : 'price';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

    const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    let joinClause = '';
    let isFavoriteSelect = 'false AS is_favorite';
    const allParams: unknown[] = [];

    if (userId) {
      allParams.push(userId); // $1 = userId
      joinClause = `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $1`;
      isFavoriteSelect = `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`;
      // Renumber existing params starting from $2
      const shifted = whereClause.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`);
      allParams.push(...params);
      const tableRef = 'listings l';
      const dataQuery = `
        SELECT l.id, l.source, l.url, l.title, l.description,
               l.price, l.area, l.price_per_m2,
               l.location, l.city, l.property_type, l.typology, l.floor,
               l.has_garage, l.is_rented, l.lifetime_rent, ${isFavoriteSelect}, l.active,
               l.inactive_since, l.first_seen, l.last_seen
        FROM ${tableRef}
        ${joinClause}
        ${shifted}
        ORDER BY l.${sortCol} ${sortOrder} NULLS LAST
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      const countQuery = `SELECT count(*)::int AS total FROM ${tableRef} ${joinClause} ${shifted}`;
      const [data, countResult] = await Promise.all([
        sql.query(dataQuery, allParams),
        sql.query(countQuery, allParams),
      ]);
      return res
        .status(200)
        .json({ data, total: countResult[0]['total'], limit: limitNum, offset: offsetNum });
    }

    const dataQuery = `
      SELECT id, source, url, title, description, price, area, price_per_m2,
             location, city, property_type, typology, floor,
             has_garage, is_rented, lifetime_rent, false AS is_favorite, active,
             inactive_since, first_seen, last_seen
      FROM listings
      ${whereClause}
      ORDER BY ${sortCol} ${sortOrder} NULLS LAST
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const countQuery = `SELECT count(*)::int AS total FROM listings ${whereClause}`;

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
    res.status(500).json({ error: 'Internal server error' });
  }
}
