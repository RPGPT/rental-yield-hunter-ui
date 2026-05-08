import type { VercelRequest } from '../_types';

export interface NeonAuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

/** Extract the Bearer token from an Authorization header. */
export function extractBearerToken(req: VercelRequest): string | null {
  const auth = req.headers['authorization'] as string | undefined;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.substring(7);
}

/**
 * Verify a Neon Auth session token by calling the Neon Auth /get-session endpoint.
 * Returns the user on success, or null if the session is invalid.
 */
export async function verifyNeonAuthSession(token: string): Promise<NeonAuthUser | null> {
  const authUrl = process.env['NEON_AUTH_URL'];
  if (!authUrl) {
    console.error('[auth] NEON_AUTH_URL env var is not set');
    return null;
  }

  try {
    const response = await fetch(`${authUrl}/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { user?: NeonAuthUser } | null;
    return data?.user ?? null;
  } catch (err) {
    console.error('[auth] session verification error', err);
    return null;
  }
}

/** Resolve the current user from the request's Bearer token, or null if unauthenticated. */
export async function getUserFromRequest(req: VercelRequest): Promise<NeonAuthUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  // Dev bypass: accept the hard-coded dev token without hitting Neon Auth
  if (token === 'dev-token' && process.env['NODE_ENV'] !== 'production') {
    return { id: 'dev-user', email: 'dev@local', name: 'Dev User', image: null };
  }

  return verifyNeonAuthSession(token);
}
