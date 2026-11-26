import type { VercelRequest, VercelResponse } from '../_types';
import {
  fetchCasaSapoData,
  fetchEraData,
  fetchImovirtualAd,
  imovirtualSlugFromUrl,
  normalizeImovirtualImages,
} from '../_lib/portals.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const { url } = req.query as Record<string, string | undefined>;
  if (!url) return res.status(400).json({ error: 'Missing url param' });

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

  if (url.includes('casa.sapo.pt')) {
    const result = await fetchCasaSapoData(url);
    return res.status(200).json({
      description: result.description,
      images: result.images,
      characteristics: [],
      topInformation: [],
      additionalInformation: [],
    });
  }

  const slug = imovirtualSlugFromUrl(url);
  if (!slug) return res.status(400).json({ error: 'Could not extract slug from url' });

  const ad = await fetchImovirtualAd(slug);
  if (!ad) {
    return res.status(404).json({ error: 'Ad not found' });
  }

  return res.status(200).json({
    description: ad.description ?? null,
    images: normalizeImovirtualImages(ad.images),
    characteristics: ad.characteristics ?? [],
    topInformation: ad.topInformation ?? [],
    additionalInformation: ad.additionalInformation ?? [],
  });
}
