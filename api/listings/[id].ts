import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env['DATABASE_URL']!);
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing listing ID' });
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
          INSERT INTO rent_contract_details (listing_id, current_rent, contract_expiry_date)
          VALUES (${id}, ${rentPerMonth}, ${contractExpiry})
          ON CONFLICT (listing_id) DO UPDATE SET
            current_rent = EXCLUDED.current_rent,
            contract_expiry_date = EXCLUDED.contract_expiry_date
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

    const listingResult = await sql.query(
      `SELECT l.id, l.source, l.url, l.title, l.description, l.price, l.area, l.price_per_m2,
              l.location, l.city, l.neighborhood, l.typology, l.floor,
              l.is_rented, l.lifetime_rent, ${isFavoriteSelect}, ${isHiddenSelect}, l.active,
              l.inactive_since, l.first_seen, l.last_seen,
              re.estimated_rent, re.avg_rent_per_m2, re.sample_count, re.confidence, re.match_level, re.rental_yield,
              rcd.current_rent::float AS rent_current_rent, rcd.contract_expiry_date AS rent_contract_expiry
       FROM listings l
       ${joinClause}
       LEFT JOIN rental_estimates re ON re.listing_id = l.id
       LEFT JOIN rent_contract_details rcd ON rcd.listing_id = l.id
       WHERE l.id = $1`,
      listingParams,
    );

    if (listingResult.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const priceHistory = await sql`
      SELECT price, captured_at
       FROM listing_price_history
       WHERE listing_id = ${id}
       ORDER BY captured_at ASC
    `;

    const rawDataResult = await sql`
      SELECT raw_json->'images' AS images
       FROM raw_data
       WHERE listing_id = ${id}
       LIMIT 1
    `;

    const images: Array<{ large: string; medium: string }> =
      rawDataResult.length > 0 && Array.isArray(rawDataResult[0]['images'])
        ? rawDataResult[0]['images']
        : [];

    res.status(200).json({
      ...listingResult[0],
      price_history: priceHistory,
      images,
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
