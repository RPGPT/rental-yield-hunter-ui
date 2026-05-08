import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';
import { getUserFromRequest } from '../_lib/auth';

/**
 * GET    /api/favorites          → list of listing IDs the user has favorited
 * POST   /api/favorites?id=<id>  → add a listing to favorites
 * DELETE /api/favorites?id=<id>  → remove a listing from favorites
 *
 * All methods require a valid Bearer token (Google ID token).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env['DATABASE_URL']!);
  const { id } = req.query as Record<string, string | undefined>;

  // GET — return all favorited listing IDs for this user
  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT listing_id FROM user_favorites WHERE user_id = ${user.id}
      `;
      return res
        .status(200)
        .json(rows.map((r: Record<string, unknown>) => r['listing_id']));
    } catch (error) {
      console.error('[favorites GET]', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST — add favorite
  if (req.method === 'POST') {
    if (!id) return res.status(400).json({ error: 'Missing listing id' });
    try {
      await sql`
        INSERT INTO user_favorites (user_id, listing_id)
        VALUES (${user.id}, ${id})
        ON CONFLICT DO NOTHING
      `;
      return res.status(200).json({ listing_id: id, is_favorite: true });
    } catch (error) {
      console.error('[favorites POST]', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE — remove favorite
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'Missing listing id' });
    try {
      await sql`
        DELETE FROM user_favorites
        WHERE user_id = ${user.id} AND listing_id = ${id}
      `;
      return res.status(200).json({ listing_id: id, is_favorite: false });
    } catch (error) {
      console.error('[favorites DELETE]', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

