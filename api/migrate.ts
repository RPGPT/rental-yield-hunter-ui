import type { VercelRequest, VercelResponse } from './_types';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/migrate — creates any missing tables needed by the app.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) return res.status(500).json({ error: 'DATABASE_URL is not set' });

  const sql = neon(dbUrl);
  const results: Record<string, string> = {};

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS user_favorites (
        user_id    TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, listing_id)
      )
    `;
    results['user_favorites'] = 'ok';
  } catch (e) {
    results['user_favorites'] = String(e);
  }

  return res.status(200).json({ results });
}
