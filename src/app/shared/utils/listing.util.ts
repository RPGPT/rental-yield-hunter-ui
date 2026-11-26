import type { Listing, PricePoint, RentalListing } from '../../core/models/listing.model';

export type BadgeColor = 'green' | 'red' | 'amber' | 'grey' | 'blue';
export type ConfidenceBadgeColor = 'green' | 'amber' | 'grey';
export type RentedBadgeColor = 'red' | 'green' | 'grey';

export function formatEur(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + '€';
}

export function sourceLabel(source: string | null | undefined): string {
  if (source === 'imovirtual') return 'Imovirtual';
  if (source === 'era') return 'ERA';
  if (source === 'casasapo') return 'Casa Sapo';
  if (source === 'manual') return 'Manual';
  return source || '—';
}

export function isPortalHydrationSupported(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('imovirtual.com') || url.includes('era.pt') || url.includes('casa.sapo.pt');
}

export function mapsUrl(listing: {
  location: string | null;
  neighborhood: string | null;
  city: string | null;
}): string | null {
  const q = listing.location ?? [listing.neighborhood, listing.city].filter(Boolean).join(', ');
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function confidenceColor(confidence: string | null | undefined): ConfidenceBadgeColor {
  if (confidence === 'high') return 'green';
  if (confidence === 'medium') return 'amber';
  return 'grey';
}

export function typologyColor(typology: string): BadgeColor {
  const match = typology.match(/^T(\d+)$/);
  if (!match) return 'grey';
  const n = Number(match[1]);
  if (n === 1) return 'blue';
  if (n === 2) return 'amber';
  if (n >= 3) return 'green';
  return 'grey';
}

export function displayYield(
  row: Pick<
    Listing,
    'is_rented' | 'lifetime_rent' | 'rent_current_rent' | 'price' | 'rental_yield'
  >,
): number | null {
  if (row.is_rented && !row.lifetime_rent && !!row.rent_current_rent) {
    return (row.rent_current_rent * 12) / row.price;
  }
  return row.rental_yield;
}

export function yieldTooltip(row: Listing, includeReversion = true): string {
  if (row.is_rented && !row.lifetime_rent && !!row.rent_current_rent) {
    const contractYield = (((row.rent_current_rent * 12) / row.price) * 100).toFixed(2);
    const lines = [
      `Contract yield: ${formatEur(row.rent_current_rent)}/mo × 12 ÷ ${formatEur(row.price)} = ${contractYield}%`,
    ];
    if (row.rental_yield != null) {
      lines.push(`Est. yield: ${(row.rental_yield * 100).toFixed(2)}%`);
    }
    if (includeReversion && row.rent_reversion_yield != null) {
      const upside =
        row.rent_upside_pct != null && row.rent_upside_pct > 0
          ? ` (+${Math.round(row.rent_upside_pct * 100)}% upside)`
          : '';
      lines.push(`Reversion yield: ${(row.rent_reversion_yield * 100).toFixed(2)}%${upside}`);
    }
    return lines.join('\n');
  }
  return '';
}

export function estRentTooltip(row: Listing): string {
  if (row.is_rented && !row.lifetime_rent && !!row.rent_current_rent) {
    return row.estimated_rent != null
      ? `Market est.: ${formatEur(row.estimated_rent)}/mo`
      : 'No market estimate available';
  }
  if (row.estimated_rent == null) return '';
  return row.sample_count != null
    ? `${row.confidence} confidence · based on ${row.sample_count} comparables (${row.match_level})`
    : `${row.confidence} confidence`;
}

export function rentedChipColor(row: Listing): RentedBadgeColor {
  if (row.lifetime_rent) return 'red';
  if (!!row.rent_current_rent) return 'green';
  return 'grey';
}

export function rentedTooltip(row: Listing): string {
  if (row.lifetime_rent) return 'Lifetime rent';
  if (!!row.rent_current_rent) {
    const rent = new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(row.rent_current_rent);
    const expiry = row.rent_contract_expiry
      ? `Expires ${new Date(row.rent_contract_expiry).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })}`
      : 'No expiry date';
    let tip = `Rent: ${rent}/mo · ${expiry}`;
    if (row.rent_months_to_expiry != null) {
      tip += ` (${row.rent_months_to_expiry} mo left)`;
    }
    if (row.rent_upside_pct != null && row.rent_upside_pct > 0) {
      tip += ` · +${Math.round(row.rent_upside_pct * 100)}% reversion upside`;
    }
    return tip;
  }
  return 'Rented — no contract details';
}

export function previousPrice(row: Listing | RentalListing): number | null {
  return (row as Listing).previous_price ?? row.initial_price ?? null;
}

export function priceChangePct(row: Listing | RentalListing): number | null {
  const prev = previousPrice(row);
  if (!prev || prev === row.price) return null;
  return Math.round(((row.price - prev) / prev) * 100) || null;
}

export function hasPriceIncreased(
  listing: { price: number; price_drop_amount?: number | null; price_history: PricePoint[] } | null,
): boolean {
  if (!listing) return false;
  return (
    listing.price_history.some((h) => h.price < listing.price) ||
    (listing.price_drop_amount != null && listing.price_drop_amount < 0)
  );
}

export function hasPriceDecreased(
  listing: { price: number; price_drop_amount?: number | null; price_history: PricePoint[] } | null,
): boolean {
  if (!listing) return false;
  return (
    listing.price_history.some((h) => h.price > listing.price) ||
    (listing.price_drop_amount != null && listing.price_drop_amount > 0)
  );
}

export function contractExpiringSoon(expiry: string): boolean {
  const days = (new Date(expiry).getTime() - Date.now()) / 86_400_000;
  return days <= 180;
}

export function clusterBadgeText(row: Listing | RentalListing): string | null {
  const l = row as Listing;
  const size = l.cluster_size ?? 1;
  if (size <= 1) return null;
  if (l.is_cheapest && (l.price_spread ?? 0) > 0) {
    return `-${formatEur(l.price_spread ?? null)} · ${size} ads`;
  }
  return `${size} ads`;
}

export function clusterTooltip(row: Listing | RentalListing): string {
  const l = row as Listing;
  const size = l.cluster_size ?? 1;
  if (size <= 1) return '';
  const parts = [`Same apartment listed in ${size} ads`];
  if (l.cluster_sources?.length) {
    parts.push(`Sources: ${l.cluster_sources.map((s) => sourceLabel(s)).join(', ')}`);
  }
  if (l.cluster_min_price != null && l.cluster_max_price != null) {
    parts.push(`Range: ${formatEur(l.cluster_min_price)} – ${formatEur(l.cluster_max_price)}`);
  }
  if ((l.price_spread ?? 0) > 0) {
    parts.push(`Spread: ${formatEur(l.price_spread ?? null)}`);
  }
  return parts.join(' · ');
}
