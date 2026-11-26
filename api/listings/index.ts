import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getFastUserFromRequest } from '../_lib/auth.js';
import { sendError } from '../_lib/errors.js';
import { buildListingsQueryPlan, createManualListing } from '../_lib/listings-query.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const sql = neon(process.env['DATABASE_URL']!);

    if (req.method === 'POST') {
      return await createManualListing(req, res, sql);
    }

    const query = req.query as Record<string, string | undefined>;
    const user = getFastUserFromRequest(req);
    const userId = user?.id ?? null;

    if (query['deleted'] === 'true' && !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { dataQuery, countQuery, params, limitNum, offsetNum } = buildListingsQueryPlan(
      query,
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
