export interface RawPricePoint {
  price: number;
  previous_price?: number | null;
  captured_at: string;
}

export interface PricePointDto {
  price: number;
  captured_at: string;
}

export interface ImageDto {
  large: string;
  medium: string;
}

/**
 * Reconstructs clean chronological price history, prepending `initial_price` at `first_seen`
 * when a single-cut listing's first recorded history entry already reflects the reduced price.
 */
export function buildPriceHistory(
  row: Record<string, unknown>,
  rawPriceHistory: RawPricePoint[],
): PricePointDto[] {
  const priceHistory: PricePointDto[] = [];
  const initPrice =
    typeof row['initial_price'] === 'number'
      ? row['initial_price']
      : (rawPriceHistory[0]?.previous_price ?? null);

  if (
    rawPriceHistory.length > 0 &&
    initPrice != null &&
    initPrice !== rawPriceHistory[0].price &&
    row['first_seen']
  ) {
    priceHistory.push({ price: initPrice, captured_at: String(row['first_seen']) });
  }

  for (const pt of rawPriceHistory) {
    priceHistory.push({ price: pt.price, captured_at: pt.captured_at });
  }

  return priceHistory;
}

/**
 * Extracts gallery images from `raw_data` / `rental_raw_data` rows, supporting JSON-LD
 * `mainEntity.image` single-image fallback when `images` array is absent.
 */
export function extractRawImages(
  rawDataRows: Array<Record<string, unknown>>,
  allowLdFallback = false,
): ImageDto[] {
  if (rawDataRows.length === 0) return [];
  const first = rawDataRows[0];
  if (Array.isArray(first['images'])) {
    return first['images'] as ImageDto[];
  }
  if (allowLdFallback && typeof first['ld_image'] === 'string' && first['ld_image']) {
    const img = first['ld_image'];
    return [{ large: img, medium: img }];
  }
  return [];
}
