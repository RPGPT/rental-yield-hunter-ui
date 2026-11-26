import { describe, it, expect } from 'vitest';
import {
  clusterBadgeText,
  clusterTooltip,
  confidenceColor,
  contractExpiringSoon,
  displayYield,
  estRentTooltip,
  formatEur,
  hasPriceDecreased,
  hasPriceIncreased,
  isPortalHydrationSupported,
  mapsUrl,
  priceChangePct,
  rentedChipColor,
  rentedTooltip,
  sourceLabel,
  typologyColor,
  yieldTooltip,
} from './listing.util';
import type { Listing } from '../../core/models/listing.model';

const BASE_LISTING: Listing = {
  id: '1',
  source: 'imovirtual',
  url: 'https://www.imovirtual.com/pt/anuncio/1',
  title: 'T2 Porto',
  description: null,
  price: 200000,
  area: 80,
  price_per_m2: 2500,
  location: null,
  neighborhood: 'Bonfim',
  city: 'Porto',
  property_type: 'Apartment',
  typology: 'T2',
  floor: '2',
  is_rented: false,
  lifetime_rent: false,
  is_favorite: false,
  is_hidden: false,
  active: true,
  inactive_since: null,
  first_seen: '2026-01-01',
  last_seen: '2026-01-02',
  estimated_rent: 1000,
  avg_rent_per_m2: 12.5,
  sample_count: 15,
  confidence: 'high',
  match_level: 'neighborhood',
  rental_yield: 0.06,
  rent_current_rent: null,
  rent_contract_expiry: null,
};

describe('listing.util', () => {
  it('formats EUR values and handles null', () => {
    expect(formatEur(null)).toBe('—');
    expect(formatEur(1500)).toContain('€');
  });

  it('maps portal source labels and hydration URLs', () => {
    expect(sourceLabel('imovirtual')).toBe('Imovirtual');
    expect(sourceLabel('era')).toBe('ERA');
    expect(sourceLabel('casasapo')).toBe('Casa Sapo');
    expect(sourceLabel('manual')).toBe('Manual');
    expect(sourceLabel(null)).toBe('—');

    expect(isPortalHydrationSupported('https://www.imovirtual.com/pt/anuncio/x')).toBe(true);
    expect(isPortalHydrationSupported('https://www.era.pt/comprar/x-123')).toBe(true);
    expect(isPortalHydrationSupported('https://casa.sapo.pt/comprar-x.html')).toBe(true);
    expect(isPortalHydrationSupported('https://example.com')).toBe(false);
    expect(isPortalHydrationSupported(null)).toBe(false);
  });

  it('builds Google Maps URLs and badge colors', () => {
    expect(mapsUrl({ location: 'Boavista', neighborhood: null, city: null })).toContain('Boavista');
    expect(mapsUrl({ location: null, neighborhood: 'Bonfim', city: 'Porto' })).toContain('Bonfim');
    expect(mapsUrl({ location: null, neighborhood: null, city: null })).toBeNull();

    expect(confidenceColor('high')).toBe('green');
    expect(confidenceColor('medium')).toBe('amber');
    expect(confidenceColor('low')).toBe('grey');

    expect(typologyColor('T1')).toBe('blue');
    expect(typologyColor('T2')).toBe('amber');
    expect(typologyColor('T3')).toBe('green');
    expect(typologyColor('Studio')).toBe('grey');
  });

  it('computes contract vs market yields, tooltips, and expiry signals', () => {
    const tenanted: Listing = {
      ...BASE_LISTING,
      is_rented: true,
      rent_current_rent: 800,
      rent_reversion_yield: 0.06,
      rent_upside_pct: 0.25,
      rent_contract_expiry: '2027-06-01',
      rent_months_to_expiry: 7,
    };
    expect(displayYield(tenanted)).toBeCloseTo(0.048);
    expect(yieldTooltip(tenanted)).toContain('Reversion yield: 6.00% (+25% upside)');
    expect(estRentTooltip(tenanted)).toContain('Market est.');
    expect(rentedChipColor(tenanted)).toBe('green');
    expect(rentedTooltip(tenanted)).toContain('+25% reversion upside');

    const soon = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const far = new Date(Date.now() + 365 * 86_400_000).toISOString();
    expect(contractExpiringSoon(soon)).toBe(true);
    expect(contractExpiringSoon(far)).toBe(false);
  });

  it('evaluates price deltas and multi-agency cluster badges', () => {
    expect(priceChangePct({ ...BASE_LISTING, price: 180000, initial_price: 200000 })).toBe(-10);
    expect(hasPriceDecreased({ price: 180000, price_drop_amount: 20000, price_history: [] })).toBe(
      true,
    );
    expect(hasPriceIncreased({ price: 220000, price_drop_amount: -20000, price_history: [] })).toBe(
      true,
    );

    const clustered: Listing = {
      ...BASE_LISTING,
      cluster_size: 2,
      is_cheapest: true,
      price_spread: 10000,
      cluster_min_price: 200000,
      cluster_max_price: 210000,
      cluster_sources: ['imovirtual', 'era'],
    };
    expect(clusterBadgeText(clustered)).toContain('2 ads');
    expect(clusterTooltip(clustered)).toContain('Imovirtual, ERA');
  });
});
