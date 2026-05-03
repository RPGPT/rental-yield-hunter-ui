import { Injectable, signal, computed } from '@angular/core';
import { FilterState } from '../models/filter.model';

@Injectable({ providedIn: 'root' })
export class FilterStateService {
  readonly priceMin = signal<number | null>(null);
  readonly priceMax = signal<number | null>(null);
  readonly areaMin = signal<number | null>(null);
  readonly areaMax = signal<number | null>(null);
  readonly typology = signal<string[]>([]);
  readonly city = signal<string[]>([]);
  readonly propertyType = signal<string[]>([]);
  readonly hasGarage = signal<boolean | null>(null);
  readonly isRented = signal<boolean | null>(null);
  readonly lifetimeRent = signal<boolean | null>(null);
  readonly isFavorite = signal<boolean | null>(null);
  readonly active = signal<boolean | null>(true);
  readonly sort = signal<string>('price');
  readonly order = signal<'asc' | 'desc'>('asc');
  readonly limit = signal<number>(50);
  readonly offset = signal<number>(0);

  readonly state = computed<FilterState>(() => ({
    price_min: this.priceMin(),
    price_max: this.priceMax(),
    area_min: this.areaMin(),
    area_max: this.areaMax(),
    typology: this.typology(),
    city: this.city(),
    property_type: this.propertyType(),
    has_garage: this.hasGarage(),
    is_rented: this.isRented(),
    lifetime_rent: this.lifetimeRent(),
    is_favorite: this.isFavorite(),
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
    this.typology.set([]);
    this.city.set([]);
    this.propertyType.set([]);
    this.hasGarage.set(null);
    this.isRented.set(null);
    this.lifetimeRent.set(null);
    this.isFavorite.set(null);
    this.active.set(true);
    this.sort.set('price');
    this.order.set('asc');
    this.limit.set(50);
    this.offset.set(0);
  }
}

