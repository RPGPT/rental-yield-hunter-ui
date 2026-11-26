export interface ClusterSibling {
  id: string;
  source: string;
  url: string;
  price: number;
  title: string;
  area?: number | null;
  floor?: string | null;
}

export interface Listing {
  id: string;
  source: string;
  url: string;
  title: string;
  description: string | null;
  price: number;
  initial_price?: number | null;
  price_drop_amount?: number | null;
  price_drop_pct?: number | null;
  price_change_count?: number | null;
  area: number | null;
  price_per_m2: number | null;
  location: string | null;
  neighborhood: string | null;
  city: string | null;
  property_type: string | null;
  typology: string | null;
  floor: string | null;
  is_rented: boolean;
  lifetime_rent: boolean;
  is_favorite: boolean;
  is_hidden: boolean;
  active: boolean;
  inactive_since: string | null;
  first_seen: string;
  last_seen: string;
  // Rent estimate (from rental_estimates table)
  estimated_rent: number | null;
  avg_rent_per_m2: number | null;
  sample_count: number | null;
  confidence: 'high' | 'medium' | 'low' | 'none' | null;
  match_level: 'neighborhood' | 'city' | 'neighborhood_broad' | 'city_broad' | 'none' | null;
  rental_yield: number | null;
  previous_price?: number | null;
  // Rent contract details + lease-expiry reversion upside
  rent_current_rent: number | null;
  rent_contract_expiry: string | null;
  rent_contract_confidence?: number | null;
  rent_contract_raw_rent?: string | null;
  rent_contract_raw_expiry?: string | null;
  rent_current_yield?: number | null;
  rent_reversion_yield?: number | null;
  rent_upside_pct?: number | null;
  rent_months_to_expiry?: number | null;
  // Cross-source / multi-agency deduplication & arbitrage
  cluster_id?: string | null;
  cluster_size?: number | null;
  cluster_min_price?: number | null;
  cluster_max_price?: number | null;
  price_spread?: number | null;
  price_spread_pct?: number | null;
  is_cheapest?: boolean | null;
  cluster_sources?: string[] | null;
}

export interface RentalListing {
  id: string;
  source: string;
  url: string;
  title: string;
  description: string | null;
  price: number;
  initial_price?: number | null;
  price_drop_amount?: number | null;
  price_drop_pct?: number | null;
  price_change_count?: number | null;
  area: number | null;
  rent_price_per_m2: number | null;
  location: string | null;
  neighborhood: string | null;
  city: string | null;
  typology: string | null;
  floor: string | null;
  is_favorite: boolean;
  active: boolean;
  inactive_since: string | null;
  first_seen: string;
  last_seen: string;
}

export interface ListingImage {
  large: string;
  medium: string;
}

export interface ListingDetail extends Listing {
  price_history: PricePoint[];
  images: ListingImage[];
  cluster_siblings?: ClusterSibling[];
}

export interface RentalListingDetail extends RentalListing {
  price_history: PricePoint[];
  images: ListingImage[];
}

export interface PricePoint {
  price: number;
  captured_at: string;
}
