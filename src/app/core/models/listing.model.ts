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
  city: string | null;
  property_type: string | null;
  typology: string | null;
  floor: string | null;
  has_garage: boolean;
  is_rented: boolean;
  lifetime_rent: boolean;
  is_favorite: boolean;
  active: boolean;
  inactive_since: string | null;
  first_seen: string;
  last_seen: string;
}

export interface ListingDetail extends Listing {
  price_history: PricePoint[];
}

export interface PricePoint {
  price: number;
  captured_at: string;
}

