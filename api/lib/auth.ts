import type { VercelRequest } from '../_types';

export interface NeonAuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

function extractBearerToken(req: VercelRequest): string | null {
  const auth = req.headers['authorization'] as string | undefined;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.substring(7);
}

async function verifyNeonAuthSession(token: string): Promise<NeonAuthUser | null> {
  const authUrl = process.env['NEON_AUTH_URL'];
  if (!authUrl) {
    console.error('[auth] NEON_AUTH_URL is not set');
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
  try {
    const response = await fetch(`${authUrl}/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      console.error('[auth] session verification failed:', response.status);
      return null;
    }
    const data = (await response.json()) as { user?: NeonAuthUser } | null;
    console.log('[auth] session verified, user:', data?.user?.id ?? 'none');
    return data?.user ?? null;
  } catch (err) {
    clearTimeout(timeout);
    console.error('[auth] session verification error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getUserFromRequest(req: VercelRequest): Promise<NeonAuthUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  if (token === 'dev-token' && process.env['NODE_ENV'] !== 'production') {
    return { id: 'dev-user', email: 'dev@local', name: 'Dev User', image: null };
  }
  return verifyNeonAuthSession(token);
}
