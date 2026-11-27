import { randomUUID } from 'crypto';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '../_types';
import { getUserFromRequest as getAdminUser } from './auth.js';

const PREV_PRICE_SQL = `COALESCE(
  (SELECT COALESCE(lph.previous_price, lph.price)
   FROM listing_price_history lph
   WHERE lph.listing_id = l.id AND COALESCE(lph.previous_price, lph.price) <> l.price
   ORDER BY lph.captured_at DESC, lph.id DESC LIMIT 1),
  CASE WHEN l.initial_price IS NOT NULL AND l.initial_price <> l.price THEN l.initial_price ELSE NULL END
)`;

const ALLOWED_SORTS = new Set([
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
]);

const RE_COLUMNS = new Set(['estimated_rent', 'rental_yield']);
const LC_COLUMNS = new Set(['price_spread']);
const RCD_COLUMNS = new Set(['rent_upside_pct', 'reversion_yield']);

export interface ListingsQueryPlan {
  dataQuery: string;
  countQuery: string;
  params: unknown[];
  limitNum: number;
  offsetNum: number;
}

export function buildListingsQueryPlan(
  query: Record<string, string | undefined>,
  userId: string | null,
): ListingsQueryPlan {
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
  } = query;

  const params: unknown[] = userId ? [userId] : [];
  let paramIndex = params.length + 1;

  const conditions: string[] = [
    deleted === 'true' ? `l.is_deleted = true` : `COALESCE(l.is_deleted, false) = false`,
  ];

  const addScalar = (expr: string, value: unknown) => {
    conditions.push(`${expr} $${paramIndex++}`);
    params.push(value);
  };

  const addCsvIn = (column: string, raw?: string) => {
    if (!raw) return;
    const values = raw.split(',').filter(Boolean);
    if (!values.length) return;
    const placeholders = values.map(() => `$${paramIndex++}`);
    conditions.push(`${column} IN (${placeholders.join(',')})`);
    params.push(...values);
  };

  if (price_min) addScalar('l.price >=', Number(price_min));
  if (price_max) addScalar('l.price <=', Number(price_max));
  if (area_min) addScalar('l.area >=', Number(area_min));
  if (area_max) addScalar('l.area <=', Number(area_max));

  addCsvIn('l.typology', typology);
  addCsvIn('l.city', city);
  addCsvIn('l.neighborhood', neighborhood);
  addCsvIn('l.source', source);
  addCsvIn('l.property_type', property_type);

  if (has_garage !== undefined) addScalar('l.has_garage =', has_garage === 'true');
  if (is_rented !== undefined) addScalar('l.is_rented =', is_rented === 'true');
  if (lifetime_rent !== undefined) addScalar('l.lifetime_rent =', lifetime_rent === 'true');

  if (has_contract_details === 'true') {
    addScalar('l.is_rented =', true);
    addScalar('l.lifetime_rent =', false);
    conditions.push(`rcd.current_rent IS NOT NULL`);
  }

  if (rental_yield_min) addScalar('re.rental_yield >=', Number(rental_yield_min));

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

  if (active !== undefined) addScalar('l.active =', active === 'true');

  if (userId) {
    if (is_favorite === 'true') conditions.push(`uf.listing_id IS NOT NULL`);
    if (is_hidden === 'true') conditions.push(`uh.listing_id IS NOT NULL`);
    else if (is_hidden === 'false') conditions.push(`uh.listing_id IS NULL`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortCol = ALLOWED_SORTS.has(sort) ? sort : 'price';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  // Single-evaluation formula `1 - price / prev` avoids running PREV_PRICE_SQL twice per row
  const sortExpr =
    sortCol === 'price_drop_pct'
      ? `COALESCE(NULLIF(l.price_drop_pct::float, 0), 1.0 - (l.price::float / NULLIF(${PREV_PRICE_SQL}, 0)))`
      : sortCol === 'rental_yield'
        ? `COALESCE(CASE WHEN l.is_rented AND NOT l.lifetime_rent AND rcd.current_rent IS NOT NULL THEN (rcd.current_rent * 12) / NULLIF(l.price, 0) ELSE NULL END, re.rental_yield)`
        : sortCol === 'estimated_rent'
          ? `COALESCE(CASE WHEN l.is_rented AND NOT l.lifetime_rent AND rcd.current_rent IS NOT NULL THEN rcd.current_rent ELSE NULL END, re.estimated_rent)`
          : RE_COLUMNS.has(sortCol)
            ? `re.${sortCol}`
            : LC_COLUMNS.has(sortCol)
              ? `lc.${sortCol}`
              : RCD_COLUMNS.has(sortCol)
                ? `rcd.${sortCol}`
                : `l.${sortCol}`;

  const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const offsetNum = Math.max(Number(offset) || 0, 0);

  const userJoins = userId
    ? `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $1
       LEFT JOIN user_hidden uh ON uh.listing_id = l.id AND uh.user_id = $1`
    : '';
  const isFavoriteSelect = userId
    ? `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`
    : `false AS is_favorite`;
  const isHiddenSelect = userId
    ? `CASE WHEN uh.listing_id IS NOT NULL THEN true ELSE false END AS is_hidden`
    : `false AS is_hidden`;

  const dataJoins = `
    ${userJoins}
    LEFT JOIN rental_estimates re ON re.listing_id = l.id
    LEFT JOIN rent_contract_details rcd ON rcd.listing_id = l.id
    LEFT JOIN listing_clusters lc ON lc.listing_id = l.id
  `;

  // Optimization: only join 1:1 enrichment tables in COUNT(*) when referenced in WHERE
  const countJoins = [
    userJoins,
    rental_yield_min ? `LEFT JOIN rental_estimates re ON re.listing_id = l.id` : '',
    has_contract_details === 'true'
      ? `LEFT JOIN rent_contract_details rcd ON rcd.listing_id = l.id`
      : '',
    deduplicate === 'true' ? `LEFT JOIN listing_clusters lc ON lc.listing_id = l.id` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const dataQuery = `
    SELECT l.id, l.source, l.url, l.title, l.description,
           l.price, l.area, l.price_per_m2,
           l.location, l.city, l.neighborhood, l.property_type, l.typology, l.floor,
           l.has_garage, l.is_rented, l.lifetime_rent, ${isFavoriteSelect}, ${isHiddenSelect}, l.active,
           l.inactive_since, l.first_seen, l.last_seen,
           re.estimated_rent, re.confidence, re.sample_count, re.match_level, re.rental_yield,
           ${PREV_PRICE_SQL} AS previous_price,
           l.initial_price, l.price_drop_amount, l.price_drop_pct::float AS price_drop_pct, l.price_change_count,
           rcd.current_rent::float AS rent_current_rent, rcd.contract_expiry_date AS rent_contract_expiry,
           rcd.current_yield::float AS rent_current_yield, rcd.reversion_yield::float AS rent_reversion_yield,
           rcd.rent_upside_pct::float AS rent_upside_pct, rcd.months_to_expiry AS rent_months_to_expiry,
           lc.cluster_id, lc.cluster_size, lc.cluster_min_price, lc.cluster_max_price,
           lc.price_spread, lc.price_spread_pct::float AS price_spread_pct, lc.is_cheapest, lc.sources AS cluster_sources
    FROM listings l
    ${dataJoins}
    ${whereClause}
    ORDER BY ${sortExpr} ${sortOrder} NULLS LAST
    LIMIT ${limitNum} OFFSET ${offsetNum}
  `;

  const countQuery = `SELECT count(*)::int AS total FROM listings l ${countJoins} ${whereClause}`;

  return { dataQuery, countQuery, params, limitNum, offsetNum };
}

export async function createManualListing(
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
