import type { VercelRequest, VercelResponse } from '../_types';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ─── Imovirtual ──────────────────────────────────────────────────────────────

const IMOVIRTUAL_BASE = 'https://www.imovirtual.com';

let cachedBuildId: string | null = null;
let buildIdFetchedAt = 0;
const BUILD_ID_TTL_MS = 10 * 60 * 1000;

interface AdData {
  description?: string;
  images?: { thumbnail?: string; small?: string; medium?: string; large?: string }[];
  characteristics?: unknown[];
  topInformation?: unknown[];
  additionalInformation?: unknown[];
}

async function fetchFreshBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`${IMOVIRTUAL_BASE}/pt`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-PT,pt;q=0.9' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
    if (!match) return null;
    cachedBuildId = match[1];
    buildIdFetchedAt = Date.now();
    return cachedBuildId;
  } catch (err) {
    console.error('[description] failed to fetch build ID:', err);
    return null;
  }
}

async function getBuildId(): Promise<string | null> {
  if (cachedBuildId && Date.now() - buildIdFetchedAt < BUILD_ID_TTL_MS) {
    return cachedBuildId;
  }
  return fetchFreshBuildId();
}

function imovirtualSlugFromUrl(url: string): string | null {
  const match = url.match(/\/pt\/anuncio\/([^/?#]+)/);
  return match ? match[1] : null;
}

async function fetchImovirtualViaNextData(buildId: string, slug: string): Promise<AdData | null> {
  const dataUrl = `${IMOVIRTUAL_BASE}/_next/data/${buildId}/pt/anuncio/${slug}.json`;
  try {
    const r = await fetch(dataUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        'Accept-Language': 'pt-PT,pt;q=0.9',
        'x-nextjs-data': '1',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { pageProps?: { ad?: AdData } };
    return data?.pageProps?.ad ?? null;
  } catch {
    return null;
  }
}

async function fetchImovirtualViaHtml(slug: string): Promise<AdData | null> {
  const pageUrl = `${IMOVIRTUAL_BASE}/pt/anuncio/${slug}`;
  try {
    const r = await fetch(pageUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-PT,pt;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const html = await r.text();

    const buildMatch = html.match(/"buildId"\s*:\s*"([^"]+)"/);
    if (buildMatch) {
      cachedBuildId = buildMatch[1];
      buildIdFetchedAt = Date.now();
    }

    const scriptMatch = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/,
    );
    if (!scriptMatch) return null;

    const nextData = JSON.parse(scriptMatch[1]) as {
      props?: { pageProps?: { ad?: AdData } };
    };
    return nextData?.props?.pageProps?.ad ?? null;
  } catch (err) {
    console.error('[description] imovirtual HTML fallback error:', err);
    return null;
  }
}

// ─── ERA ─────────────────────────────────────────────────────────────────────

function eraReferenceFromUrl(url: string): string | null {
  const match = url.match(/-(\d+)(?:[/?#]|$)/);
  return match ? match[1] : null;
}

async function fetchEraData(
  url: string,
): Promise<{ description: string | null; images: { large: string; medium: string }[] }> {
  const reference = eraReferenceFromUrl(url);
  if (!reference) return { description: null, images: [] };

  try {
    // Step 1: load the listing page to get session cookies + CSRF hidden-input token
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-PT,pt;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!pageRes.ok) return { description: null, images: [] };

    const html = await pageRes.text();

    // DNN renders the anti-forgery token as a hidden <input> (double-submit cookie pattern)
    const tokenMatch = html.match(
      /<input[^>]+name="__RequestVerificationToken"[^>]+value="([^"]+)"/,
    );
    if (!tokenMatch) {
      console.error('[description] ERA: __RequestVerificationToken not found in HTML');
      return { description: null, images: [] };
    }
    const formToken = tokenMatch[1];

    // Collect all Set-Cookie values (Node 18+ undici supports getSetCookie())
    const h = pageRes.headers as Headers & { getSetCookie?(): string[] };
    const setCookies =
      typeof h.getSetCookie === 'function'
        ? h.getSetCookie()
        : (pageRes.headers.get('set-cookie') ?? '').split(/,(?=\s*[\w.]+\s*=)/).filter(Boolean);
    const cookieHeader = setCookies
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    // Step 2: call the ERA property detail API (DNN ServicesModule)
    const apiUrl = `https://www.era.pt/API/ServicesModule/Property/PropertyDetailByReference?reference=${reference}`;
    const apiRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json, */*',
        'Accept-Language': 'pt-PT,pt;q=0.9',
        moduleid: '641',
        tabid: '256',
        requestverificationtoken: formToken,
        'x-requested-with': 'XMLHttpRequest',
        Referer: url,
        Cookie: cookieHeader,
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!apiRes.ok) {
      console.error(`[description] ERA API returned ${apiRes.status}`);
      return { description: null, images: [] };
    }

    const data = (await apiRes.json()) as {
      Gallery?: Array<{ Url: string; IsPlan: boolean }>;
      Description?: string;
    };

    const images = (data.Gallery ?? [])
      .filter((item) => !item.IsPlan)
      .map((item) => ({ large: item.Url, medium: item.Url }));

    return { description: data.Description ?? null, images };
  } catch (err) {
    console.error('[description] ERA fetch error:', err);
    return { description: null, images: [] };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const { url } = req.query as Record<string, string | undefined>;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  // ── ERA ──
  if (url.includes('era.pt')) {
    const result = await fetchEraData(url);
    return res.status(200).json({
      description: result.description,
      images: result.images,
      characteristics: [],
      topInformation: [],
      additionalInformation: [],
    });
  }

  // ── Imovirtual ──
  const slug = imovirtualSlugFromUrl(url);
  if (!slug) return res.status(400).json({ error: 'Could not extract slug from url' });

  let ad: AdData | null = null;

  const buildId = await getBuildId();
  if (buildId) {
    ad = await fetchImovirtualViaNextData(buildId, slug);
  }

  if (!ad) {
    cachedBuildId = null;
    const freshBuildId = await fetchFreshBuildId();
    if (freshBuildId) {
      ad = await fetchImovirtualViaNextData(freshBuildId, slug);
    }
  }

  if (!ad) {
    ad = await fetchImovirtualViaHtml(slug);
  }

  if (!ad) {
    return res.status(404).json({ error: 'Ad not found' });
  }

  return res.status(200).json({
    description: ad.description ?? null,
    images: (ad.images ?? []).map((img) => ({
      medium: img.medium ?? '',
      large: img.large ?? '',
    })),
    characteristics: ad.characteristics ?? [],
    topInformation: ad.topInformation ?? [],
    additionalInformation: ad.additionalInformation ?? [],
  });
}
