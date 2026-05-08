import { describe, it, expect } from 'vitest';
import { buildQueryParams } from './query-params.util';
import type { FilterState } from '../../core/models/filter.model';

const DEFAULT: FilterState = {
  price_min: null,
  price_max: null,
  area_min: null,
  area_max: null,
  typology: [],
  city: [],
  property_type: [],
  has_garage: null,
  is_rented: null,
  lifetime_rent: null,
  is_favorite: null,
  is_new: null,
  active: null,
  sort: 'price',
  order: 'asc',
  limit: 50,
  offset: 0,
};

describe('buildQueryParams', () => {
  it('includes limit', () => {
    expect(buildQueryParams({ ...DEFAULT }).limit).toBe('50');
  });
  it('includes offset', () => {
    expect(buildQueryParams({ ...DEFAULT }).offset).toBe('0');
  });
  it('includes sort', () => {
    expect(buildQueryParams({ ...DEFAULT, sort: 'area' }).sort).toBe('area');
  });
  it('includes order', () => {
    expect(buildQueryParams({ ...DEFAULT, order: 'desc' }).order).toBe('desc');
  });
  it('omits null price_min', () => {
    expect(buildQueryParams({ ...DEFAULT }).price_min).toBeUndefined();
  });
  it('includes price_min', () => {
    expect(buildQueryParams({ ...DEFAULT, price_min: 500 }).price_min).toBe('500');
  });
  it('omits null price_max', () => {
    expect(buildQueryParams({ ...DEFAULT }).price_max).toBeUndefined();
  });
  it('includes price_max', () => {
    expect(buildQueryParams({ ...DEFAULT, price_max: 2000 }).price_max).toBe('2000');
  });
  it('omits null area_min', () => {
    expect(buildQueryParams({ ...DEFAULT }).area_min).toBeUndefined();
  });
  it('includes area_min', () => {
    expect(buildQueryParams({ ...DEFAULT, area_min: 80 }).area_min).toBe('80');
  });
  it('omits null area_max', () => {
    expect(buildQueryParams({ ...DEFAULT }).area_max).toBeUndefined();
  });
  it('includes area_max', () => {
    expect(buildQueryParams({ ...DEFAULT, area_max: 200 }).area_max).toBe('200');
  });
  it('omits empty typology', () => {
    expect(buildQueryParams({ ...DEFAULT }).typology).toBeUndefined();
  });
  it('joins typology', () => {
    expect(buildQueryParams({ ...DEFAULT, typology: ['T2', 'T3'] }).typology).toBe('T2,T3');
  });
  it('omits empty city', () => {
    expect(buildQueryParams({ ...DEFAULT }).city).toBeUndefined();
  });
  it('joins city', () => {
    expect(buildQueryParams({ ...DEFAULT, city: ['Porto', 'Lisboa'] }).city).toBe('Porto,Lisboa');
  });
  it('omits empty property_type', () => {
    expect(buildQueryParams({ ...DEFAULT }).property_type).toBeUndefined();
  });
  it('includes property_type', () => {
    expect(buildQueryParams({ ...DEFAULT, property_type: ['Apartment'] }).property_type).toBe(
      'Apartment',
    );
  });
  it('omits null has_garage', () => {
    expect(buildQueryParams({ ...DEFAULT }).has_garage).toBeUndefined();
  });
  it('includes has_garage true', () => {
    expect(buildQueryParams({ ...DEFAULT, has_garage: true }).has_garage).toBe('true');
  });
  it('includes has_garage false', () => {
    expect(buildQueryParams({ ...DEFAULT, has_garage: false }).has_garage).toBe('false');
  });
  it('omits null is_rented', () => {
    expect(buildQueryParams({ ...DEFAULT }).is_rented).toBeUndefined();
  });
  it('includes is_rented true', () => {
    expect(buildQueryParams({ ...DEFAULT, is_rented: true }).is_rented).toBe('true');
  });
  it('includes is_rented false', () => {
    expect(buildQueryParams({ ...DEFAULT, is_rented: false }).is_rented).toBe('false');
  });
  it('includes lifetime_rent true', () => {
    expect(buildQueryParams({ ...DEFAULT, lifetime_rent: true }).lifetime_rent).toBe('true');
  });
  it('omits null lifetime_rent', () => {
    expect(buildQueryParams({ ...DEFAULT }).lifetime_rent).toBeUndefined();
  });
  it('includes is_favorite true', () => {
    expect(buildQueryParams({ ...DEFAULT, is_favorite: true }).is_favorite).toBe('true');
  });
  it('omits null is_favorite', () => {
    expect(buildQueryParams({ ...DEFAULT }).is_favorite).toBeUndefined();
  });
  it('includes is_new true', () => {
    expect(buildQueryParams({ ...DEFAULT, is_new: true }).is_new).toBe('true');
  });
  it('omits null is_new', () => {
    expect(buildQueryParams({ ...DEFAULT }).is_new).toBeUndefined();
  });
  it('includes active true', () => {
    expect(buildQueryParams({ ...DEFAULT, active: true }).active).toBe('true');
  });
  it('includes active false', () => {
    expect(buildQueryParams({ ...DEFAULT, active: false }).active).toBe('false');
  });
  it('omits null active', () => {
    expect(buildQueryParams({ ...DEFAULT }).active).toBeUndefined();
  });
  it('custom limit', () => {
    expect(buildQueryParams({ ...DEFAULT, limit: 20 }).limit).toBe('20');
  });
  it('custom offset', () => {
    expect(buildQueryParams({ ...DEFAULT, offset: 40 }).offset).toBe('40');
  });
});
