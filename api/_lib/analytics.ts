import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '../_types';

/**
 * Hard domain sanity bounds calibrated against the real Neon Postgres dataset.
 * Eliminates portal data-entry errors (e.g. price typed into the area field:
 * 350,000 m² -> 1 €/m², or 5 m² -> 65,000 €/m²). Combined with median & IQR
 * aggregations, all analytics metrics are resistant to extreme outliers.
 */
export const BUY_BOUNDS = {
  minArea: 15,
  maxArea: 400,
  minPrice: 30_000,
  maxPrice: 1_500_000,
  minPricePerM2: 500,
  maxPricePerM2: 10_000,
} as const;

export const RENT_BOUNDS = {
  minArea: 15,
  maxArea: 350,
  minPrice: 250,
  maxPrice: 5_000,
  minPricePerM2: 3,
  maxPricePerM2: 50,
} as const;

/**
 * Initial scraper bootstrap/backfill ran May 3–11, 2026 (~10k buy + ~2.1k rent
 * listings ingested at once). Exclude that window from monthly evolution so
 * supply and price-cut trends reflect steady-state market activity.
 */
export const EVOLUTION_START_DATE = '2026-05-12';

const BUY_CLEAN_SQL = `
  COALESCE(l.is_deleted, false) = false
  AND l.area BETWEEN ${BUY_BOUNDS.minArea} AND ${BUY_BOUNDS.maxArea}
  AND l.price BETWEEN ${BUY_BOUNDS.minPrice} AND ${BUY_BOUNDS.maxPrice}
  AND l.price_per_m2 BETWEEN ${BUY_BOUNDS.minPricePerM2} AND ${BUY_BOUNDS.maxPricePerM2}
`;

const RENT_CLEAN_SQL = `
  r.area BETWEEN ${RENT_BOUNDS.minArea} AND ${RENT_BOUNDS.maxArea}
  AND r.price BETWEEN ${RENT_BOUNDS.minPrice} AND ${RENT_BOUNDS.maxPrice}
  AND r.rent_price_per_m2 BETWEEN ${RENT_BOUNDS.minPricePerM2} AND ${RENT_BOUNDS.maxPricePerM2}
`;

const TYPOLOGY_BUCKET_SQL = (alias: string) => `
  CASE
    WHEN ${alias}.typology IN ('T0', 'T1', 'T2', 'T3') THEN ${alias}.typology
    WHEN ${alias}.typology ~ '^T[4-9]' THEN 'T4+'
    ELSE NULL
  END
`;

function buildOptionalFilter(
  alias: string,
  city: string | undefined,
  typology: string | undefined,
): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (city) {
    params.push(city);
    parts.push(`${alias}.city = $${params.length}`);
  }
  if (typology) {
    if (typology === 'T4+') {
      parts.push(`${alias}.typology ~ '^T[4-9]'`);
    } else {
      params.push(typology);
      parts.push(`${alias}.typology = $${params.length}`);
    }
  }

  return {
    sql: parts.length ? `AND ${parts.join(' AND ')}` : '',
    params,
  };
}

export async function handleAnalytics(
  req: VercelRequest,
  res: VercelResponse,
  sql: NeonQueryFunction<false, false>,
) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const rawCity = req.query['city'];
  const rawTypology = req.query['typology'];
  const city = typeof rawCity === 'string' && rawCity.trim() ? rawCity.trim() : undefined;
  const typology =
    typeof rawTypology === 'string' && rawTypology.trim() ? rawTypology.trim() : undefined;

  const buyFilter = buildOptionalFilter('l', city, typology);
  const rentFilter = buildOptionalFilter('r', city, typology);
  const cityOnlyBuyFilter = buildOptionalFilter('l', undefined, typology);
  const cityOnlyRentFilter = buildOptionalFilter('r', undefined, typology);
  const typoOnlyBuyFilter = buildOptionalFilter('l', city, undefined);
  const typoOnlyRentFilter = buildOptionalFilter('r', city, undefined);

  const [
    metaRows,
    citiesList,
    buyKpiRows,
    rentKpiRows,
    buyMonthlyRows,
    rentMonthlyRows,
    priceHistoryMonthlyRows,
    cityBuyRows,
    cityRentRows,
    typoBuyRows,
    typoRentRows,
  ] = await Promise.all([
    sql.query(
      `SELECT
        (SELECT count(*)::int FROM listings l WHERE COALESCE(l.is_deleted, false) = false ${buyFilter.sql}) AS buy_total,
        (SELECT count(*)::int FROM listings l WHERE ${BUY_CLEAN_SQL} ${buyFilter.sql}) AS buy_clean,
        (SELECT count(*)::int FROM rental_listings r WHERE 1=1 ${rentFilter.sql}) AS rent_total,
        (SELECT count(*)::int FROM rental_listings r WHERE ${RENT_CLEAN_SQL} ${rentFilter.sql}) AS rent_clean,
        (SELECT min(l.first_seen)::date::text FROM listings l WHERE l.first_seen >= '${EVOLUTION_START_DATE}' AND ${BUY_CLEAN_SQL} ${buyFilter.sql}) AS date_from,
        (SELECT max(l.last_seen)::date::text FROM listings l WHERE ${BUY_CLEAN_SQL} ${buyFilter.sql}) AS date_to`,
      buyFilter.params,
    ),
    sql`
      SELECT DISTINCT city
      FROM listings
      WHERE active = true AND COALESCE(is_deleted, false) = false AND city IS NOT NULL
      ORDER BY city ASC
    `,
    sql.query(
      `SELECT
        count(*)::int AS active_buy_count,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price))::int AS median_buy_price,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2))::int AS median_buy_pm2,
        round(percentile_cont(0.25) WITHIN GROUP (ORDER BY l.price_per_m2))::int AS p25_buy_pm2,
        round(percentile_cont(0.75) WITHIN GROUP (ORDER BY l.price_per_m2))::int AS p75_buy_pm2,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.area))::int AS median_area,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY re.rental_yield))::numeric, 4)::float AS median_gross_yield,
        count(*) FILTER (WHERE COALESCE(l.price_drop_amount, 0) > 0)::int AS price_drop_count,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_drop_pct) FILTER (WHERE COALESCE(l.price_drop_amount, 0) > 0))::numeric, 4)::float AS median_price_drop_pct,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (NOW() - l.first_seen)) / 86400.0))::int AS median_days_on_market
      FROM listings l
      LEFT JOIN rental_estimates re ON re.listing_id = l.id
      WHERE l.active = true AND ${BUY_CLEAN_SQL} ${buyFilter.sql}`,
      buyFilter.params,
    ),
    sql.query(
      `SELECT
        count(*)::int AS active_rent_count,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.price))::int AS median_rent_price,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY r.rent_price_per_m2))::numeric, 2)::float AS median_rent_pm2
      FROM rental_listings r
      WHERE r.active = true AND ${RENT_CLEAN_SQL} ${rentFilter.sql}`,
      rentFilter.params,
    ),
    sql.query(
      `SELECT
        to_char(date_trunc('month', l.first_seen), 'YYYY-MM') AS month,
        count(*)::int AS buy_new_count,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2))::int AS buy_median_pm2,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price))::int AS buy_median_price
      FROM listings l
      WHERE l.first_seen >= '${EVOLUTION_START_DATE}' AND ${BUY_CLEAN_SQL} ${buyFilter.sql}
      GROUP BY 1
      ORDER BY 1 ASC`,
      buyFilter.params,
    ),
    sql.query(
      `SELECT
        to_char(date_trunc('month', r.first_seen), 'YYYY-MM') AS month,
        count(*)::int AS rent_new_count,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY r.rent_price_per_m2))::numeric, 2)::float AS rent_median_pm2,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.price))::int AS rent_median_price
      FROM rental_listings r
      WHERE r.first_seen >= '${EVOLUTION_START_DATE}' AND ${RENT_CLEAN_SQL} ${rentFilter.sql}
      GROUP BY 1
      ORDER BY 1 ASC`,
      rentFilter.params,
    ),
    sql.query(
      `WITH ordered AS (
        SELECT
          lph.listing_id,
          lph.captured_at,
          lph.price,
          COALESCE(
            lph.previous_price,
            LAG(lph.price) OVER (PARTITION BY lph.listing_id ORDER BY lph.captured_at, lph.id)
          ) AS prev_price
        FROM listing_price_history lph
        JOIN listings l ON l.id = lph.listing_id
        WHERE ${BUY_CLEAN_SQL} ${buyFilter.sql}
      )
      SELECT
        to_char(date_trunc('month', captured_at), 'YYYY-MM') AS month,
        count(*) FILTER (WHERE prev_price IS NOT NULL AND price < prev_price)::int AS price_drops_count,
        count(*) FILTER (WHERE prev_price IS NOT NULL AND price > prev_price)::int AS price_increases_count
      FROM ordered
      WHERE captured_at >= '${EVOLUTION_START_DATE}'
      GROUP BY 1
      ORDER BY 1 ASC`,
      buyFilter.params,
    ),
    sql.query(
      `SELECT
        l.city,
        count(*)::int AS buy_count,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price))::int AS median_buy_price,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2))::int AS median_buy_pm2,
        round(percentile_cont(0.25) WITHIN GROUP (ORDER BY l.price_per_m2))::int AS p25_buy_pm2,
        round(percentile_cont(0.75) WITHIN GROUP (ORDER BY l.price_per_m2))::int AS p75_buy_pm2,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY re.rental_yield))::numeric, 4)::float AS median_yield,
        round((count(*) FILTER (WHERE COALESCE(l.price_drop_amount, 0) > 0)::numeric / NULLIF(count(*), 0)) * 100, 1)::float AS price_drop_share_pct
      FROM listings l
      LEFT JOIN rental_estimates re ON re.listing_id = l.id
      WHERE l.active = true AND l.city IS NOT NULL AND ${BUY_CLEAN_SQL} ${cityOnlyBuyFilter.sql}
      GROUP BY l.city
      ORDER BY buy_count DESC`,
      cityOnlyBuyFilter.params,
    ),
    sql.query(
      `SELECT
        r.city,
        count(*)::int AS rent_count,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.price))::int AS median_rent_price,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY r.rent_price_per_m2))::numeric, 2)::float AS median_rent_pm2
      FROM rental_listings r
      WHERE r.active = true AND r.city IS NOT NULL AND ${RENT_CLEAN_SQL} ${cityOnlyRentFilter.sql}
      GROUP BY r.city`,
      cityOnlyRentFilter.params,
    ),
    sql.query(
      `SELECT
        ${TYPOLOGY_BUCKET_SQL('l')} AS typology,
        count(*)::int AS buy_count,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price))::int AS median_buy_price,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price_per_m2))::int AS median_buy_pm2,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY l.area))::int AS median_area,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY re.rental_yield))::numeric, 4)::float AS median_yield
      FROM listings l
      LEFT JOIN rental_estimates re ON re.listing_id = l.id
      WHERE l.active = true AND ${BUY_CLEAN_SQL} ${typoOnlyBuyFilter.sql}
        AND ${TYPOLOGY_BUCKET_SQL('l')} IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC`,
      typoOnlyBuyFilter.params,
    ),
    sql.query(
      `SELECT
        ${TYPOLOGY_BUCKET_SQL('r')} AS typology,
        count(*)::int AS rent_count,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY r.price))::int AS median_rent_price,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY r.rent_price_per_m2))::numeric, 2)::float AS median_rent_pm2
      FROM rental_listings r
      WHERE r.active = true AND ${RENT_CLEAN_SQL} ${typoOnlyRentFilter.sql}
        AND ${TYPOLOGY_BUCKET_SQL('r')} IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC`,
      typoOnlyRentFilter.params,
    ),
  ]);

  const meta = (metaRows as Record<string, unknown>[])[0] ?? {};
  const buyTotal = Number(meta['buy_total'] ?? 0);
  const buyClean = Number(meta['buy_clean'] ?? 0);
  const rentTotal = Number(meta['rent_total'] ?? 0);
  const rentClean = Number(meta['rent_clean'] ?? 0);

  const buyKpi = (buyKpiRows as Record<string, unknown>[])[0] ?? {};
  const rentKpi = (rentKpiRows as Record<string, unknown>[])[0] ?? {};
  const activeBuyCount = Number(buyKpi['active_buy_count'] ?? 0);
  const priceDropCount = Number(buyKpi['price_drop_count'] ?? 0);

  // Merge monthly series across buy, rent, and price history by YYYY-MM
  const monthMap = new Map<
    string,
    {
      month: string;
      buy_new_count: number;
      buy_median_pm2: number | null;
      buy_median_price: number | null;
      rent_new_count: number;
      rent_median_pm2: number | null;
      rent_median_price: number | null;
      price_drops_count: number;
      price_increases_count: number;
    }
  >();

  const getMonth = (month: string) => {
    let entry = monthMap.get(month);
    if (!entry) {
      entry = {
        month,
        buy_new_count: 0,
        buy_median_pm2: null,
        buy_median_price: null,
        rent_new_count: 0,
        rent_median_pm2: null,
        rent_median_price: null,
        price_drops_count: 0,
        price_increases_count: 0,
      };
      monthMap.set(month, entry);
    }
    return entry;
  };

  for (const row of buyMonthlyRows as Record<string, unknown>[]) {
    const entry = getMonth(String(row['month']));
    entry.buy_new_count = Number(row['buy_new_count'] ?? 0);
    entry.buy_median_pm2 = row['buy_median_pm2'] != null ? Number(row['buy_median_pm2']) : null;
    entry.buy_median_price =
      row['buy_median_price'] != null ? Number(row['buy_median_price']) : null;
  }
  for (const row of rentMonthlyRows as Record<string, unknown>[]) {
    const entry = getMonth(String(row['month']));
    entry.rent_new_count = Number(row['rent_new_count'] ?? 0);
    entry.rent_median_pm2 = row['rent_median_pm2'] != null ? Number(row['rent_median_pm2']) : null;
    entry.rent_median_price =
      row['rent_median_price'] != null ? Number(row['rent_median_price']) : null;
  }
  for (const row of priceHistoryMonthlyRows as Record<string, unknown>[]) {
    const entry = getMonth(String(row['month']));
    entry.price_drops_count = Number(row['price_drops_count'] ?? 0);
    entry.price_increases_count = Number(row['price_increases_count'] ?? 0);
  }

  const evolution = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  const cityRentMap = new Map<string, Record<string, unknown>>();
  for (const row of cityRentRows as Record<string, unknown>[]) {
    cityRentMap.set(String(row['city']), row);
  }
  const byCity = (cityBuyRows as Record<string, unknown>[]).map((row) => {
    const r = cityRentMap.get(String(row['city']));
    return {
      city: String(row['city']),
      buy_count: Number(row['buy_count'] ?? 0),
      median_buy_price: Number(row['median_buy_price'] ?? 0),
      median_buy_pm2: Number(row['median_buy_pm2'] ?? 0),
      p25_buy_pm2: Number(row['p25_buy_pm2'] ?? 0),
      p75_buy_pm2: Number(row['p75_buy_pm2'] ?? 0),
      rent_count: r ? Number(r['rent_count'] ?? 0) : 0,
      median_rent_price: r?.['median_rent_price'] != null ? Number(r['median_rent_price']) : null,
      median_rent_pm2: r?.['median_rent_pm2'] != null ? Number(r['median_rent_pm2']) : null,
      median_yield: row['median_yield'] != null ? Number(row['median_yield']) : null,
      price_drop_share_pct:
        row['price_drop_share_pct'] != null ? Number(row['price_drop_share_pct']) : 0,
    };
  });

  const typoRentMap = new Map<string, Record<string, unknown>>();
  for (const row of typoRentRows as Record<string, unknown>[]) {
    typoRentMap.set(String(row['typology']), row);
  }
  const byTypology = (typoBuyRows as Record<string, unknown>[]).map((row) => {
    const r = typoRentMap.get(String(row['typology']));
    return {
      typology: String(row['typology']),
      buy_count: Number(row['buy_count'] ?? 0),
      median_buy_price: Number(row['median_buy_price'] ?? 0),
      median_buy_pm2: Number(row['median_buy_pm2'] ?? 0),
      median_area: Number(row['median_area'] ?? 0),
      rent_count: r ? Number(r['rent_count'] ?? 0) : 0,
      median_rent_price: r?.['median_rent_price'] != null ? Number(r['median_rent_price']) : null,
      median_rent_pm2: r?.['median_rent_pm2'] != null ? Number(r['median_rent_pm2']) : null,
      median_yield: row['median_yield'] != null ? Number(row['median_yield']) : null,
    };
  });

  return res.status(200).json({
    meta: {
      cities: (citiesList as Record<string, unknown>[]).map((r) => String(r['city'])),
      typologies: ['T0', 'T1', 'T2', 'T3', 'T4+'],
      selected_city: city ?? null,
      selected_typology: typology ?? null,
      date_range: {
        from: (meta['date_from'] as string | null) ?? null,
        to: (meta['date_to'] as string | null) ?? null,
      },
      outliers: {
        buy_excluded: Math.max(0, buyTotal - buyClean),
        buy_total: buyTotal,
        rent_excluded: Math.max(0, rentTotal - rentClean),
        rent_total: rentTotal,
        buy_bounds: BUY_BOUNDS,
        rent_bounds: RENT_BOUNDS,
      },
    },
    kpis: {
      active_buy_count: activeBuyCount,
      active_rent_count: Number(rentKpi['active_rent_count'] ?? 0),
      median_buy_price: buyKpi['median_buy_price'] != null ? Number(buyKpi['median_buy_price']) : 0,
      median_buy_pm2: buyKpi['median_buy_pm2'] != null ? Number(buyKpi['median_buy_pm2']) : 0,
      p25_buy_pm2: buyKpi['p25_buy_pm2'] != null ? Number(buyKpi['p25_buy_pm2']) : 0,
      p75_buy_pm2: buyKpi['p75_buy_pm2'] != null ? Number(buyKpi['p75_buy_pm2']) : 0,
      median_area: buyKpi['median_area'] != null ? Number(buyKpi['median_area']) : 0,
      median_rent_price:
        rentKpi['median_rent_price'] != null ? Number(rentKpi['median_rent_price']) : null,
      median_rent_pm2:
        rentKpi['median_rent_pm2'] != null ? Number(rentKpi['median_rent_pm2']) : null,
      median_gross_yield:
        buyKpi['median_gross_yield'] != null ? Number(buyKpi['median_gross_yield']) : null,
      price_drop_share_pct:
        activeBuyCount > 0 ? Number(((priceDropCount / activeBuyCount) * 100).toFixed(1)) : 0,
      median_price_drop_pct:
        buyKpi['median_price_drop_pct'] != null ? Number(buyKpi['median_price_drop_pct']) : null,
      median_days_on_market:
        buyKpi['median_days_on_market'] != null ? Number(buyKpi['median_days_on_market']) : null,
    },
    evolution,
    by_city: byCity,
    by_typology: byTypology,
  });
}
