export interface Listing {
  id: string;
  source: string;
  url: string;
  title: string;
  description: string | null;
  price: number;
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
  // Rent estimate (from rental_estimates table, may be null if not yet computed)
  estimated_rent: number | null;
  avg_rent_per_m2: number | null;
  sample_count: number | null;
  confidence: 'high' | 'medium' | 'low' | 'none' | null;
  match_level: 'neighborhood' | 'city' | 'neighborhood_broad' | 'city_broad' | 'none' | null;
  rental_yield: number | null;
  // Rent contract details (from rent_contract_details table, only when is_rented=true)
  rent_current_rent: number | null;
  rent_contract_expiry: string | null;
}

export interface RentalListing {
  id: string;
  source: string;
  url: string;
  title: string;
  description: string | null;
  price: number;
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
}

export interface RentalListingDetail extends RentalListing {
  price_history: PricePoint[];
  images: ListingImage[];
}

export interface PricePoint {
  price: number;
  captured_at: string;
}
