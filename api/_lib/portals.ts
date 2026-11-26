const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const IMOVIRTUAL_BASE = 'https://www.imovirtual.com';
const BUILD_ID_TTL_MS = 10 * 60 * 1000;

let cachedBuildId: string | null = null;
let buildIdFetchedAt = 0;

export interface PortalImage {
  large: string;
  medium: string;
}

export interface ImovirtualAdImage {
  url?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
}

export interface ImovirtualAdData {
  description?: string;
  images?: ImovirtualAdImage[];
  characteristics?: unknown[];
  topInformation?: unknown[];
  additionalInformation?: unknown[];
}

export function normalizeImovirtualImages(images?: ImovirtualAdImage[]): PortalImage[] {
  return (images ?? [])
    .map((img) => {
      const large = img.large || img.url || img.medium || '';
      const medium = img.medium || img.url || img.large || '';
      return { large, medium };
    })
    .filter((img) => Boolean(img.large));
}

export function imovirtualSlugFromUrl(url: string): string | null {
  const match = url.match(/\/pt\/anuncio\/([^/?#]+)/);
  return match ? match[1] : null;
}

async function fetchFreshImovirtualBuildId(): Promise<string | null> {
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
    console.error('[portals] failed to fetch Imovirtual build ID:', err);
    return null;
  }
}

async function getImovirtualBuildId(): Promise<string | null> {
  if (cachedBuildId && Date.now() - buildIdFetchedAt < BUILD_ID_TTL_MS) {
    return cachedBuildId;
  }
  return fetchFreshImovirtualBuildId();
}

async function fetchImovirtualViaNextData(
  buildId: string,
  slug: string,
): Promise<ImovirtualAdData | null> {
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
    const data = (await r.json()) as { pageProps?: { ad?: ImovirtualAdData } };
    return data?.pageProps?.ad ?? null;
  } catch {
    return null;
  }
}

async function fetchImovirtualViaHtml(slug: string): Promise<ImovirtualAdData | null> {
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
      props?: { pageProps?: { ad?: ImovirtualAdData } };
    };
    return nextData?.props?.pageProps?.ad ?? null;
  } catch (err) {
    console.error('[portals] imovirtual HTML fallback error:', err);
    return null;
  }
}

/**
 * Fetches full Imovirtual ad payload with automatic buildId refresh and HTML `__NEXT_DATA__` fallback.
 */
export async function fetchImovirtualAd(slug: string): Promise<ImovirtualAdData | null> {
  let ad: ImovirtualAdData | null = null;

  const buildId = await getImovirtualBuildId();
  if (buildId) {
    ad = await fetchImovirtualViaNextData(buildId, slug);
  }

  if (!ad) {
    cachedBuildId = null;
    const freshBuildId = await fetchFreshImovirtualBuildId();
    if (freshBuildId) {
      ad = await fetchImovirtualViaNextData(freshBuildId, slug);
    }
  }

  if (!ad) {
    ad = await fetchImovirtualViaHtml(slug);
  }

  return ad;
}

/**
 * Lightweight live image lookup used during Imovirtual snapshot capture.
 */
export async function fetchImovirtualImages(listingUrl: string): Promise<PortalImage[]> {
  const slug = imovirtualSlugFromUrl(listingUrl);
  if (!slug) return [];
  const buildId = await getImovirtualBuildId();
  if (!buildId) return [];
  const ad = await fetchImovirtualViaNextData(buildId, slug);
  if (!ad) {
    cachedBuildId = null;
    return [];
  }
  return normalizeImovirtualImages(ad.images);
}

function eraReferenceFromUrl(url: string): string | null {
  const match = url.match(/-(\d+)(?:[/?#]|$)/);
  return match ? match[1] : null;
}

export async function fetchEraData(
  url: string,
): Promise<{ description: string | null; images: PortalImage[] }> {
  const reference = eraReferenceFromUrl(url);
  if (!reference) return { description: null, images: [] };

  try {
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
    const tokenMatch = html.match(
      /<input[^>]+name="__RequestVerificationToken"[^>]+value="([^"]+)"/,
    );
    if (!tokenMatch) {
      console.error('[portals] ERA: __RequestVerificationToken not found in HTML');
      return { description: null, images: [] };
    }
    const formToken = tokenMatch[1];

    const h = pageRes.headers as Headers & { getSetCookie?(): string[] };
    const setCookies =
      typeof h.getSetCookie === 'function'
        ? h.getSetCookie()
        : (pageRes.headers.get('set-cookie') ?? '').split(/,(?=\s*[\w.]+\s*=)/).filter(Boolean);
    const cookieHeader = setCookies
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

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
      console.error(`[portals] ERA API returned ${apiRes.status}`);
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
    console.error('[portals] ERA fetch error:', err);
    return { description: null, images: [] };
  }
}

export async function fetchCasaSapoData(
  url: string,
): Promise<{ description: string | null; images: PortalImage[] }> {
  try {
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
    const seen = new Set<string>();
    const images: PortalImage[] = [];

    for (const m of html.matchAll(/https:\/\/media\.casasapo\.pt\/Z\d+x\d+\/[^"'\s,)<>]+/g)) {
      const rawUrl = m[0].replace(/\.webp$/, '');
      const large = rawUrl.replace(/\/Z\d+x\d+\//, '/Z1440x1080/');
      const medium = rawUrl.replace(/\/Z\d+x\d+\//, '/Z720x540/');
      if (!seen.has(large)) {
        seen.add(large);
        images.push({ large, medium });
      }
    }

    const descMatch =
      html.match(/<div class="detail-description-text"[^>]*>([\s\S]*?)<\/div>/i) ??
      html.match(/<div class="property-description"[^>]*>([\s\S]*?)<\/div>/i);

    return {
      description: descMatch ? descMatch[1].trim() : null,
      images,
    };
  } catch (err) {
    console.error('[portals] Casa Sapo fetch error:', err);
    return { description: null, images: [] };
  }
}
