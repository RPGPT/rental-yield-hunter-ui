import { Injectable, signal, computed } from '@angular/core';
import type { Params } from '@angular/router';
import { RentalFilterState } from '../models/filter.model';
import {
  clampPageLimit,
  parseActiveParam,
  parseCsvParam,
  parseNumberParam,
} from './filter-params.util';

export interface RentalFilterQueryParams {
  price_min?: string;
  price_max?: string;
  area_min?: string;
  area_max?: string;
  rent_price_per_m2_min?: string;
  rent_price_per_m2_max?: string;
  typology?: string;
  city?: string;
  neighborhood?: string;
  is_favorite?: string;
  is_new?: string;
  price_change?: string;
  active?: string;
  sort?: string;
  order?: string;
  limit?: string;
}

@Injectable({ providedIn: 'root' })
export class RentalFilterStateService {
  readonly priceMin = signal<number | null>(null);
  readonly priceMax = signal<number | null>(null);
  readonly areaMin = signal<number | null>(null);
  readonly areaMax = signal<number | null>(null);
  readonly rentPricePerM2Min = signal<number | null>(null);
  readonly rentPricePerM2Max = signal<number | null>(null);
  readonly typology = signal<string[]>([]);
  readonly city = signal<string[]>([]);
  readonly neighborhood = signal<string[]>([]);
  readonly isFavorite = signal<boolean | null>(null);
  readonly isNew = signal<boolean | null>(null);
  readonly priceChange = signal<'reduced' | 'increased' | null>(null);
  readonly active = signal<boolean | null>(true);
  readonly sort = signal<string>('price');
  readonly order = signal<'asc' | 'desc'>('asc');
  readonly limit = signal<number>(50);
  readonly offset = signal<number>(0);

  readonly state = computed<RentalFilterState>(() => ({
    price_min: this.priceMin(),
    price_max: this.priceMax(),
    area_min: this.areaMin(),
    area_max: this.areaMax(),
    rent_price_per_m2_min: this.rentPricePerM2Min(),
    rent_price_per_m2_max: this.rentPricePerM2Max(),
    typology: this.typology(),
    city: this.city(),
    neighborhood: this.neighborhood(),
    is_favorite: this.isFavorite(),
    is_new: this.isNew(),
    price_change: this.priceChange(),
    active: this.active(),
    sort: this.sort(),
    order: this.order(),
    limit: this.limit(),
    offset: this.offset(),
  }));

  reset(): void {
    this.priceMin.set(null);
    this.priceMax.set(null);
    this.areaMin.set(null);
    this.areaMax.set(null);
    this.rentPricePerM2Min.set(null);
    this.rentPricePerM2Max.set(null);
    this.typology.set([]);
    this.city.set([]);
    this.neighborhood.set([]);
    this.isFavorite.set(null);
    this.isNew.set(null);
    this.priceChange.set(null);
    this.active.set(true);
    this.sort.set('price');
    this.order.set('asc');
    this.limit.set(50);
    this.offset.set(0);
  }

  initFromParams(params: Params): void {
    if (params['price_min']) this.priceMin.set(parseNumberParam(params['price_min']));
    if (params['price_max']) this.priceMax.set(parseNumberParam(params['price_max']));
    if (params['area_min']) this.areaMin.set(parseNumberParam(params['area_min']));
    if (params['area_max']) this.areaMax.set(parseNumberParam(params['area_max']));
    if (params['rent_price_per_m2_min']) {
      this.rentPricePerM2Min.set(parseNumberParam(params['rent_price_per_m2_min']));
    }
    if (params['rent_price_per_m2_max']) {
      this.rentPricePerM2Max.set(parseNumberParam(params['rent_price_per_m2_max']));
    }
    if (params['typology']) this.typology.set(parseCsvParam(params['typology']));
    if (params['city']) this.city.set(parseCsvParam(params['city']));
    if (params['neighborhood']) this.neighborhood.set(parseCsvParam(params['neighborhood']));
    if (params['is_favorite'] != null) {
      this.isFavorite.set(params['is_favorite'] === 'true' ? true : null);
    }
    if (params['is_new'] != null) this.isNew.set(params['is_new'] === 'true' ? true : null);
    if (params['price_change'] === 'reduced' || params['price_change'] === 'increased') {
      this.priceChange.set(params['price_change']);
    }
    if (params['active'] != null) this.active.set(parseActiveParam(params['active']));
    if (params['sort']) this.sort.set(params['sort']);
    if (params['order'] === 'desc') this.order.set('desc');
    if (params['limit']) this.limit.set(clampPageLimit(params['limit']));
  }

  toQueryParams(): RentalFilterQueryParams {
    const s = this.state();
    const p: RentalFilterQueryParams = {};
    if (s.price_min != null) p.price_min = String(s.price_min);
    if (s.price_max != null) p.price_max = String(s.price_max);
    if (s.area_min != null) p.area_min = String(s.area_min);
    if (s.area_max != null) p.area_max = String(s.area_max);
    if (s.rent_price_per_m2_min != null) p.rent_price_per_m2_min = String(s.rent_price_per_m2_min);
    if (s.rent_price_per_m2_max != null) p.rent_price_per_m2_max = String(s.rent_price_per_m2_max);
    if (s.typology.length) p.typology = s.typology.join(',');
    if (s.city.length) p.city = s.city.join(',');
    if (s.neighborhood.length) p.neighborhood = s.neighborhood.join(',');
    if (s.is_favorite != null) p.is_favorite = String(s.is_favorite);
    if (s.is_new != null) p.is_new = String(s.is_new);
    if (s.price_change != null) p.price_change = s.price_change;
    if (s.active !== true) p.active = s.active === null ? 'all' : 'false';
    if (s.sort !== 'price') p.sort = s.sort;
    if (s.order !== 'asc') p.order = s.order;
    if (s.limit !== 50) p.limit = String(s.limit);
    return p;
  }
}
