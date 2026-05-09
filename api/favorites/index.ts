import type { VercelRequest, VercelResponse } from '../_types';
import { neon } from '@neondatabase/serverless';

interface NeonAuthUser {
  id: string;
  email: string;
  name: string | null;
}

async function getUserFromRequest(req: VercelRequest): Promise<NeonAuthUser | null> {
  const auth = req.headers['authorization'] as string | undefined;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.substring(7);
  if (token === 'dev-token' && process.env['NODE_ENV'] !== 'production') {
    return { id: 'dev-user', email: 'dev@local', name: 'Dev User' };
  }
  const authUrl = process.env['NEON_AUTH_URL'];
  if (!authUrl) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const r = await fetch(`${authUrl}/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const data = (await r.json()) as { user?: NeonAuthUser } | null;
    return data?.user ?? null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function sendError(res: VercelResponse, error: unknown, status = 500): VercelResponse {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string }).code;
  return res.status(status).json({ error: { message: msg, ...(code ? { code } : {}) } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const sql = neon(process.env['DATABASE_URL']!);
  const { id } = req.query as Record<string, string | undefined>;

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT listing_id FROM user_favorites WHERE user_id = ${user.id}`;
      return res.status(200).json(rows.map((r: Record<string, unknown>) => r['listing_id']));
    } catch (error) {
      return sendError(res, error);
    }
  }

  if (req.method === 'POST') {
    if (!id) return res.status(400).json({ error: 'Missing listing id' });
    try {
      await sql`INSERT INTO user_favorites (user_id, listing_id) VALUES (${user.id}, ${id}) ON CONFLICT DO NOTHING`;
      return res.status(200).json({ listing_id: id, is_favorite: true });
    } catch (error) {
      return sendError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'Missing listing id' });
    try {
      await sql`DELETE FROM user_favorites WHERE user_id = ${user.id} AND listing_id = ${id}`;
      return res.status(200).json({ listing_id: id, is_favorite: false });
    } catch (error) {
      return sendError(res, error);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
