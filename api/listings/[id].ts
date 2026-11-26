import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from '../_lib/auth.js';
import { recordAudit } from '../_lib/audit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing ID' });
  }

  if (req.method === 'DELETE') {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const rows = await sql`
        UPDATE listings SET is_deleted = true
        WHERE id = ${id} AND COALESCE(is_deleted, false) = false
        RETURNING id
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Listing not found' });
      await recordAudit(sql, {
        action: 'delete',
        listingId: id,
        userId: user.id,
        userEmail: user.email,
      });
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({
        error: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  if (req.method === 'PATCH') {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const updates: string[] = [];
    const patchParams: unknown[] = [];
    let pIdx = 1;

    if ('is_rented' in body && typeof body['is_rented'] === 'boolean') {
      updates.push(`is_rented = $${pIdx++}`);
      patchParams.push(body['is_rented']);
    }
    if ('lifetime_rent' in body && typeof body['lifetime_rent'] === 'boolean') {
      updates.push(`lifetime_rent = $${pIdx++}`);
      patchParams.push(body['lifetime_rent']);
    }

    if ('is_deleted' in body && body['is_deleted'] === false) {
      updates.push(`is_deleted = $${pIdx++}`);
      patchParams.push(false);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    patchParams.push(id);
    try {
      await sql.query(`UPDATE listings SET ${updates.join(', ')} WHERE id = $${pIdx}`, patchParams);

      const shouldClearContract = body['is_rented'] === false || body['lifetime_rent'] === true;
      const rentPerMonth = body['rent_per_month'];

      if (shouldClearContract) {
        await sql`DELETE FROM rent_contract_details WHERE listing_id = ${id}`;
      } else if (typeof rentPerMonth === 'number') {
        const contractExpiry =
          typeof body['contract_expiry_date'] === 'string' ? body['contract_expiry_date'] : null;
        await sql`
          INSERT INTO rent_contract_details (
            listing_id,
            current_rent,
            contract_expiry_date,
            current_yield,
            reversion_yield,
            rent_upside_pct,
            months_to_expiry
          )
          SELECT
            ${id},
            ${rentPerMonth},
            ${contractExpiry}::date,
            CASE WHEN l.price > 0 THEN ROUND((${rentPerMonth} * 12.0 / l.price)::numeric, 4) ELSE NULL END,
            CASE WHEN re.estimated_rent IS NOT NULL AND l.price > 0 THEN ROUND((re.estimated_rent * 12.0 / l.price)::numeric, 4) ELSE NULL END,
            CASE WHEN ${rentPerMonth} > 0 AND re.estimated_rent IS NOT NULL THEN ROUND(((re.estimated_rent - ${rentPerMonth}) / ${rentPerMonth})::numeric, 4) ELSE NULL END,
            CASE WHEN ${contractExpiry}::date IS NOT NULL THEN (
              (EXTRACT(YEAR FROM ${contractExpiry}::date)::int - EXTRACT(YEAR FROM CURRENT_DATE)::int) * 12
              + (EXTRACT(MONTH FROM ${contractExpiry}::date)::int - EXTRACT(MONTH FROM CURRENT_DATE)::int)
            ) ELSE NULL END
          FROM listings l
          LEFT JOIN rental_estimates re ON re.listing_id = l.id
          WHERE l.id = ${id}
          ON CONFLICT (listing_id) DO UPDATE SET
            current_rent = EXCLUDED.current_rent,
            contract_expiry_date = EXCLUDED.contract_expiry_date,
            current_yield = EXCLUDED.current_yield,
            reversion_yield = EXCLUDED.reversion_yield,
            rent_upside_pct = EXCLUDED.rent_upside_pct,
            months_to_expiry = EXCLUDED.months_to_expiry,
            updated_at = NOW()
        `;
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({
        error: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    const userId = user?.id ?? null;

    const isFavoriteSelect = userId
      ? `CASE WHEN uf.listing_id IS NOT NULL THEN true ELSE false END AS is_favorite`
      : `false AS is_favorite`;
    const isHiddenSelect = userId
      ? `CASE WHEN uh.listing_id IS NOT NULL THEN true ELSE false END AS is_hidden`
      : `false AS is_hidden`;
    const joinClause = userId
      ? `LEFT JOIN user_favorites uf ON uf.listing_id = l.id AND uf.user_id = $2
         LEFT JOIN user_hidden uh ON uh.listing_id = l.id AND uh.user_id = $2`
      : '';
    const listingParams: unknown[] = userId ? [id, userId] : [id];

    const listingResult = (await sql.query(
      `SELECT l.id, l.source, l.url, l.title, l.description, l.price,
              l.initial_price, l.price_drop_amount, l.price_drop_pct::float AS price_drop_pct, l.price_change_count,
              l.area, l.price_per_m2,
              l.location, l.city, l.neighborhood, l.property_type, l.typology, l.floor, l.has_garage,
              l.is_rented, l.lifetime_rent, ${isFavoriteSelect}, ${isHiddenSelect}, l.active,
              l.inactive_since, l.first_seen, l.last_seen,
              re.estimated_rent, re.avg_rent_per_m2::float AS avg_rent_per_m2, re.sample_count, re.confidence, re.match_level, re.rental_yield::float AS rental_yield,
              rcd.current_rent::float AS rent_current_rent, rcd.contract_expiry_date AS rent_contract_expiry,
              rcd.confidence::float AS rent_contract_confidence, rcd.raw_rent_text AS rent_contract_raw_rent,
              rcd.raw_expiry_text AS rent_contract_raw_expiry,
              rcd.current_yield::float AS rent_current_yield, rcd.reversion_yield::float AS rent_reversion_yield,
              rcd.rent_upside_pct::float AS rent_upside_pct, rcd.months_to_expiry AS rent_months_to_expiry,
              lc.cluster_id, lc.cluster_size, lc.cluster_min_price, lc.cluster_max_price,
              lc.price_spread, lc.price_spread_pct::float AS price_spread_pct, lc.is_cheapest, lc.sources AS cluster_sources
       FROM listings l
       ${joinClause}
       LEFT JOIN rental_estimates re ON re.listing_id = l.id
       LEFT JOIN rent_contract_details rcd ON rcd.listing_id = l.id
       LEFT JOIN listing_clusters lc ON lc.listing_id = l.id
       WHERE l.id = $1 AND COALESCE(l.is_deleted, false) = false`,
      listingParams,
    )) as Record<string, unknown>[];

    if (listingResult.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const row = listingResult[0];

    const rawPriceHistory = (await sql`
      SELECT price, previous_price, captured_at
       FROM listing_price_history
       WHERE listing_id = ${id}
       ORDER BY captured_at ASC, id ASC
    `) as Array<{ price: number; previous_price?: number | null; captured_at: string }>;

    // Prepend initial_price at first_seen when history starts with a changed price so 1-cut drops plot cleanly
    const priceHistory: Array<{ price: number; captured_at: string }> = [];
    const initPrice =
      typeof row['initial_price'] === 'number'
        ? row['initial_price']
        : (rawPriceHistory[0]?.previous_price ?? null);
    if (
      rawPriceHistory.length > 0 &&
      initPrice != null &&
      initPrice !== rawPriceHistory[0].price &&
      row['first_seen']
    ) {
      priceHistory.push({ price: initPrice, captured_at: String(row['first_seen']) });
    }
    for (const pt of rawPriceHistory) {
      priceHistory.push({ price: pt.price, captured_at: pt.captured_at });
    }

    const rawDataResult = (await sql`
      SELECT raw_json->'images' AS images,
             raw_json->'mainEntity'->>'image' AS ld_image
       FROM raw_data
       WHERE listing_id = ${id}
       LIMIT 1
    `) as Record<string, unknown>[];

    let images: Array<{ large: string; medium: string }> = [];
    if (rawDataResult.length > 0) {
      if (Array.isArray(rawDataResult[0]['images'])) {
        images = rawDataResult[0]['images'] as Array<{ large: string; medium: string }>;
      } else if (typeof rawDataResult[0]['ld_image'] === 'string' && rawDataResult[0]['ld_image']) {
        const img = rawDataResult[0]['ld_image'];
        images = [{ large: img, medium: img }];
      }
    }

    let clusterSiblings: Array<Record<string, unknown>> = [];
    if (typeof row['cluster_size'] === 'number' && row['cluster_size'] > 1 && row['cluster_id']) {
      clusterSiblings = (await sql.query(
        `SELECT l2.id, l2.source, l2.url, l2.price, l2.title, l2.area, l2.floor
         FROM listing_clusters lc2
         JOIN listings l2 ON l2.id = lc2.listing_id
         WHERE lc2.cluster_id = $1 AND l2.id <> $2
           AND l2.active = true AND COALESCE(l2.is_deleted, false) = false
         ORDER BY l2.price ASC`,
        [row['cluster_id'], id],
      )) as Array<Record<string, unknown>>;
    }

    res.status(200).json({
      ...row,
      price_history: priceHistory,
      images,
      ...(clusterSiblings.length > 0 ? { cluster_siblings: clusterSiblings } : {}),
    });

    return;
  } catch (error) {
    console.error('Error fetching listing:', error);
    return res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: (error as { code?: string }).code,
      },
    });
  }
}
