import type { VercelRequest, VercelResponse } from '../_types';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';
import { getUserFromRequest as getAdminUser } from '../_lib/auth.js';

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

async function createListing(
  req: VercelRequest,
  res: VercelResponse,
  sql: NeonQueryFunction<false, false>,
) {
  const user = await getAdminUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { title, url, city, neighborhood, price, sizeM2, isRented, currentRentPrice } = body as {
    title?: string;
    url?: string;
    city?: string;
    neighborhood?: string;
    price?: number;
    sizeM2?: number;
    isRented?: boolean;
    currentRentPrice?: number | null;
  };

  if (!title || !city || !neighborhood || !price || !sizeM2) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = randomUUID();
  const pricePerM2 = sizeM2 > 0 ? price / sizeM2 : null;

  await sql.query(
    `INSERT INTO listings (id, source, url, title, price, initial_price, price_drop_amount, price_drop_pct, price_change_count, area, price_per_m2, city, neighborhood, is_rented, lifetime_rent, active, first_seen, last_seen)
     VALUES ($1, $2, $3, $4, $5, $5, 0, 0, 0, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
    [
      id,
      'manual',
      url ?? '',
      title,
      price,
      sizeM2,
      pricePerM2,
      city,
      neighborhood,
      isRented ?? false,
      false,
      true,
    ],
  );

  if (isRented && currentRentPrice) {
    const curYield = price > 0 ? Number(((currentRentPrice * 12) / price).toFixed(4)) : null;
    await sql.query(
      `INSERT INTO rent_contract_details (listing_id, current_rent, current_yield) VALUES ($1, $2, $3)`,
      [id, currentRentPrice, curYield],
    );
  }

  const result = await sql.query(
    `SELECT l.id, l.source, l.url, l.title, l.description, l.price, l.initial_price,
            l.price_drop_amount, l.price_drop_pct::float AS price_drop_pct, l.price_change_count,
            l.area, l.price_per_m2,
            l.location, l.city, l.neighborhood, l.property_type, l.typology, l.floor,
            l.has_garage, l.is_rented, l.lifetime_rent, false AS is_favorite, false AS is_hidden, l.active,
            l.inactive_since, l.first_seen, l.last_seen,
            re.estimated_rent, re.confidence, re.sample_count, re.match_level, re.rental_yield,
            rcd.current_rent::float AS rent_current_rent, rcd.contract_expiry_date AS rent_contract_expiry,
            rcd.current_yield::float AS rent_current_yield, rcd.reversion_yield::float AS rent_reversion_yield,
            rcd.rent_upside_pct::float AS rent_upside_pct, rcd.months_to_expiry AS rent_months_to_expiry
     FROM listings l
     LEFT JOIN rental_estimates re ON re.listing_id = l.id
     LEFT JOIN rent_contract_details rcd ON rcd.listing_id = l.id
     WHERE l.id = $1`,
    [id],
  );

  return res.status(201).json((result as Record<string, unknown>[])[0]);
}

const PREV_PRICE_SQL = `COALESCE(
  (SELECT COALESCE(lph.previous_price, lph.price)
   FROM listing_price_history lph
   WHERE lph.listing_id = l.id AND COALESCE(lph.previous_price, lph.price) <> l.price
   ORDER BY lph.captured_at DESC, lph.id DESC LIMIT 1),
  CASE WHEN l.initial_price IS NOT NULL AND l.initial_price <> l.price THEN l.initial_price ELSE NULL END
)`;

async function listingsHandler(req: VercelRequest, res: VercelResponse) {
  console.log('[listings] handler start, hasAuth:', !!req.headers['authorization']);
  const sql = neon(process.env['DATABASE_URL']!);

  if (req.method === 'POST') {
    return createListing(req, res, sql);
  }

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
      neighborhood,
      source,
      property_type,
      has_garage,
      is_rented,
      lifetime_rent,
      has_contract_details,
      rental_yield_min,
      is_favorite,
      is_hidden,
      is_new,
      price_change,
      deduplicate,
      active,
      deleted,
      sort = 'price',
      order = 'asc',
      limit = '50',
      offset = '0',
    } = req.query as Record<string, string | undefined>;

    if (deleted === 'true' && !userId) return res.status(401).json({ error: 'Unauthorized' });
    const conditions: string[] = [
      deleted === 'true' ? `l.is_deleted = true` : `COALESCE(l.is_deleted, false) = false`,
    ];
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

    if (typology) {
      const values = typology.split(',').filter(Boolean);
      if (values.length) {
        const placeholders = values.map(() => `$${paramIndex++}`);
        conditions.push(`l.typology IN (${placeholders.join(',')})`);
        params.push(...values);
      }
    }

    if (city) {
      const values = city.split(',').filter(Boolean);
      if (values.length) {
        const placeholders = values.map(() => `$${paramIndex++}`);
        conditions.push(`l.city IN (${placeholders.join(',')})`);
        params.push(...values);
      }
    }

    if (neighborhood) {
      const values = neighborhood.split(',').filter(Boolean);
      if (values.length) {
        const placeholders = values.map(() => `$${paramIndex++}`);
        conditions.push(`l.neighborhood IN (${placeholders.join(',')})`);
        params.push(...values);
      }
    }

    if (source) {
      const values = source.split(',').filter(Boolean);
      if (values.length) {
        const placeholders = values.map(() => `$${paramIndex++}`);
        conditions.push(`l.source IN (${placeholders.join(',')})`);
        params.push(...values);
      }
    }

    if (property_type) {
      const values = property_type.split(',').filter(Boolean);
      if (values.length) {
        const placeholders = values.map(() => `$${paramIndex++}`);
        conditions.push(`l.property_type IN (${placeholders.join(',')})`);
        params.push(...values);
      }
    }

    if (has_garage !== undefined) {
      conditions.push(`l.has_garage = $${paramIndex++}`);
      params.push(has_garage === 'true');
    }
    if (is_rented !== undefined) {
      conditions.push(`l.is_rented = $${paramIndex++}`);
      params.push(is_rented === 'true');
    }
    if (lifetime_rent !== undefined) {
      conditions.push(`l.lifetime_rent = $${paramIndex++}`);
      params.push(lifetime_rent === 'true');
    }
    if (has_contract_details === 'true') {
      conditions.push(`l.is_rented = $${paramIndex++}`);
      params.push(true);
      conditions.push(`l.lifetime_rent = $${paramIndex++}`);
      params.push(false);
      conditions.push(`rcd.current_rent IS NOT NULL`);
    }
    if (rental_yield_min) {
      conditions.push(`re.rental_yield >= $${paramIndex++}`);
      params.push(Number(rental_yield_min));
    }
    if (is_new === 'true') {
      conditions.push(`l.first_seen >= NOW() - INTERVAL '2 days'`);
    }
    if (price_change === 'reduced') {
      conditions.push(`(
        COALESCE(l.price_drop_amount, 0) > 0
        OR EXISTS (
          SELECT 1 FROM listing_price_history lph
          WHERE lph.listing_id = l.id AND COALESCE(lph.previous_price, lph.price) > l.price
        )
      )`);
    } else if (price_change === 'increased') {
      conditions.push(`(
        COALESCE(l.price_drop_amount, 0) < 0
        OR EXISTS (
          SELECT 1 FROM listing_price_history lph
          WHERE lph.listing_id = l.id AND COALESCE(lph.previous_price, lph.price) < l.price
        )
      )`);
    }
    if (deduplicate === 'true') {
      conditions.push(`(
        lc.cluster_id IS NULL
        OR l.id = (
          SELECT lc2.listing_id
          FROM listing_clusters lc2
          JOIN listings l2 ON l2.id = lc2.listing_id
          WHERE lc2.cluster_id = lc.cluster_id
            AND l2.active = l.active
            AND COALESCE(l2.is_deleted, false) = false
          ORDER BY l2.price ASC, l2.id ASC
          LIMIT 1
        )
      )`);
    }
    if (active !== undefined) {
      conditions.push(`l.active = $${paramIndex++}`);
      params.push(active === 'true');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSorts = [
      'price',
      'area',
      'price_per_m2',
      'property_type',
      'typology',
      'city',
      'neighborhood',
      'source',
      'has_garage',
      'is_rented',
      'lifetime_rent',
      'active',
      'first_seen',
      'last_seen',
      'estimated_rent',
      'rental_yield',
      'price_drop_pct',
      'price_spread',
      'rent_upside_pct',
      'reversion_yield',
    ];
    const reColumns = new Set(['estimated_rent', 'rental_yield']);
    const lcColumns = new Set(['price_spread']);
    const rcdColumns = new Set(['rent_upside_pct', 'reversion_yield']);
    const sortCol = allowedSorts.includes(sort as string) ? (sort as string) : 'price';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

    const sortExpr =
      sortCol === 'price_drop_pct'
        ? `COALESCE(l.price_drop_pct::float, (${PREV_PRICE_SQL} - l.price)::float / NULLIF(${PREV_PRICE_SQL}, 0))`
        : sortCol === 'rental_yield'
          ? `COALESCE(CASE WHEN l.is_rented AND NOT l.lifetime_rent AND rcd.current_rent IS NOT NULL THEN (rcd.current_rent * 12) / NULLIF(l.price, 0) ELSE NULL END, re.rental_yield)`
          : reColumns.has(sortCol)
            ? `re.${sortCol}`
            : lcColumns.has(sortCol)
              ? `lc.${sortCol}`
              : rcdColumns.has(sortCol)
                ? `rcd.${sortCol}`
                : `l.${sortCol}`;

    const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    const sharedSelectCols = `
      re.estimated_rent, re.confidence, re.sample_count, re.match_level, re.rental_yield,
      ${PREV_PRICE_SQL} AS previous_price,
      l.initial_price, l.price_drop_amount, l.price_drop_pct::float AS price_drop_pct, l.price_change_count,
      rcd.current_rent::float AS rent_current_rent, rcd.contract_expiry_date AS rent_contract_expiry,
      rcd.current_yield::float AS rent_current_yield, rcd.reversion_yield::float AS rent_reversion_yield,
      rcd.rent_upside_pct::float AS rent_upside_pct, rcd.months_to_expiry AS rent_months_to_expiry,
      lc.cluster_id, lc.cluster_size, lc.cluster_min_price, lc.cluster_max_price,
      lc.price_spread, lc.price_spread_pct::float AS price_spread_pct, lc.is_cheapest, lc.sources AS cluster_sources
    `;

    const sharedJoins = `
      LEFT JOIN rental_estimates re ON re.listing_id = l.id
      LEFT JOIN rent_contract_details rcd ON rcd.listing_id = l.id
      LEFT JOIN listing_clusters lc ON lc.listing_id = l.id
    `;

    if (userId) {
      const allParams: unknown[] = [userId];
      const joinClause = `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $1
        LEFT JOIN user_hidden uh ON uh.listing_id = l.id AND uh.user_id = $1`;
      const isFavoriteSelect = `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`;
      const isHiddenSelect = `CASE WHEN uh.listing_id IS NOT NULL THEN true ELSE false END AS is_hidden`;
      if (is_favorite === 'true') {
        conditions.push(`uf.listing_id IS NOT NULL`);
      }
      if (is_hidden === 'true') {
        conditions.push(`uh.listing_id IS NOT NULL`);
      } else if (is_hidden === 'false') {
        conditions.push(`uh.listing_id IS NULL`);
      }
      const rebuiltWhere =
        conditions.length > 0
          ? `WHERE ${conditions.map((c) => c.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + 1}`)).join(' AND ')}`
          : '';
      allParams.push(...params);
      const dataQuery = `
        SELECT l.id, l.source, l.url, l.title, l.description,
               l.price, l.area, l.price_per_m2,
               l.location, l.city, l.neighborhood, l.property_type, l.typology, l.floor,
               l.has_garage, l.is_rented, l.lifetime_rent, ${isFavoriteSelect}, ${isHiddenSelect}, l.active,
               l.inactive_since, l.first_seen, l.last_seen,
               ${sharedSelectCols}
        FROM listings l
        ${joinClause}
        ${sharedJoins}
        ${rebuiltWhere}
        ORDER BY ${sortExpr} ${sortOrder} NULLS LAST
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      const countQuery = `SELECT count(*)::int AS total FROM listings l ${joinClause} ${sharedJoins} ${rebuiltWhere}`;
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
             l.inactive_since, l.first_seen, l.last_seen,
             ${sharedSelectCols}
      FROM listings l
      ${sharedJoins}
      ${whereClause}
      ORDER BY ${sortExpr} ${sortOrder} NULLS LAST
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const countQuery = `SELECT count(*)::int AS total FROM listings l ${sharedJoins} ${whereClause}`;

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
