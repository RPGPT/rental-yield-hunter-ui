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
  neighborhood: [],
  is_rented: null,
  lifetime_rent: null,
  is_favorite: null,
  is_new: null,
  price_change: null,
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
  it('omits empty neighborhood', () => {
    expect(buildQueryParams({ ...DEFAULT }).neighborhood).toBeUndefined();
  });
  it('includes neighborhood', () => {
    expect(buildQueryParams({ ...DEFAULT, neighborhood: ['Bonfim'] }).neighborhood).toBe('Bonfim');
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
  it('omits null price_change', () => {
    expect(buildQueryParams({ ...DEFAULT }).price_change).toBeUndefined();
  });
  it('includes price_change reduced', () => {
    expect(buildQueryParams({ ...DEFAULT, price_change: 'reduced' }).price_change).toBe('reduced');
  });
  it('includes price_change increased', () => {
    expect(buildQueryParams({ ...DEFAULT, price_change: 'increased' }).price_change).toBe(
      'increased',
    );
  });
  it('includes rental_yield_min when set', () => {
    expect(buildQueryParams({ ...DEFAULT, rental_yield_min: 0.05 }).rental_yield_min).toBe('0.05');
  });
  it('omits rental_yield_min when null', () => {
    expect(buildQueryParams({ ...DEFAULT }).rental_yield_min).toBeUndefined();
  });
  it('includes is_hidden when set to false', () => {
    expect(buildQueryParams({ ...DEFAULT, is_hidden: false }).is_hidden).toBe('false');
  });
  it('omits is_hidden when null (default)', () => {
    expect(buildQueryParams({ ...DEFAULT, is_hidden: null }).is_hidden).toBeUndefined();
  });
});

import { buildRentalQueryParams } from './query-params.util';
import type { RentalFilterState } from '../../core/models/filter.model';

const RENTAL_DEFAULT: RentalFilterState = {
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
  active: true,
  sort: 'price',
  order: 'asc',
  limit: 50,
  offset: 0,
};

describe('buildRentalQueryParams', () => {
  it('includes limit and offset', () => {
    const p = buildRentalQueryParams({ ...RENTAL_DEFAULT });
    expect(p.limit).toBe('50');
    expect(p.offset).toBe('0');
  });
  it('includes price_min and price_max when set', () => {
    const p = buildRentalQueryParams({ ...RENTAL_DEFAULT, price_min: 500, price_max: 2000 });
    expect(p.price_min).toBe('500');
    expect(p.price_max).toBe('2000');
  });
  it('includes area_min and area_max when set', () => {
    const p = buildRentalQueryParams({ ...RENTAL_DEFAULT, area_min: 50, area_max: 120 });
    expect(p.area_min).toBe('50');
    expect(p.area_max).toBe('120');
  });
  it('includes rent_price_per_m2_min and max when set', () => {
    const p = buildRentalQueryParams({
      ...RENTAL_DEFAULT,
      rent_price_per_m2_min: 5,
      rent_price_per_m2_max: 15,
    });
    expect(p.rent_price_per_m2_min).toBe('5');
    expect(p.rent_price_per_m2_max).toBe('15');
  });
  it('omits null rent_price_per_m2 fields', () => {
    const p = buildRentalQueryParams({ ...RENTAL_DEFAULT });
    expect(p.rent_price_per_m2_min).toBeUndefined();
    expect(p.rent_price_per_m2_max).toBeUndefined();
  });
  it('joins typology', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, typology: ['T1', 'T2'] }).typology).toBe(
      'T1,T2',
    );
  });
  it('joins city', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, city: ['Porto'] }).city).toBe('Porto');
  });
  it('joins neighborhood', () => {
    expect(
      buildRentalQueryParams({ ...RENTAL_DEFAULT, neighborhood: ['Bonfim'] }).neighborhood,
    ).toBe('Bonfim');
  });
  it('includes is_favorite when set', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, is_favorite: true }).is_favorite).toBe(
      'true',
    );
  });
  it('omits is_favorite when null', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT }).is_favorite).toBeUndefined();
  });
  it('includes is_new when set', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, is_new: true }).is_new).toBe('true');
  });
  it('omits is_new when null', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT }).is_new).toBeUndefined();
  });
  it('includes price_change', () => {
    expect(
      buildRentalQueryParams({ ...RENTAL_DEFAULT, price_change: 'reduced' }).price_change,
    ).toBe('reduced');
  });
  it('includes active=all when null', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, active: null }).active).toBeUndefined();
  });
  it('includes active=false when false', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, active: false }).active).toBe('false');
  });
  it('omits active when true (default)', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, active: true }).active).toBe('true');
  });
  it('includes sort when non-default', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, sort: 'area' }).sort).toBe('area');
  });
  it('includes order when desc', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, order: 'desc' }).order).toBe('desc');
  });
  it('includes limit when non-default', () => {
    expect(buildRentalQueryParams({ ...RENTAL_DEFAULT, limit: 25 }).limit).toBe('25');
  });
});
