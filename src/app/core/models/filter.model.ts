export interface FilterOptions {
  cities: string[];
  typologies: string[];
  property_types: string[];
}

export interface FilterState {
  price_min: number | null;
  price_max: number | null;
  area_min: number | null;
  area_max: number | null;
  typology: string[];
  city: string[];
  property_type: string[];
  has_garage: boolean | null;
  is_rented: boolean | null;
  lifetime_rent: boolean | null;
  is_favorite: boolean | null;
  active: boolean | null;
  sort: string;
  order: 'asc' | 'desc';
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

