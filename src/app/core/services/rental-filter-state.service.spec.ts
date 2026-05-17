import { describe, it, expect } from 'vitest';
import { RentalFilterStateService } from './rental-filter-state.service';

describe('RentalFilterStateService', () => {
  it('priceMin defaults to null', () => {
    expect(new RentalFilterStateService().priceMin()).toBeNull();
  });
  it('priceMax defaults to null', () => {
    expect(new RentalFilterStateService().priceMax()).toBeNull();
  });
  it('areaMin defaults to null', () => {
    expect(new RentalFilterStateService().areaMin()).toBeNull();
  });
  it('areaMax defaults to null', () => {
    expect(new RentalFilterStateService().areaMax()).toBeNull();
  });
  it('rentPricePerM2Min defaults to null', () => {
    expect(new RentalFilterStateService().rentPricePerM2Min()).toBeNull();
  });
  it('rentPricePerM2Max defaults to null', () => {
    expect(new RentalFilterStateService().rentPricePerM2Max()).toBeNull();
  });
  it('typology defaults to empty array', () => {
    expect(new RentalFilterStateService().typology()).toEqual([]);
  });
  it('city defaults to empty array', () => {
    expect(new RentalFilterStateService().city()).toEqual([]);
  });
  it('neighborhood defaults to empty array', () => {
    expect(new RentalFilterStateService().neighborhood()).toEqual([]);
  });
  it('isFavorite defaults to null', () => {
    expect(new RentalFilterStateService().isFavorite()).toBeNull();
  });
  it('isNew defaults to null', () => {
    expect(new RentalFilterStateService().isNew()).toBeNull();
  });
  it('priceChange defaults to null', () => {
    expect(new RentalFilterStateService().priceChange()).toBeNull();
  });
  it('active defaults to true', () => {
    expect(new RentalFilterStateService().active()).toBe(true);
  });
  it('sort defaults to price', () => {
    expect(new RentalFilterStateService().sort()).toBe('price');
  });
  it('order defaults to asc', () => {
    expect(new RentalFilterStateService().order()).toBe('asc');
  });
  it('limit defaults to 50', () => {
    expect(new RentalFilterStateService().limit()).toBe(50);
  });
  it('offset defaults to 0', () => {
    expect(new RentalFilterStateService().offset()).toBe(0);
  });

  it('state computed reflects all fields', () => {
    const svc = new RentalFilterStateService();
    svc.priceMin.set(100);
    svc.priceMax.set(500);
    svc.areaMin.set(40);
    svc.areaMax.set(120);
    svc.rentPricePerM2Min.set(10);
    svc.rentPricePerM2Max.set(20);
    svc.typology.set(['T2']);
    svc.city.set(['Porto']);
    svc.neighborhood.set(['Bonfim']);
    svc.isFavorite.set(true);
    svc.isNew.set(true);
    svc.priceChange.set('reduced');
    svc.active.set(false);
    svc.sort.set('area');
    svc.order.set('desc');
    svc.limit.set(25);
    svc.offset.set(10);
    const s = svc.state();
    expect(s.price_min).toBe(100);
    expect(s.price_max).toBe(500);
    expect(s.area_min).toBe(40);
    expect(s.area_max).toBe(120);
    expect(s.rent_price_per_m2_min).toBe(10);
    expect(s.rent_price_per_m2_max).toBe(20);
    expect(s.typology).toEqual(['T2']);
    expect(s.city).toEqual(['Porto']);
    expect(s.neighborhood).toEqual(['Bonfim']);
    expect(s.is_favorite).toBe(true);
    expect(s.is_new).toBe(true);
    expect(s.price_change).toBe('reduced');
    expect(s.active).toBe(false);
    expect(s.sort).toBe('area');
    expect(s.order).toBe('desc');
    expect(s.limit).toBe(25);
    expect(s.offset).toBe(10);
  });

  describe('reset()', () => {
    it('restores all fields to defaults', () => {
      const svc = new RentalFilterStateService();
      svc.priceMin.set(100);
      svc.priceMax.set(999);
      svc.areaMin.set(50);
      svc.areaMax.set(200);
      svc.rentPricePerM2Min.set(5);
      svc.rentPricePerM2Max.set(30);
      svc.typology.set(['T1']);
      svc.city.set(['Lisboa']);
      svc.neighborhood.set(['Bonfim']);
      svc.isFavorite.set(true);
      svc.isNew.set(true);
      svc.priceChange.set('increased');
      svc.active.set(false);
      svc.sort.set('city');
      svc.order.set('desc');
      svc.limit.set(10);
      svc.offset.set(20);
      svc.reset();
      expect(svc.priceMin()).toBeNull();
      expect(svc.priceMax()).toBeNull();
      expect(svc.areaMin()).toBeNull();
      expect(svc.areaMax()).toBeNull();
      expect(svc.rentPricePerM2Min()).toBeNull();
      expect(svc.rentPricePerM2Max()).toBeNull();
      expect(svc.typology()).toEqual([]);
      expect(svc.city()).toEqual([]);
      expect(svc.neighborhood()).toEqual([]);
      expect(svc.isFavorite()).toBeNull();
      expect(svc.isNew()).toBeNull();
      expect(svc.priceChange()).toBeNull();
      expect(svc.active()).toBe(true);
      expect(svc.sort()).toBe('price');
      expect(svc.order()).toBe('asc');
      expect(svc.limit()).toBe(50);
      expect(svc.offset()).toBe(0);
    });
  });

  describe('initFromParams()', () => {
    it('sets numeric fields from params', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({
        price_min: '200',
        price_max: '800',
        area_min: '40',
        area_max: '100',
        rent_price_per_m2_min: '8',
        rent_price_per_m2_max: '22',
      });
      expect(svc.priceMin()).toBe(200);
      expect(svc.priceMax()).toBe(800);
      expect(svc.areaMin()).toBe(40);
      expect(svc.areaMax()).toBe(100);
      expect(svc.rentPricePerM2Min()).toBe(8);
      expect(svc.rentPricePerM2Max()).toBe(22);
    });

    it('splits typology, city, and neighborhood from comma-separated params', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({
        typology: 'T1,T2',
        city: 'Porto,Lisboa',
        neighborhood: 'Bonfim,Alfama',
      });
      expect(svc.typology()).toEqual(['T1', 'T2']);
      expect(svc.city()).toEqual(['Porto', 'Lisboa']);
      expect(svc.neighborhood()).toEqual(['Bonfim', 'Alfama']);
    });

    it('sets isFavorite to true when is_favorite=true', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ is_favorite: 'true' });
      expect(svc.isFavorite()).toBe(true);
    });

    it('sets isFavorite to null when is_favorite is not "true"', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ is_favorite: 'false' });
      expect(svc.isFavorite()).toBeNull();
    });

    it('sets isNew to true when is_new=true', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ is_new: 'true' });
      expect(svc.isNew()).toBe(true);
    });

    it('sets isNew to null when is_new is not "true"', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ is_new: 'false' });
      expect(svc.isNew()).toBeNull();
    });

    it('sets priceChange from params', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ price_change: 'increased' });
      expect(svc.priceChange()).toBe('increased');
    });

    it('ignores invalid priceChange value', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ price_change: 'invalid' });
      expect(svc.priceChange()).toBeNull();
    });

    it('sets active to null when param is "all"', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ active: 'all' });
      expect(svc.active()).toBeNull();
    });

    it('sets active to false when param is "false"', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ active: 'false' });
      expect(svc.active()).toBe(false);
    });

    it('sets active to true for any other non-null value', () => {
      const svc = new RentalFilterStateService();
      svc.active.set(null);
      svc.initFromParams({ active: 'true' });
      expect(svc.active()).toBe(true);
    });

    it('sets sort and order from params', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ sort: 'area', order: 'desc' });
      expect(svc.sort()).toBe('area');
      expect(svc.order()).toBe('desc');
    });

    it('keeps order as asc when param is not "desc"', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ order: 'asc' });
      expect(svc.order()).toBe('asc');
    });

    it('clamps limit to max 100', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ limit: '200' });
      expect(svc.limit()).toBe(100);
    });

    it('clamps limit to min 1', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({ limit: '0' });
      expect(svc.limit()).toBe(1);
    });

    it('ignores missing params and keeps defaults', () => {
      const svc = new RentalFilterStateService();
      svc.initFromParams({});
      expect(svc.priceMin()).toBeNull();
      expect(svc.active()).toBe(true);
    });
  });

  describe('toQueryParams()', () => {
    it('returns empty-ish object for default state (only no non-default fields)', () => {
      const svc = new RentalFilterStateService();
      const p = svc.toQueryParams();
      expect(p.price_min).toBeUndefined();
      expect(p.sort).toBeUndefined();
      expect(p.order).toBeUndefined();
      expect(p.limit).toBeUndefined();
    });

    it('includes price_min and price_max when set', () => {
      const svc = new RentalFilterStateService();
      svc.priceMin.set(200);
      svc.priceMax.set(900);
      const p = svc.toQueryParams();
      expect(p.price_min).toBe('200');
      expect(p.price_max).toBe('900');
    });

    it('includes area_min and area_max when set', () => {
      const svc = new RentalFilterStateService();
      svc.areaMin.set(40);
      svc.areaMax.set(100);
      const p = svc.toQueryParams();
      expect(p.area_min).toBe('40');
      expect(p.area_max).toBe('100');
    });

    it('includes rent_price_per_m2_min and rent_price_per_m2_max when set', () => {
      const svc = new RentalFilterStateService();
      svc.rentPricePerM2Min.set(8);
      svc.rentPricePerM2Max.set(22);
      const p = svc.toQueryParams();
      expect(p.rent_price_per_m2_min).toBe('8');
      expect(p.rent_price_per_m2_max).toBe('22');
    });

    it('includes typology, city, neighborhood as comma-separated strings', () => {
      const svc = new RentalFilterStateService();
      svc.typology.set(['T1', 'T2']);
      svc.city.set(['Porto']);
      svc.neighborhood.set(['Bonfim']);
      const p = svc.toQueryParams();
      expect(p.typology).toBe('T1,T2');
      expect(p.city).toBe('Porto');
      expect(p.neighborhood).toBe('Bonfim');
    });

    it('includes is_favorite when set', () => {
      const svc = new RentalFilterStateService();
      svc.isFavorite.set(true);
      expect(svc.toQueryParams().is_favorite).toBe('true');
    });

    it('omits is_favorite when null', () => {
      const svc = new RentalFilterStateService();
      expect(svc.toQueryParams().is_favorite).toBeUndefined();
    });

    it('includes is_new when set', () => {
      const svc = new RentalFilterStateService();
      svc.isNew.set(true);
      expect(svc.toQueryParams().is_new).toBe('true');
    });

    it('omits is_new when null', () => {
      const svc = new RentalFilterStateService();
      expect(svc.toQueryParams().is_new).toBeUndefined();
    });

    it('includes price_change when set', () => {
      const svc = new RentalFilterStateService();
      svc.priceChange.set('reduced');
      expect(svc.toQueryParams().price_change).toBe('reduced');
    });

    it('omits price_change when null', () => {
      const svc = new RentalFilterStateService();
      expect(svc.toQueryParams().price_change).toBeUndefined();
    });

    it('includes active=all when null', () => {
      const svc = new RentalFilterStateService();
      svc.active.set(null);
      expect(svc.toQueryParams().active).toBe('all');
    });

    it('includes active=false when false', () => {
      const svc = new RentalFilterStateService();
      svc.active.set(false);
      expect(svc.toQueryParams().active).toBe('false');
    });

    it('omits active when true (default)', () => {
      const svc = new RentalFilterStateService();
      expect(svc.toQueryParams().active).toBeUndefined();
    });

    it('includes sort when non-default', () => {
      const svc = new RentalFilterStateService();
      svc.sort.set('area');
      expect(svc.toQueryParams().sort).toBe('area');
    });

    it('omits sort when default "price"', () => {
      const svc = new RentalFilterStateService();
      expect(svc.toQueryParams().sort).toBeUndefined();
    });

    it('includes order when desc', () => {
      const svc = new RentalFilterStateService();
      svc.order.set('desc');
      expect(svc.toQueryParams().order).toBe('desc');
    });

    it('omits order when asc (default)', () => {
      const svc = new RentalFilterStateService();
      expect(svc.toQueryParams().order).toBeUndefined();
    });

    it('includes limit when non-default', () => {
      const svc = new RentalFilterStateService();
      svc.limit.set(25);
      expect(svc.toQueryParams().limit).toBe('25');
    });

    it('omits limit when 50 (default)', () => {
      const svc = new RentalFilterStateService();
      expect(svc.toQueryParams().limit).toBeUndefined();
    });
  });
});
