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
  try {
    await listingsHandler(req, res);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string }).code;
    console.error('[listings] Unhandled crash:', msg);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: msg, ...(code ? { code } : {}) } });
    }
  }
}

async function listingsHandler(req: VercelRequest, res: VercelResponse) {
  console.log('[listings] handler start, hasAuth:', !!req.headers['authorization']);
  const sql = neon(process.env['DATABASE_URL']!);

  try {
    const user = getUserFromRequest(req);
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
      is_hidden,
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
    if (is_new === 'true') {
      conditions.push(`first_seen >= NOW() - INTERVAL '2 days'`);
    }
    if (price_change === 'reduced') {
      conditions.push(`EXISTS (
        SELECT 1 FROM listing_price_history lph
        WHERE lph.listing_id = l.id AND lph.price > l.price
      )`);
    } else if (price_change === 'increased') {
      conditions.push(`EXISTS (
        SELECT 1 FROM listing_price_history lph
        WHERE lph.listing_id = l.id AND lph.price < l.price
      )`);
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
    let isHiddenSelect = 'false AS is_hidden';
    const allParams: unknown[] = [];

    if (userId) {
      allParams.push(userId); // $1 = userId
      joinClause = `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $1
        LEFT JOIN user_hidden uh ON uh.listing_id = l.id AND uh.user_id = $1`;
      isFavoriteSelect = `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`;
      isHiddenSelect = `CASE WHEN uh.listing_id IS NOT NULL THEN true ELSE false END AS is_hidden`;
      // Filter to only favorites if requested (no extra param — references the JOIN)
      if (is_favorite === 'true') {
        conditions.push(`uf.listing_id IS NOT NULL`);
      }
      // Filter to only hidden if requested (no extra param — references the JOIN)
      if (is_hidden === 'true') {
        conditions.push(`uh.listing_id IS NOT NULL`);
      }
      // Renumber all $N params by +1 (because $1 is now userId)
      const rebuiltWhere =
        conditions.length > 0
          ? `WHERE ${conditions.map((c) => c.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`)).join(' AND ')}`
          : '';
      allParams.push(...params);
      const tableRef = 'listings l';
      const dataQuery = `
        SELECT l.id, l.source, l.url, l.title, l.description,
               l.price, l.area, l.price_per_m2,
               l.location, l.city, l.neighborhood, l.property_type, l.typology, l.floor,
               l.has_garage, l.is_rented, l.lifetime_rent, ${isFavoriteSelect}, ${isHiddenSelect}, l.active,
               l.inactive_since, l.first_seen, l.last_seen
        FROM ${tableRef}
        ${joinClause}
        ${rebuiltWhere}
        ORDER BY l.${sortCol} ${sortOrder} NULLS LAST
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      const countQuery = `SELECT count(*)::int AS total FROM ${tableRef} ${joinClause} ${rebuiltWhere}`;
      const [data, countResult] = await Promise.all([
        sql.query(dataQuery, allParams),
        sql.query(countQuery, allParams),
      ]);
      return res
        .status(200)
        .json({ data, total: countResult[0]['total'], limit: limitNum, offset: offsetNum });
    }

    const dataQuery = `
      SELECT l.id, l.source, l.url, l.title, l.description, l.price, l.area, l.price_per_m2,
             l.location, l.city, l.neighborhood, l.property_type, l.typology, l.floor,
             l.has_garage, l.is_rented, l.lifetime_rent, false AS is_favorite, false AS is_hidden, l.active,
             l.inactive_since, l.first_seen, l.last_seen
      FROM listings l
      ${whereClause}
      ORDER BY l.${sortCol} ${sortOrder} NULLS LAST
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const countQuery = `SELECT count(*)::int AS total FROM listings l ${whereClause}`;

    const [data, countResult] = await Promise.all([
      sql.query(dataQuery, params),
      sql.query(countQuery, params),
    ]);

    return res.status(200).json({
      data,
      total: countResult[0]['total'],
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string }).code;
    console.error('[listings] Error:', msg, code);
    return res.status(500).json({ error: { message: msg, ...(code ? { code } : {}) } });
  }
}
