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
}

function buildConditions(filters: Filters, sinceParam: number) {
  const conditions = ['active = true', 'COALESCE(is_deleted, false) = false'];
  const params: unknown[] = [];
  let i = sinceParam;
  const add = (cond: string, value: unknown) => {
    conditions.push(cond.replace('$?', `$${i++}`));
    params.push(value);
  };
  if (filters.price_min) add('price >= $?', Number(filters.price_min));
  if (filters.price_max) add('price <= $?', Number(filters.price_max));
  if (filters.area_min) add('area >= $?', Number(filters.area_min));
  if (filters.area_max) add('area <= $?', Number(filters.area_max));
  for (const key of ['typology', 'city'] as const) {
    const values = filters[key]?.split(',').filter(Boolean);
    if (values?.length) {
      const ph = values.map(() => `$${i++}`);
      conditions.push(`${key} IN (${ph.join(',')})`);
      params.push(...values);
    }
  }
  return { where: conditions.join(' AND '), params };
}

async function withAlerts(sql: Sql & SqlQuery, row: Record<string, unknown>) {
  const filters = (row['filters'] ?? {}) as Filters;
  if (filters.mode === 'rent') return { ...row, new_matches: 0, price_drops: 0 };
  const { where, params } = buildConditions(filters, 2);
  const since = row['last_checked_at'];
  const [fresh, drops] = await Promise.all([
    sql.query(`SELECT COUNT(*)::int AS n FROM listings WHERE ${where} AND first_seen > $1`, [
      since,
      ...params,
    ]),
    sql.query(
      `SELECT COUNT(*)::int AS n FROM listings l WHERE ${where.replace(/\b(price|area|typology|city|active|is_deleted)\b/g, 'l.$1')}
       AND EXISTS (SELECT 1 FROM listing_price_history lph
                   WHERE lph.listing_id = l.id AND lph.price > l.price AND lph.captured_at > $1)`,
      [since, ...params],
    ),
  ]);
  return {
    ...row,
    new_matches: (fresh[0] as { n: number }).n,
    price_drops: (drops[0] as { n: number }).n,
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
