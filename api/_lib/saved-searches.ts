import type { VercelResponse } from '../_types';
import { sendError } from './errors.js';

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
type SqlQuery = { query: (text: string, params?: unknown[]) => Promise<unknown[]> };

interface Filters {
  mode?: 'buy' | 'rent';
  price_min?: string;
  price_max?: string;
  area_min?: string;
  area_max?: string;
  typology?: string;
  city?: string;
  neighborhood?: string;
  source?: string;
  rental_yield_min?: string;
  is_rented?: string;
  lifetime_rent?: string;
  has_contract_details?: string;
}

function buildConditions(filters: Filters, sinceParam: number) {
  const conditions = ['l.active = true', 'COALESCE(l.is_deleted, false) = false'];
  const params: unknown[] = [];
  let i = sinceParam;
  const add = (cond: string, value: unknown) => {
    conditions.push(cond.replace('$?', `$${i++}`));
    params.push(value);
  };
  if (filters.price_min) add('l.price >= $?', Number(filters.price_min));
  if (filters.price_max) add('l.price <= $?', Number(filters.price_max));
  if (filters.area_min) add('l.area >= $?', Number(filters.area_min));
  if (filters.area_max) add('l.area <= $?', Number(filters.area_max));
  for (const key of ['typology', 'city', 'neighborhood', 'source'] as const) {
    const values = filters[key]?.split(',').filter(Boolean);
    if (values?.length) {
      const ph = values.map(() => `$${i++}`);
      conditions.push(`l.${key} IN (${ph.join(',')})`);
      params.push(...values);
    }
  }
  if (filters.rental_yield_min) add('re.rental_yield >= $?', Number(filters.rental_yield_min));
  if (filters.is_rented === 'true' || filters.is_rented === 'false') {
    add('l.is_rented = $?', filters.is_rented === 'true');
  }
  if (filters.lifetime_rent === 'true' || filters.lifetime_rent === 'false') {
    add('l.lifetime_rent = $?', filters.lifetime_rent === 'true');
  }
  if (filters.has_contract_details === 'true') {
    conditions.push(
      'l.is_rented = true',
      'l.lifetime_rent = false',
      'rcd.current_rent IS NOT NULL',
    );
  }
  return { where: conditions.join(' AND '), params };
}

async function withAlerts(sql: Sql & SqlQuery, row: Record<string, unknown>) {
  const filters = (row['filters'] ?? {}) as Filters;
  if (filters.mode === 'rent') return { ...row, new_matches: 0, price_drops: 0 };
  const { where, params } = buildConditions(filters, 2);
  const since = row['last_checked_at'];
  const joins = [
    filters.rental_yield_min ? `LEFT JOIN rental_estimates re ON re.listing_id = l.id` : '',
    filters.has_contract_details === 'true'
      ? `LEFT JOIN rent_contract_details rcd ON rcd.listing_id = l.id`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Single-pass aggregation replaces two separate table scans per saved search
  const counts = await sql.query(
    `SELECT
       COUNT(*) FILTER (WHERE l.first_seen > $1)::int AS new_matches,
       COUNT(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM listing_price_history lph
         WHERE lph.listing_id = l.id
           AND COALESCE(lph.previous_price, lph.price) > l.price
           AND lph.captured_at > $1
       ))::int AS price_drops
     FROM listings l ${joins}
     WHERE ${where}`,
    [since, ...params],
  );
  const agg = (counts[0] ?? { new_matches: 0, price_drops: 0 }) as {
    new_matches: number;
    price_drops: number;
  };
  return {
    ...row,
    new_matches: agg.new_matches,
    price_drops: agg.price_drops,
  };
}

export async function handleSavedSearches(
  req: { method?: string; query: Record<string, unknown>; body?: unknown },
  res: VercelResponse,
  sql: Sql & SqlQuery,
  userId: string,
) {
  const id = req.query['id'] as string | undefined;
  try {
    if (req.method === 'GET') {
      const rows = (await sql`
        SELECT id, name, filters, last_checked_at, created_at
        FROM saved_searches WHERE user_id = ${userId} ORDER BY created_at DESC`) as Record<
        string,
        unknown
      >[];
      return res.status(200).json(await Promise.all(rows.map((r) => withAlerts(sql, r))));
    }
    if (req.method === 'POST') {
      if (id) {
        await sql`UPDATE saved_searches SET last_checked_at = NOW() WHERE id = ${id} AND user_id = ${userId}`;
        return res.status(200).json({ id, checked: true });
      }
      const { name, filters } = (req.body ?? {}) as { name?: string; filters?: unknown };
      if (!name?.trim() || !filters || typeof filters !== 'object') {
        return res.status(400).json({ error: 'Missing name or filters' });
      }
      const rows = await sql`
        INSERT INTO saved_searches (user_id, name, filters)
        VALUES (${userId}, ${name.trim().slice(0, 100)}, ${JSON.stringify(filters)}::jsonb)
        RETURNING id, name, filters, last_checked_at, created_at`;
      return res.status(201).json({ ...(rows[0] as object), new_matches: 0, price_drops: 0 });
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await sql`DELETE FROM saved_searches WHERE id = ${id} AND user_id = ${userId}`;
      return res.status(200).json({ id, deleted: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendError(res, error);
  }
}
