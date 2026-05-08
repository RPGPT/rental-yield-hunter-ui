import type { VercelRequest, VercelResponse } from '../_types';

/**
 * The Google-specific auth endpoint is no longer used.
 * Authentication is now handled entirely by Neon Auth (Better Auth).
 * Sessions are validated via the Neon Auth /get-session endpoint.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({ error: 'This endpoint has been removed. Use Neon Auth.' });
}

