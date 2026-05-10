import { createPublicKey, verify as cryptoVerify } from 'crypto';
import type { VercelRequest } from '../_types';

export interface NeonAuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

interface JwkKey {
  kty: string;
  crv?: string;
  x?: string;
  kid?: string;
  alg?: string;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface JwtPayload {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  image?: string;
  exp?: number;
}

const jwksCache = new Map<string, { key: ReturnType<typeof createPublicKey>; fetchedAt: number }>();
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function fetchJwks(): Promise<void> {
  const authUrl = process.env['NEON_AUTH_URL'];
  if (!authUrl) return;
  const response = await fetch(`${authUrl}/.well-known/jwks.json`);
  if (!response.ok) return;
  const data = (await response.json()) as { keys?: JwkKey[] };
  for (const jwk of data.keys ?? []) {
    if (!jwk.kid) continue;
    try {
      const key = createPublicKey({
        key: jwk as Parameters<typeof createPublicKey>[0],
        format: 'jwk',
      });
      jwksCache.set(jwk.kid, { key, fetchedAt: Date.now() });
    } catch {
      // unsupported key type — skip
    }
  }
}

async function getPublicKey(kid: string): Promise<ReturnType<typeof createPublicKey> | null> {
  const cached = jwksCache.get(kid);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) return cached.key;
  await fetchJwks();
  return jwksCache.get(kid)?.key ?? null;
}

async function verifyJwt(token: string): Promise<NeonAuthUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(b64urlDecode(parts[0]).toString('utf8')) as JwtHeader;
    const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8')) as JwtPayload;

    if (!header.kid) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    const id = payload.id ?? payload.sub;
    if (!id) return null;

    const publicKey = await getPublicKey(header.kid);
    if (!publicKey) return null;

    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`);
    const signature = b64urlDecode(parts[2]);
    if (!cryptoVerify(null, signingInput, publicKey, signature)) return null;

    return {
      id,
      email: payload.email ?? '',
      name: payload.name ?? null,
      image: payload.image ?? null,
    };
  } catch {
    return null;
  }
}

async function verifyNeonAuthSession(token: string): Promise<NeonAuthUser | null> {
  const authUrl = process.env['NEON_AUTH_URL'];
  if (!authUrl) {
    console.error('[auth] NEON_AUTH_URL is not set');
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${authUrl}/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = (await response.json()) as { user?: NeonAuthUser } | null;
    return data?.user ?? null;
  } catch (err) {
    clearTimeout(timeout);
    console.error('[auth] session verification error:', err instanceof Error ? err.message : err);
    return null;
  }
}

function extractBearerToken(req: VercelRequest): string | null {
  const auth = req.headers['authorization'] as string | undefined;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.substring(7);
}

export async function getUserFromRequest(req: VercelRequest): Promise<NeonAuthUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  if (token === 'dev-token' && process.env['NODE_ENV'] !== 'production') {
    return { id: 'dev-user', email: 'dev@local', name: 'Dev User', image: null };
  }
  const verified = await verifyJwt(token);
  if (verified) return verified;
  return verifyNeonAuthSession(token);
}
