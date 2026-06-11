import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockRes } from '../test/mock-res';

// fetchMock is reassigned per-test; the global stub delegates to it
let fetchMock: ReturnType<typeof vi.fn>;
vi.stubGlobal('fetch', (...args: unknown[]) => fetchMock(...args));

// Minimal Headers-like object with optional getSetCookie()
function makeHeaders(entries: Record<string, string> = {}) {
  return {
    get: (key: string) => entries[key.toLowerCase()] ?? null,
    getSetCookie: () =>
      entries['set-cookie'] ? entries['set-cookie'].split(',').map((s) => s.trim()) : [],
  };
}

function okJsonResponse(body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
    headers: makeHeaders(headers),
  };
}

function okTextResponse(text: string, headers: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    text: async () => text,
    json: async () => ({}),
    headers: makeHeaders(headers),
  };
}

function failResponse(status = 404) {
  return {
    ok: false,
    status,
    text: async () => '',
    json: async () => ({}),
    headers: makeHeaders(),
  };
}

describe('api/listings/description handler', () => {
  // Re-import handler each test to reset module-level cache (cachedBuildId etc.)
  let handler: (req: unknown, res: unknown) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./description');
    handler = mod.default;
    fetchMock = vi.fn().mockResolvedValue(failResponse());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when url param is missing', async () => {
    const res = new MockRes();
    await handler({ query: {} } as never, res as never);
    expect(res._status).toBe(400);
    expect((res._body as { error: string }).error).toBe('Missing url param');
  });

  // ── ERA ───────────────────────────────────────────────────────────────────

  describe('ERA listings', () => {
    const ERA_URL = 'https://www.era.pt/comprar/apartamento-t3-porto-423260032';
    const ERA_HTML = `<html><body><form><input name="__RequestVerificationToken" value="form-token-abc" /></form></body></html>`;
    const ERA_GALLERY = [
      { Url: 'https://media.era.pt/photo1.jpg', IsPlan: false },
      { Url: 'https://media.era.pt/plan.jpg', IsPlan: true },
      { Url: 'https://media.era.pt/photo2.jpg', IsPlan: false },
    ];

    it('returns 200 with images (plans excluded) and description', async () => {
      fetchMock
        .mockResolvedValueOnce(
          okTextResponse(ERA_HTML, { 'set-cookie': '__RequestVerificationToken=cookie-token' }),
        )
        .mockResolvedValueOnce(okJsonResponse({ Gallery: ERA_GALLERY, Description: 'Nice flat' }));

      const res = new MockRes();
      await handler({ query: { url: ERA_URL } } as never, res as never);

      expect(res._status).toBe(200);
      const body = res._body as { images: unknown[]; description: string };
      expect(body.description).toBe('Nice flat');
      expect(body.images).toHaveLength(2);
      expect(body.images).toEqual([
        { large: 'https://media.era.pt/photo1.jpg', medium: 'https://media.era.pt/photo1.jpg' },
        { large: 'https://media.era.pt/photo2.jpg', medium: 'https://media.era.pt/photo2.jpg' },
      ]);
    });

    it('returns empty images when Gallery is absent', async () => {
      fetchMock
        .mockResolvedValueOnce(okTextResponse(ERA_HTML))
        .mockResolvedValueOnce(okJsonResponse({ Description: 'Desc only' }));

      const res = new MockRes();
      await handler({ query: { url: ERA_URL } } as never, res as never);

      expect(res._status).toBe(200);
      expect((res._body as { images: unknown[] }).images).toHaveLength(0);
    });

    it('returns empty data when URL has no trailing reference number', async () => {
      const res = new MockRes();
      await handler(
        { query: { url: 'https://www.era.pt/comprar/sem-ref' } } as never,
        res as never,
      );

      expect(res._status).toBe(200);
      expect((res._body as { images: unknown[] }).images).toHaveLength(0);
    });

    it('returns empty data when page fetch fails', async () => {
      fetchMock.mockResolvedValueOnce(failResponse(503));

      const res = new MockRes();
      await handler({ query: { url: ERA_URL } } as never, res as never);

      expect(res._status).toBe(200);
      expect((res._body as { images: unknown[] }).images).toHaveLength(0);
    });

    it('returns empty data when HTML has no CSRF token', async () => {
      fetchMock.mockResolvedValueOnce(okTextResponse('<html><body>No token here</body></html>'));

      const res = new MockRes();
      await handler({ query: { url: ERA_URL } } as never, res as never);

      expect(res._status).toBe(200);
      expect((res._body as { images: unknown[] }).images).toHaveLength(0);
    });

    it('returns empty data when ERA API returns non-ok status', async () => {
      fetchMock
        .mockResolvedValueOnce(okTextResponse(ERA_HTML))
        .mockResolvedValueOnce(failResponse(401));

      const res = new MockRes();
      await handler({ query: { url: ERA_URL } } as never, res as never);

      expect(res._status).toBe(200);
      expect((res._body as { images: unknown[] }).images).toHaveLength(0);
    });

    it('returns empty data when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network error'));

      const res = new MockRes();
      await handler({ query: { url: ERA_URL } } as never, res as never);

      expect(res._status).toBe(200);
      expect((res._body as { images: unknown[] }).images).toHaveLength(0);
    });

    it('includes standard response fields', async () => {
      fetchMock
        .mockResolvedValueOnce(okTextResponse(ERA_HTML))
        .mockResolvedValueOnce(okJsonResponse({ Gallery: [] }));

      const res = new MockRes();
      await handler({ query: { url: ERA_URL } } as never, res as never);

      const body = res._body as Record<string, unknown>;
      expect(body).toHaveProperty('characteristics');
      expect(body).toHaveProperty('topInformation');
      expect(body).toHaveProperty('additionalInformation');
    });
  });

  // ── Imovirtual ─────────────────────────────────────────────────────────────

  describe('imovirtual listings', () => {
    const IMOVIRTUAL_URL = 'https://www.imovirtual.com/pt/anuncio/apartamento-t3-porto-ID1abc';
    const MOCK_AD = {
      description: 'Lovely T3',
      images: [
        {
          large: 'https://cdn.imovirtual.com/1-large.jpg',
          medium: 'https://cdn.imovirtual.com/1-med.jpg',
        },
      ],
      characteristics: [{ label: 'area', value: '90m²' }],
      topInformation: [],
      additionalInformation: [],
    };

    it('returns 400 when URL does not contain a slug', async () => {
      const res = new MockRes();
      await handler({ query: { url: 'https://www.imovirtual.com/' } } as never, res as never);
      expect(res._status).toBe(400);
    });

    it('returns 200 with ad data when buildId is fresh and _next/data succeeds', async () => {
      // First fetch: homepage for build ID
      fetchMock
        .mockResolvedValueOnce(okTextResponse('"buildId":"build-xyz"'))
        // Second fetch: _next/data JSON
        .mockResolvedValueOnce(okJsonResponse({ pageProps: { ad: MOCK_AD } }));

      const res = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res as never);

      expect(res._status).toBe(200);
      const body = res._body as { description: string; images: unknown[] };
      expect(body.description).toBe('Lovely T3');
      expect(body.images).toHaveLength(1);
    });

    it('refreshes buildId when _next/data returns non-ok and retries', async () => {
      // 1st fetch: homepage (cached build ID miss → fetch fresh)
      fetchMock
        .mockResolvedValueOnce(okTextResponse('"buildId":"build-stale"'))
        // 2nd fetch: _next/data with stale build ID → fails
        .mockResolvedValueOnce(failResponse(404))
        // 3rd fetch: homepage again for fresh build ID
        .mockResolvedValueOnce(okTextResponse('"buildId":"build-fresh"'))
        // 4th fetch: _next/data with fresh build ID → succeeds
        .mockResolvedValueOnce(okJsonResponse({ pageProps: { ad: MOCK_AD } }));

      const res = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res as never);

      expect(res._status).toBe(200);
      expect((res._body as { description: string }).description).toBe('Lovely T3');
    });

    it('falls back to HTML scraping when _next/data fails on both attempts', async () => {
      const htmlWithNextData = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { ad: MOCK_AD } } })}</script></body></html>`;

      fetchMock
        // buildId fetch fails (no match in HTML)
        .mockResolvedValueOnce(okTextResponse('no build id here'))
        // First _next/data attempt → skipped (no buildId)
        // Fresh buildId fetch also fails
        .mockResolvedValueOnce(okTextResponse('still no build id'))
        // HTML fallback
        .mockResolvedValueOnce(okTextResponse(htmlWithNextData));

      const res = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res as never);

      expect(res._status).toBe(200);
      expect((res._body as { description: string }).description).toBe('Lovely T3');
    });

    it('returns 404 when all imovirtual fetch strategies fail', async () => {
      // homepage: no build ID
      fetchMock
        .mockResolvedValueOnce(okTextResponse('no build id'))
        // refresh build ID: also fails
        .mockResolvedValueOnce(okTextResponse('still none'))
        // HTML fallback: returns page without __NEXT_DATA__
        .mockResolvedValueOnce(okTextResponse('<html><body>No data</body></html>'));

      const res = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res as never);

      expect(res._status).toBe(404);
    });

    it('updates cachedBuildId when HTML fallback contains buildId', async () => {
      const htmlWithBuildId = `<html><head><script>"buildId":"recovered-build"</script></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { ad: MOCK_AD } } })}</script></body></html>`;

      fetchMock
        .mockResolvedValueOnce(okTextResponse('no build'))
        .mockResolvedValueOnce(okTextResponse('no build'))
        .mockResolvedValueOnce(okTextResponse(htmlWithBuildId));

      const res = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res as never);

      expect(res._status).toBe(200);
    });

    it('returns 200 with empty images when ad images are missing', async () => {
      const adWithoutImages = { description: 'No pics', characteristics: [] };
      fetchMock
        .mockResolvedValueOnce(okTextResponse('"buildId":"bid"'))
        .mockResolvedValueOnce(okJsonResponse({ pageProps: { ad: adWithoutImages } }));

      const res = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res as never);

      expect(res._status).toBe(200);
      expect((res._body as { images: unknown[] }).images).toHaveLength(0);
    });

    it('handles buildId homepage fetch throwing (covers fetchFreshBuildId catch)', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('network error')) // first homepage → throws
        .mockRejectedValueOnce(new Error('network error')) // second homepage → throws
        .mockResolvedValueOnce(okTextResponse('<html><body>no data</body></html>'));

      const res = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res as never);

      expect(res._status).toBe(404);
    });

    it('handles _next/data fetch throwing an exception (covers fetchImovirtualViaNextData catch)', async () => {
      fetchMock
        .mockResolvedValueOnce(okTextResponse('"buildId":"bid"'))
        .mockRejectedValueOnce(new Error('network error')) // _next/data throws
        .mockResolvedValueOnce(okTextResponse('"buildId":"bid2"'))
        .mockRejectedValueOnce(new Error('network error')) // _next/data throws again
        .mockResolvedValueOnce(okTextResponse('<html><body>no __NEXT_DATA__ here</body></html>'));

      const res = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res as never);

      expect(res._status).toBe(404);
    });

    it('handles HTML fallback fetch throwing an exception (covers fetchImovirtualViaHtml catch)', async () => {
      fetchMock
        .mockResolvedValueOnce(okTextResponse('no build id'))
        .mockResolvedValueOnce(okTextResponse('no build id'))
        .mockRejectedValueOnce(new Error('HTML fetch failed'));

      const res = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res as never);

      expect(res._status).toBe(404);
    });

    it('uses cached buildId on second call within same module instance', async () => {
      fetchMock
        .mockResolvedValueOnce(okTextResponse('"buildId":"cached-bid"'))
        .mockResolvedValueOnce(okJsonResponse({ pageProps: { ad: MOCK_AD } }))
        // second handler call — cached bid, so only one fetch (no homepage)
        .mockResolvedValueOnce(okJsonResponse({ pageProps: { ad: MOCK_AD } }));

      const res1 = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res1 as never);
      expect(res1._status).toBe(200);

      const res2 = new MockRes();
      await handler({ query: { url: IMOVIRTUAL_URL } } as never, res2 as never);
      expect(res2._status).toBe(200);

      // Total: 2 fetches for first call + 1 for second (cached buildId)
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });
});
