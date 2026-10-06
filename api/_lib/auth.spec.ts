import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getUserFromRequest } from './auth';

// Mock crypto so we can control createPublicKey and verify
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    createPublicKey: vi.fn(() => ({ type: 'public', asymmetricKeyType: 'ec' })),
    verify: vi.fn(() => true),
  };
});

// Mock neon for getRoleFromDb
let dbRows: unknown[] = [];
let dbThrows = false;

vi.mock('@neondatabase/serverless', () => ({
  neon: () => {
    return async (..._: unknown[]) => {
      if (dbThrows) throw new Error('DB error');
      return dbRows.splice(0, 1)[0] ?? [];
    };
  },
}));

/** Create a base64url-encoded string from an object. */
function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Build a fake 3-part JWT: header.payload.signature */
function makeJwt(header: object, payload: object, sig = 'fakesig'): string {
  const s = Buffer.from(sig)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${b64url(header)}.${b64url(payload)}.${s}`;
}

describe('api/lib/auth - getUserFromRequest', () => {
  let origNodeEnv: string | undefined;
  let origNeonAuthUrl: string | undefined;
  let origDbUrl: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    dbRows = [];
    dbThrows = false;
    origNodeEnv = process.env['NODE_ENV'];
    origNeonAuthUrl = process.env['NEON_AUTH_URL'];
    origDbUrl = process.env['DATABASE_URL'];
    process.env['DATABASE_URL'] = 'postgresql://mock';
    delete process.env['NEON_AUTH_URL'];
  });

  afterEach(() => {
    process.env['NODE_ENV'] = origNodeEnv;
    if (origNeonAuthUrl !== undefined) {
      process.env['NEON_AUTH_URL'] = origNeonAuthUrl;
    } else {
      delete process.env['NEON_AUTH_URL'];
    }
    if (origDbUrl !== undefined) {
      process.env['DATABASE_URL'] = origDbUrl;
    } else {
      delete process.env['DATABASE_URL'];
    }
  });

  // ─── extractBearerToken ───────────────────────────────────────────────────

  it('returns null when no Authorization header is present', async () => {
    const result = await getUserFromRequest({ headers: {} } as any);
    expect(result).toBeNull();
  });

  it('returns null when Authorization does not start with "Bearer "', async () => {
    const result = await getUserFromRequest({
      headers: { authorization: 'Basic abc123' },
    } as any);
    expect(result).toBeNull();
  });

  // ─── dev-token ────────────────────────────────────────────────────────────

  it('returns dev user for dev-token in non-production environment', async () => {
    process.env['NODE_ENV'] = 'development';
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer dev-token' },
    } as any);
    expect(result).toEqual({
      id: 'dev-user',
      email: 'dev@local',
      name: 'Dev User',
      image: null,
      role: 'admin',
    });
  });

  it('does NOT return dev user for dev-token in production', async () => {
    process.env['NODE_ENV'] = 'production';
    // dev-token has only 1 part, so verifyJwt returns null; no NEON_AUTH_URL → overall null
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer dev-token' },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyJwt: wrong part count ─────────────────────────────────────────

  it('returns null for a 2-part token (wrong JWT format)', async () => {
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer only.two' },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyJwt: bad base64 / parse error ──────────────────────────────────

  it('returns null when JWT header cannot be parsed (catch branch)', async () => {
    // "!!!" is not valid base64url that decodes to JSON
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer !!!.!!!.!!!' },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyJwt: no kid ────────────────────────────────────────────────────

  it('returns null when JWT header has no kid', async () => {
    const jwt = makeJwt({ alg: 'ES256' }, { id: 'u1' });
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyJwt: expired token ─────────────────────────────────────────────

  it('returns null for a JWT with an expired exp claim', async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const jwt = makeJwt({ alg: 'ES256', kid: 'kid-exp' }, { id: 'u1', exp: pastExp });
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyJwt: no id/sub ────────────────────────────────────────────────

  it('returns null when JWT payload has neither id nor sub', async () => {
    const jwt = makeJwt({ alg: 'ES256', kid: 'kid-noid' }, { email: 'x@test.com' });
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9999';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'kid-noid', kty: 'EC' }] }),
    });
    // verifyJwt finds no id → returns null, then verifyNeonAuthSession is called
    // The session endpoint returns something without a user → null
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    // verifyNeonAuthSession uses the raw token (the JWT string), tries get-session
    // global.fetch will be called again — it returns the JWKS response again which has no "user"
    expect(result).toBeNull();
  });

  // ─── verifyJwt: no public key ─────────────────────────────────────────────

  it('returns null when no public key found (no NEON_AUTH_URL → fetchJwks skips)', async () => {
    // NEON_AUTH_URL not set → fetchJwks returns early → key not cached
    const jwt = makeJwt({ alg: 'ES256', kid: 'kid-no-key' }, { id: 'u1' });
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result).toBeNull();
  });

  // ─── fetchJwks: fetch returns !ok ─────────────────────────────────────────

  it('returns null when JWKS fetch returns a non-ok response', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9998';
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const jwt = makeJwt({ alg: 'ES256', kid: 'kid-fetch-not-ok' }, { id: 'u1' });
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result).toBeNull();
  });

  // ─── fetchJwks: key without kid ────────────────────────────────────────────

  it('skips JWKS key that has no kid field', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9997';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kty: 'EC' /* no kid */ }] }),
    });
    const jwt = makeJwt({ alg: 'ES256', kid: 'kid-missing' }, { id: 'u1' });
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result).toBeNull();
  });

  // ─── fetchJwks: createPublicKey throws (unsupported key type) ─────────────

  it('skips key when createPublicKey throws', async () => {
    const { createPublicKey } = await import('crypto');
    (createPublicKey as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('unsupported key');
    });
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9996';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'kid-bad-type', kty: 'unknown' }] }),
    });
    const jwt = makeJwt({ alg: 'ES256', kid: 'kid-bad-type' }, { id: 'u1' });
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    // key not cached since createPublicKey threw → null
    expect(result).toBeNull();
  });

  // ─── verifyJwt: signature invalid ─────────────────────────────────────────

  it('returns null when JWT signature is invalid (verify returns false)', async () => {
    const { verify } = await import('crypto');
    (verify as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9995';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'kid-invalid-sig', kty: 'EC' }] }),
    });
    const jwt = makeJwt({ alg: 'ES256', kid: 'kid-invalid-sig' }, { id: 'u1' });
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyJwt: happy path — valid JWT with role ──────────────────────────

  it('returns user when JWT is valid and has a role claim', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9994';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'kid-with-role', kty: 'EC' }] }),
    });
    const jwt = makeJwt(
      { alg: 'ES256', kid: 'kid-with-role' },
      { id: 'usr1', email: 'usr@test.com', name: 'Usr', image: 'http://img', role: 'admin' },
    );
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result).toEqual({
      id: 'usr1',
      email: 'usr@test.com',
      name: 'Usr',
      image: 'http://img',
      role: 'admin',
    });
  });

  // ─── verifyJwt: happy path — JWT valid but no role → look up DB ───────────

  it('returns user with role from DB when JWT has no role claim', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9993';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'kid-no-role', kty: 'EC' }] }),
    });
    dbRows = [[{ role: 'editor' }]];
    const jwt = makeJwt(
      { alg: 'ES256', kid: 'kid-no-role' },
      { id: 'usr2', email: 'usr2@test.com' /* no role */ },
    );
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result?.id).toBe('usr2');
    expect(result?.role).toBe('editor');
  });

  // ─── verifyJwt: no role, DB has no role ───────────────────────────────────

  it('returns user with null role when JWT has no role and DB has no role', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9992';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'kid-null-role', kty: 'EC' }] }),
    });
    dbRows = [[{}]]; // row exists but no role field
    const jwt = makeJwt(
      { alg: 'ES256', kid: 'kid-null-role' },
      { sub: 'sub-user', email: 'sub@test.com' },
    );
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result?.id).toBe('sub-user');
    expect(result?.role).toBeNull();
  });

  // ─── getRoleFromDb: no DATABASE_URL ──────────────────────────────────────

  it('returns user with null role when DATABASE_URL is not set', async () => {
    delete process.env['DATABASE_URL'];
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9991';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'kid-no-db', kty: 'EC' }] }),
    });
    const jwt = makeJwt({ alg: 'ES256', kid: 'kid-no-db' }, { id: 'usr3', email: 'usr3@test.com' });
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result?.role).toBeNull();
  });

  // ─── getRoleFromDb: DB throws ─────────────────────────────────────────────

  it('returns user with null role when DB role lookup throws', async () => {
    dbThrows = true;
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9990';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'kid-db-err', kty: 'EC' }] }),
    });
    const jwt = makeJwt(
      { alg: 'ES256', kid: 'kid-db-err' },
      { id: 'usr4', email: 'usr4@test.com' },
    );
    const result = await getUserFromRequest({
      headers: { authorization: `Bearer ${jwt}` },
    } as any);
    expect(result?.role).toBeNull();
  });

  // ─── getPublicKey: uses cache TTL ─────────────────────────────────────────

  it('returns cached key without re-fetching JWKS within TTL', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9989';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ kid: 'kid-cached', kty: 'EC' }] }),
    });
    global.fetch = fetchMock;
    const jwt = makeJwt({ alg: 'ES256', kid: 'kid-cached' }, { id: 'cached-user', role: 'user' });
    // First call — fetches JWKS
    await getUserFromRequest({ headers: { authorization: `Bearer ${jwt}` } } as any);
    const callsAfterFirst = fetchMock.mock.calls.length;
    // Second call — should use cache, not fetch again
    await getUserFromRequest({ headers: { authorization: `Bearer ${jwt}` } } as any);
    // Only 1 additional fetch call at most (for get-session if verifyJwt succeeded)
    // The JWKS fetch should NOT be called again
    const jwksCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/.well-known/jwks.json'),
    ).length;
    expect(jwksCalls).toBe(1); // fetched only once across 2 calls
  });

  // ─── verifyNeonAuthSession: no NEON_AUTH_URL ──────────────────────────────

  it('falls through verifyNeonAuthSession returning null when NEON_AUTH_URL not set', async () => {
    // JWT with 2 parts → verifyJwt returns null directly
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer part1.part2' },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyNeonAuthSession: fetch throws ─────────────────────────────────

  it('returns null when verifyNeonAuthSession fetch throws', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9988';
    // The only token path that reaches verifyNeonAuthSession:
    // verifyJwt must return null — use a 2-part token
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer t1.t2' },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyNeonAuthSession: response not ok ───────────────────────────────

  it('returns null when session endpoint returns non-ok response', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9987';
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer t1.t2' },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyNeonAuthSession: user.id missing ────────────────────────────────

  it('returns null when session response has no user id', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9986';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { email: 'no-id@test.com' } }),
    });
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer t1.t2' },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyNeonAuthSession: data null ────────────────────────────────────

  it('returns null when session response body is null', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9985';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => null,
    });
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer t1.t2' },
    } as any);
    expect(result).toBeNull();
  });

  // ─── verifyNeonAuthSession: user with role ────────────────────────────────

  it('returns user from session when session has role', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9984';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'sess-user', email: 'sess@test.com', name: 'Sess', image: null, role: 'admin' },
      }),
    });
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer t1.t2' },
    } as any);
    expect(result).toEqual({
      id: 'sess-user',
      email: 'sess@test.com',
      name: 'Sess',
      image: null,
      role: 'admin',
    });
  });

  // ─── verifyNeonAuthSession: user without role → getRoleFromDb ────────────

  it('looks up DB role when session user has no role', async () => {
    process.env['NEON_AUTH_URL'] = 'http://fake-auth:9983';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'sess-user2', email: 'sess2@test.com', name: 'S', image: null },
      }),
    });
    dbRows = [[{ role: 'viewer' }]];
    const result = await getUserFromRequest({
      headers: { authorization: 'Bearer t1.t2' },
    } as any);
    expect(result?.role).toBe('viewer');
  });
});
