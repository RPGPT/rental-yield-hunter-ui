const ALLOWED_RENTAL_SORTS = new Set([
  'price',
  'area',
  'rent_price_per_m2',
  'typology',
  'city',
  'active',
  'first_seen',
  'last_seen',
]);

export interface RentalListingsQueryPlan {
  dataQuery: string;
  countQuery: string;
  params: unknown[];
  limitNum: number;
  offsetNum: number;
}

export function buildRentalListingsQueryPlan(
  query: Record<string, string | undefined>,
  userId: string | null,
): RentalListingsQueryPlan {
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
  } = query;

  const params: unknown[] = userId ? [userId] : [];
  let paramIndex = params.length + 1;

  const conditions: string[] = [`COALESCE(l.is_deleted, false) = false`];

  const addScalar = (expr: string, value: unknown) => {
    conditions.push(`${expr} $${paramIndex++}`);
    params.push(value);
  };

  const addCsvIn = (column: string, raw?: string) => {
    if (!raw) return;
    const values = raw.split(',').filter(Boolean);
    if (!values.length) return;
    conditions.push(`${column} IN (${values.map(() => `$${paramIndex++}`).join(',')})`);
    params.push(...values);
  };

  if (price_min) addScalar('l.price >=', Number(price_min));
  if (price_max) addScalar('l.price <=', Number(price_max));
  if (area_min) addScalar('l.area >=', Number(area_min));
  if (area_max) addScalar('l.area <=', Number(area_max));
  if (rent_price_per_m2_min) addScalar('l.rent_price_per_m2 >=', Number(rent_price_per_m2_min));
  if (rent_price_per_m2_max) addScalar('l.rent_price_per_m2 <=', Number(rent_price_per_m2_max));

  addCsvIn('l.typology', typology);
  addCsvIn('l.city', city);
  addCsvIn('l.neighborhood', neighborhood);

  if (is_new === 'true') conditions.push(`l.first_seen >= NOW() - INTERVAL '2 days'`);
  if (price_change === 'reduced') {
    conditions.push(
      `(COALESCE(l.price_drop_amount, 0) > 0 OR EXISTS (SELECT 1 FROM rental_listing_price_history rph WHERE rph.listing_id = l.id AND COALESCE(rph.previous_price, rph.price) > l.price))`,
    );
  } else if (price_change === 'increased') {
    conditions.push(
      `(COALESCE(l.price_drop_amount, 0) < 0 OR EXISTS (SELECT 1 FROM rental_listing_price_history rph WHERE rph.listing_id = l.id AND COALESCE(rph.previous_price, rph.price) < l.price))`,
    );
  }
  if (active !== undefined) addScalar('l.active =', active === 'true');
  if (userId && is_favorite === 'true') conditions.push(`uf.listing_id IS NOT NULL`);

  const sortCol = ALLOWED_RENTAL_SORTS.has(sort) ? sort : 'price';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
  const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const offsetNum = Math.max(Number(offset) || 0, 0);

  const joinClause = userId
    ? `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $1`
    : '';
  const isFavoriteSelect = userId
    ? `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`
    : `false AS is_favorite`;
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const dataQuery = `
    SELECT l.id, l.source, l.url, l.title, l.price, l.area, l.rent_price_per_m2,
           l.location, l.city, l.neighborhood, l.typology, l.floor,
           ${isFavoriteSelect}, l.active, l.inactive_since, l.first_seen, l.last_seen
    FROM rental_listings l ${joinClause} ${whereClause}
    ORDER BY l.${sortCol} ${sortOrder} NULLS LAST
    LIMIT ${limitNum} OFFSET ${offsetNum}
  `;
  const countQuery = `SELECT count(*)::int AS total FROM rental_listings l ${joinClause} ${whereClause}`;

  return { dataQuery, countQuery, params, limitNum, offsetNum };
}
