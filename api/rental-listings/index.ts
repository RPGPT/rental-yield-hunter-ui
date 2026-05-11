import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';

interface NeonAuthUser {
  id: string;
  email: string;
  name: string | null;
}

function getUserFromRequest(req: VercelRequest): NeonAuthUser | null {
  const auth = req.headers['authorization'] as string | undefined;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.substring(7);
  if (token === 'dev-token' && process.env['NODE_ENV'] !== 'production') {
    return { id: 'dev-user', email: 'dev@local', name: 'Dev User' };
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { id?: string; sub?: string; email?: string; name?: string; exp?: number };
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    const id = payload.id ?? payload.sub;
    if (!id) return null;
    return { id, email: payload.email ?? '', name: payload.name ?? null };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await rentalListingsHandler(req, res);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string }).code;
    console.error('[rental-listings] Unhandled crash:', msg);
    if (!res.headersSent)
      res.status(500).json({ error: { message: msg, ...(code ? { code } : {}) } });
  }
}

async function rentalListingsHandler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);
  const user = getUserFromRequest(req);
  const userId = user?.id ?? null;

  const {
    price_min,
    price_max,
    area_min,
    area_max,
    rent_price_per_m2_min,
    rent_price_per_m2_max,
    typology,
    city,
    neighborhood,
    is_favorite,
    is_new,
    price_change,
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
  if (rent_price_per_m2_min) {
    conditions.push(`l.rent_price_per_m2 >= $${paramIndex++}`);
    params.push(Number(rent_price_per_m2_min));
  }
  if (rent_price_per_m2_max) {
    conditions.push(`l.rent_price_per_m2 <= $${paramIndex++}`);
    params.push(Number(rent_price_per_m2_max));
  }

  if (typology) {
    const values = typology.split(',');
    conditions.push(`l.typology IN (${values.map(() => `$${paramIndex++}`).join(',')})`);
    params.push(...values);
  }
  if (city) {
    const values = city.split(',');
    conditions.push(`l.city IN (${values.map(() => `$${paramIndex++}`).join(',')})`);
    params.push(...values);
  }
  if (neighborhood) {
    const values = neighborhood.split(',');
    conditions.push(`l.neighborhood IN (${values.map(() => `$${paramIndex++}`).join(',')})`);
    params.push(...values);
  }
  if (is_new === 'true') conditions.push(`l.first_seen >= NOW() - INTERVAL '2 days'`);
  if (price_change === 'reduced') {
    conditions.push(
      `EXISTS (SELECT 1 FROM rental_listing_price_history rph WHERE rph.listing_id = l.id AND rph.price > l.price)`,
    );
  } else if (price_change === 'increased') {
    conditions.push(
      `EXISTS (SELECT 1 FROM rental_listing_price_history rph WHERE rph.listing_id = l.id AND rph.price < l.price)`,
    );
  }
  if (active !== undefined) {
    conditions.push(`l.active = $${paramIndex++}`);
    params.push(active === 'true');
  }

  const allowedSorts = [
    'price',
    'area',
    'rent_price_per_m2',
    'typology',
    'city',
    'active',
    'first_seen',
    'last_seen',
  ];
  const sortCol = allowedSorts.includes(sort as string) ? sort : 'price';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
  const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const offsetNum = Math.max(Number(offset) || 0, 0);

  const allParams: unknown[] = [];
  let joinClause = '';
  let isFavoriteSelect = 'false AS is_favorite';

  if (userId) {
    allParams.push(userId);
    joinClause = `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $1`;
    isFavoriteSelect = `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`;
    if (is_favorite === 'true') conditions.push(`uf.listing_id IS NOT NULL`);
    const rebuiltWhere =
      conditions.length > 0
        ? `WHERE ${conditions.map((c) => c.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`)).join(' AND ')}`
        : '';
    allParams.push(...params);
    const dataQuery = `
      SELECT l.id, l.source, l.url, l.title, l.price, l.area, l.rent_price_per_m2,
             l.location, l.city, l.neighborhood, l.typology, l.floor,
             ${isFavoriteSelect}, l.active, l.inactive_since, l.first_seen, l.last_seen
      FROM rental_listings l ${joinClause} ${rebuiltWhere}
      ORDER BY l.${sortCol} ${sortOrder} NULLS LAST
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;
    const countQuery = `SELECT count(*)::int AS total FROM rental_listings l ${joinClause} ${rebuiltWhere}`;
    const [data, countResult] = await Promise.all([
      sql.query(dataQuery, allParams),
      sql.query(countQuery, allParams),
    ]);
    return res
      .status(200)
      .json({ data, total: countResult[0]['total'], limit: limitNum, offset: offsetNum });
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const dataQuery = `
    SELECT l.id, l.source, l.url, l.title, l.price, l.area, l.rent_price_per_m2,
           l.location, l.city, l.neighborhood, l.typology, l.floor,
           false AS is_favorite, l.active, l.inactive_since, l.first_seen, l.last_seen
    FROM rental_listings l ${whereClause}
    ORDER BY l.${sortCol} ${sortOrder} NULLS LAST
    LIMIT ${limitNum} OFFSET ${offsetNum}
  `;
  const countQuery = `SELECT count(*)::int AS total FROM rental_listings l ${whereClause}`;
  const [data, countResult] = await Promise.all([
    sql.query(dataQuery, params),
    sql.query(countQuery, params),
  ]);
  return res
    .status(200)
    .json({ data, total: countResult[0]['total'], limit: limitNum, offset: offsetNum });
}
