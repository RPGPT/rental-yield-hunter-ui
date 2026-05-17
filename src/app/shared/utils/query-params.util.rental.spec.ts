import { describe, it, expect } from 'vitest';
import { buildRentalQueryParams } from './query-params.util';
import type { RentalFilterState } from '../../core/models/filter.model';

const DEFAULT: RentalFilterState = {
  price_min: null,
  price_max: null,
  area_min: null,
  area_max: null,
  rent_price_per_m2_min: null,
  rent_price_per_m2_max: null,
  typology: [],
  city: [],
  neighborhood: [],
  is_favorite: null,
  is_new: null,
  price_change: null,
  active: null,
  sort: 'price',
  order: 'asc',
  limit: 50,
  offset: 0,
};

describe('buildRentalQueryParams', () => {
  it('includes limit', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).limit).toBe('50');
  });
  it('includes offset', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).offset).toBe('0');
  });
  it('includes sort', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, sort: 'area' }).sort).toBe('area');
  });
  it('includes order', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, order: 'desc' }).order).toBe('desc');
  });
  it('omits null price_min', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).price_min).toBeUndefined();
  });
  it('includes price_min', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, price_min: 500 }).price_min).toBe('500');
  });
  it('includes price_max', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, price_max: 2000 }).price_max).toBe('2000');
  });
  it('includes area_min', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, area_min: 40 }).area_min).toBe('40');
  });
  it('includes area_max', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, area_max: 150 }).area_max).toBe('150');
  });
  it('includes rent_price_per_m2_min', () => {
    expect(
      buildRentalQueryParams({ ...DEFAULT, rent_price_per_m2_min: 8 }).rent_price_per_m2_min,
    ).toBe('8');
  });
  it('omits null rent_price_per_m2_min', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).rent_price_per_m2_min).toBeUndefined();
  });
  it('includes rent_price_per_m2_max', () => {
    expect(
      buildRentalQueryParams({ ...DEFAULT, rent_price_per_m2_max: 25 }).rent_price_per_m2_max,
    ).toBe('25');
  });
  it('omits null rent_price_per_m2_max', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).rent_price_per_m2_max).toBeUndefined();
  });
  it('joins typology', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, typology: ['T1', 'T2'] }).typology).toBe('T1,T2');
  });
  it('omits empty typology', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).typology).toBeUndefined();
  });
  it('joins city', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, city: ['Porto'] }).city).toBe('Porto');
  });
  it('omits empty city', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).city).toBeUndefined();
  });
  it('joins neighborhood', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, neighborhood: ['Bonfim'] }).neighborhood).toBe(
      'Bonfim',
    );
  });
  it('omits empty neighborhood', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).neighborhood).toBeUndefined();
  });
  it('includes is_favorite', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, is_favorite: true }).is_favorite).toBe('true');
  });
  it('omits null is_favorite', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).is_favorite).toBeUndefined();
  });
  it('includes is_new', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, is_new: true }).is_new).toBe('true');
  });
  it('omits null is_new', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).is_new).toBeUndefined();
  });
  it('includes price_change', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, price_change: 'reduced' }).price_change).toBe(
      'reduced',
    );
  });
  it('omits null price_change', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).price_change).toBeUndefined();
  });
  it('includes active when set', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, active: true }).active).toBe('true');
  });
  it('omits null active', () => {
    expect(buildRentalQueryParams({ ...DEFAULT }).active).toBeUndefined();
  });
  it('custom limit', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, limit: 20 }).limit).toBe('20');
  });
  it('custom offset', () => {
    expect(buildRentalQueryParams({ ...DEFAULT, offset: 40 }).offset).toBe('40');
  });
});
