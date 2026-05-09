import type { VercelRequest, VercelResponse } from '../_types';

const IMOVIRTUAL_BASE = 'https://www.imovirtual.com';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Cache the build ID in-memory (resets on cold start, fine for serverless)
let cachedBuildId: string | null = null;
let buildIdFetchedAt = 0;
const BUILD_ID_TTL_MS = 10 * 60 * 1000; // refresh every 10 min

async function getBuildId(): Promise<string | null> {
  if (cachedBuildId && Date.now() - buildIdFetchedAt < BUILD_ID_TTL_MS) {
    return cachedBuildId;
  }
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

function slugFromUrl(url: string): string | null {
  const match = url.match(/\/pt\/anuncio\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const { url } = req.query as Record<string, string | undefined>;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

  const slug = slugFromUrl(url);
  if (!slug) return res.status(400).json({ error: 'Could not extract slug from url' });

  const buildId = await getBuildId();
  if (!buildId) return res.status(502).json({ error: 'Could not fetch imovirtual build ID' });

  try {
    const dataUrl = `${IMOVIRTUAL_BASE}/_next/data/${buildId}/pt/anuncio/${slug}.json`;
    const r = await fetch(dataUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        'Accept-Language': 'pt-PT,pt;q=0.9',
        'x-nextjs-data': '1',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) {
      // Build ID may have changed — invalidate cache and try once more
      cachedBuildId = null;
      return res.status(r.status).json({ error: `Upstream returned ${r.status}` });
    }

    const data = (await r.json()) as {
      pageProps?: {
        ad?: {
          description?: string;
          images?: { thumbnail?: string; small?: string; medium?: string; large?: string }[];
          characteristics?: unknown[];
          topInformation?: unknown[];
          additionalInformation?: unknown[];
        };
      };
    };

    const ad = data?.pageProps?.ad;
    if (!ad) return res.status(404).json({ error: 'Ad not found in response' });

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[description] fetch error:', msg);
    return res.status(502).json({ error: msg });
  }
}
