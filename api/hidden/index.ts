import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getFastUserFromRequest } from '../_lib/auth.js';
import { sendError } from '../_lib/errors.js';
import { handleSavedSearches } from '../_lib/saved-searches.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = getFastUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const sql = neon(process.env['DATABASE_URL']!);
  const { id } = req.query as Record<string, string | undefined>;

  if (req.query['resource'] === 'saved-searches') {
    return handleSavedSearches(req, res, sql as never, user.id);
  }

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT listing_id FROM user_hidden WHERE user_id = ${user.id}`;
      return res.status(200).json(rows.map((r: Record<string, unknown>) => r['listing_id']));
    } catch (error) {
      return sendError(res, error);
    }
  }

  if (req.method === 'POST') {
    if (!id) return res.status(400).json({ error: 'Missing listing id' });
    try {
      await sql`INSERT INTO user_hidden (user_id, listing_id) VALUES (${user.id}, ${id}) ON CONFLICT DO NOTHING`;
      return res.status(200).json({ listing_id: id, is_hidden: true });
    } catch (error) {
      return sendError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'Missing listing id' });
    try {
      await sql`DELETE FROM user_hidden WHERE user_id = ${user.id} AND listing_id = ${id}`;
      return res.status(200).json({ listing_id: id, is_hidden: false });
    } catch (error) {
      return sendError(res, error);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
