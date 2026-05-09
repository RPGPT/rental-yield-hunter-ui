export interface FilterOptions {
  cities: string[];
  typologies: string[];
  neighborhoods: Record<string, string[]>;
}

export interface FilterState {
  price_min: number | null;
  price_max: number | null;
  area_min: number | null;
  area_max: number | null;
  typology: string[];
  city: string[];
  neighborhood: string[];
  is_rented: boolean | null;
  lifetime_rent: boolean | null;
  is_favorite: boolean | null;
  is_new: boolean | null;
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
