import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getFastUserFromRequest } from '../_lib/auth.js';
import { sendError } from '../_lib/errors.js';
import { buildRentalListingsQueryPlan } from '../_lib/rental-listings-query.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const sql = neon(process.env['DATABASE_URL']!);
    const user = getFastUserFromRequest(req);
    const userId = user?.id ?? null;

    const { dataQuery, countQuery, params, limitNum, offsetNum } = buildRentalListingsQueryPlan(
      req.query as Record<string, string | undefined>,
      userId,
    );

    const [data, countResult] = await Promise.all([
      sql.query(dataQuery, params),
      sql.query(countQuery, params),
    ]);

    return res.status(200).json({
      data,
      total: (countResult[0] as Record<string, unknown>)['total'],
      limit: limitNum,
      offset: offsetNum,
    });
  } catch (error) {
    if (res.headersSent) return;
    return sendError(res, error);
  }
}
