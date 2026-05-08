import { describe, it, expect } from 'vitest';
import { FilterStateService } from './filter-state.service';

describe('FilterStateService', () => {
  it('priceMin defaults to null', () => {
    expect(new FilterStateService().priceMin()).toBeNull();
  });

  it('priceMax defaults to null', () => {
    expect(new FilterStateService().priceMax()).toBeNull();
  });

  it('areaMin defaults to null', () => {
    expect(new FilterStateService().areaMin()).toBeNull();
  });

  it('areaMax defaults to null', () => {
    expect(new FilterStateService().areaMax()).toBeNull();
  });

  it('typology defaults to empty array', () => {
    expect(new FilterStateService().typology()).toEqual([]);
  });

  it('city defaults to empty array', () => {
    expect(new FilterStateService().city()).toEqual([]);
  });

  it('propertyType defaults to empty array', () => {
    expect(new FilterStateService().propertyType()).toEqual([]);
  });

  it('hasGarage defaults to null', () => {
    expect(new FilterStateService().hasGarage()).toBeNull();
  });

  it('isRented defaults to null', () => {
    expect(new FilterStateService().isRented()).toBeNull();
  });

  it('lifetimeRent defaults to null', () => {
    expect(new FilterStateService().lifetimeRent()).toBeNull();
  });

  it('isFavorite defaults to null', () => {
    expect(new FilterStateService().isFavorite()).toBeNull();
  });

  it('isNew defaults to null', () => {
    expect(new FilterStateService().isNew()).toBeNull();
  });

  it('active defaults to true', () => {
    expect(new FilterStateService().active()).toBe(true);
  });

  it('sort defaults to price', () => {
    expect(new FilterStateService().sort()).toBe('price');
  });

  it('order defaults to asc', () => {
    expect(new FilterStateService().order()).toBe('asc');
  });

  it('limit defaults to 50', () => {
    expect(new FilterStateService().limit()).toBe(50);
  });

  it('offset defaults to 0', () => {
    expect(new FilterStateService().offset()).toBe(0);
  });

  it('state computed reflects priceMin', () => {
    const svc = new FilterStateService();
    svc.priceMin.set(500);
    expect(svc.state().price_min).toBe(500);
  });

  it('state computed reflects priceMax', () => {
    const svc = new FilterStateService();
    svc.priceMax.set(1500);
    expect(svc.state().price_max).toBe(1500);
  });

  it('state computed reflects areaMin', () => {
    const svc = new FilterStateService();
    svc.areaMin.set(60);
    expect(svc.state().area_min).toBe(60);
  });

  it('state computed reflects areaMax', () => {
    const svc = new FilterStateService();
    svc.areaMax.set(120);
    expect(svc.state().area_max).toBe(120);
  });

  it('state computed reflects typology', () => {
    const svc = new FilterStateService();
    svc.typology.set(['T2', 'T3']);
    expect(svc.state().typology).toEqual(['T2', 'T3']);
  });

  it('state computed reflects city', () => {
    const svc = new FilterStateService();
    svc.city.set(['Porto']);
    expect(svc.state().city).toEqual(['Porto']);
  });

  it('state computed reflects propertyType', () => {
    const svc = new FilterStateService();
    svc.propertyType.set(['Apartment']);
    expect(svc.state().property_type).toEqual(['Apartment']);
  });

  it('state computed reflects hasGarage', () => {
    const svc = new FilterStateService();
    svc.hasGarage.set(true);
    expect(svc.state().has_garage).toBe(true);
  });

  it('state computed reflects isRented', () => {
    const svc = new FilterStateService();
    svc.isRented.set(false);
    expect(svc.state().is_rented).toBe(false);
  });

  it('state computed reflects lifetimeRent', () => {
    const svc = new FilterStateService();
    svc.lifetimeRent.set(true);
    expect(svc.state().lifetime_rent).toBe(true);
  });

  it('state computed reflects isFavorite', () => {
    const svc = new FilterStateService();
    svc.isFavorite.set(true);
    expect(svc.state().is_favorite).toBe(true);
  });

  it('state computed reflects isNew', () => {
    const svc = new FilterStateService();
    svc.isNew.set(true);
    expect(svc.state().is_new).toBe(true);
  });

  it('state computed reflects active', () => {
    const svc = new FilterStateService();
    svc.active.set(false);
    expect(svc.state().active).toBe(false);
  });

  it('state computed reflects sort', () => {
    const svc = new FilterStateService();
    svc.sort.set('area');
    expect(svc.state().sort).toBe('area');
  });

  it('state computed reflects order', () => {
    const svc = new FilterStateService();
    svc.order.set('desc');
    expect(svc.state().order).toBe('desc');
  });

  it('state computed reflects limit', () => {
    const svc = new FilterStateService();
    svc.limit.set(20);
    expect(svc.state().limit).toBe(20);
  });

  it('state computed reflects offset', () => {
    const svc = new FilterStateService();
    svc.offset.set(40);
    expect(svc.state().offset).toBe(40);
  });

  it('reset() restores all fields to defaults', () => {
    const svc = new FilterStateService();
    svc.priceMin.set(100);
    svc.priceMax.set(999);
    svc.areaMin.set(50);
    svc.areaMax.set(200);
    svc.typology.set(['T1']);
    svc.city.set(['Lisboa']);
    svc.propertyType.set(['House']);
    svc.hasGarage.set(true);
    svc.isRented.set(true);
    svc.lifetimeRent.set(true);
    svc.isFavorite.set(true);
    svc.isNew.set(true);
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
    expect(svc.typology()).toEqual([]);
    expect(svc.city()).toEqual([]);
    expect(svc.propertyType()).toEqual([]);
    expect(svc.hasGarage()).toBeNull();
    expect(svc.isRented()).toBeNull();
    expect(svc.lifetimeRent()).toBeNull();
    expect(svc.isFavorite()).toBeNull();
    expect(svc.isNew()).toBeNull();
    expect(svc.active()).toBe(true);
    expect(svc.sort()).toBe('price');
    expect(svc.order()).toBe('asc');
    expect(svc.limit()).toBe(50);
    expect(svc.offset()).toBe(0);
  });

  describe('initFromParams', () => {
    it('sets priceMin from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ price_min: '300' });
      expect(svc.priceMin()).toBe(300);
    });

    it('sets priceMax from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ price_max: '1500' });
      expect(svc.priceMax()).toBe(1500);
    });

    it('sets areaMin from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ area_min: '60' });
      expect(svc.areaMin()).toBe(60);
    });

    it('sets areaMax from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ area_max: '150' });
      expect(svc.areaMax()).toBe(150);
    });

    it('splits typology from comma-separated param', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ typology: 'T2,T3' });
      expect(svc.typology()).toEqual(['T2', 'T3']);
    });

    it('splits city from comma-separated param', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ city: 'Porto,Lisboa' });
      expect(svc.city()).toEqual(['Porto', 'Lisboa']);
    });

    it('splits property_type from comma-separated param', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ property_type: 'Apartment' });
      expect(svc.propertyType()).toEqual(['Apartment']);
    });

    it('sets hasGarage true from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ has_garage: 'true' });
      expect(svc.hasGarage()).toBe(true);
    });

    it('sets hasGarage false from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ has_garage: 'false' });
      expect(svc.hasGarage()).toBe(false);
    });

    it('sets isRented true from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ is_rented: 'true' });
      expect(svc.isRented()).toBe(true);
    });

    it('sets lifetimeRent false from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ lifetime_rent: 'false' });
      expect(svc.lifetimeRent()).toBe(false);
    });

    it('sets isFavorite true from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ is_favorite: 'true' });
      expect(svc.isFavorite()).toBe(true);
    });

    it('sets isNew true from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ is_new: 'true' });
      expect(svc.isNew()).toBe(true);
    });

    it('keeps isNew null when param is not "true"', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ is_new: 'false' });
      expect(svc.isNew()).toBeNull();
    });

    it('sets active to null when param is all', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ active: 'all' });
      expect(svc.active()).toBeNull();
    });

    it('sets active to false when param is false', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ active: 'false' });
      expect(svc.active()).toBe(false);
    });

    it('sets sort from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ sort: 'area' });
      expect(svc.sort()).toBe('area');
    });

    it('sets order desc from params', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ order: 'desc' });
      expect(svc.order()).toBe('desc');
    });

    it('sets limit from params clamped to max 100', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ limit: '200' });
      expect(svc.limit()).toBe(100);
    });

    it('sets limit from params clamped to min 1', () => {
      const svc = new FilterStateService();
      svc.initFromParams({ limit: '0' });
      expect(svc.limit()).toBe(1);
    });

    it('ignores missing params and keeps defaults', () => {
      const svc = new FilterStateService();
      svc.initFromParams({});
      expect(svc.priceMin()).toBeNull();
      expect(svc.active()).toBe(true);
    });
  });

  describe('toQueryParams', () => {
    it('returns empty object for all-default state', () => {
      const svc = new FilterStateService();
      expect(svc.toQueryParams()).toEqual({});
    });

    it('includes price_min when set', () => {
      const svc = new FilterStateService();
      svc.priceMin.set(500);
      expect(svc.toQueryParams().price_min).toBe('500');
    });

    it('includes price_max when set', () => {
      const svc = new FilterStateService();
      svc.priceMax.set(2000);
      expect(svc.toQueryParams().price_max).toBe('2000');
    });

    it('includes area_min when set', () => {
      const svc = new FilterStateService();
      svc.areaMin.set(60);
      expect(svc.toQueryParams().area_min).toBe('60');
    });

    it('includes area_max when set', () => {
      const svc = new FilterStateService();
      svc.areaMax.set(120);
      expect(svc.toQueryParams().area_max).toBe('120');
    });

    it('joins typology as comma-separated string', () => {
      const svc = new FilterStateService();
      svc.typology.set(['T2', 'T3']);
      expect(svc.toQueryParams().typology).toBe('T2,T3');
    });

    it('joins city as comma-separated string', () => {
      const svc = new FilterStateService();
      svc.city.set(['Porto', 'Lisboa']);
      expect(svc.toQueryParams().city).toBe('Porto,Lisboa');
    });

    it('includes has_garage when set', () => {
      const svc = new FilterStateService();
      svc.hasGarage.set(true);
      expect(svc.toQueryParams().has_garage).toBe('true');
    });

    it('includes is_rented when set', () => {
      const svc = new FilterStateService();
      svc.isRented.set(false);
      expect(svc.toQueryParams().is_rented).toBe('false');
    });

    it('includes is_favorite when set to true', () => {
      const svc = new FilterStateService();
      svc.isFavorite.set(true);
      expect(svc.toQueryParams().is_favorite).toBe('true');
    });

    it('omits is_favorite when null', () => {
      const svc = new FilterStateService();
      expect(svc.toQueryParams().is_favorite).toBeUndefined();
    });

    it('includes is_new when set to true', () => {
      const svc = new FilterStateService();
      svc.isNew.set(true);
      expect(svc.toQueryParams().is_new).toBe('true');
    });

    it('omits is_new when null', () => {
      const svc = new FilterStateService();
      expect(svc.toQueryParams().is_new).toBeUndefined();
    });

    it('includes active=all when null', () => {
      const svc = new FilterStateService();
      svc.active.set(null);
      expect(svc.toQueryParams().active).toBe('all');
    });

    it('includes active=false when false', () => {
      const svc = new FilterStateService();
      svc.active.set(false);
      expect(svc.toQueryParams().active).toBe('false');
    });

    it('omits active when true (default)', () => {
      const svc = new FilterStateService();
      expect(svc.toQueryParams().active).toBeUndefined();
    });

    it('includes sort when non-default', () => {
      const svc = new FilterStateService();
      svc.sort.set('area');
      expect(svc.toQueryParams().sort).toBe('area');
    });

    it('omits sort when default price', () => {
      const svc = new FilterStateService();
      expect(svc.toQueryParams().sort).toBeUndefined();
    });

    it('includes order when desc', () => {
      const svc = new FilterStateService();
      svc.order.set('desc');
      expect(svc.toQueryParams().order).toBe('desc');
    });

    it('omits order when asc (default)', () => {
      const svc = new FilterStateService();
      expect(svc.toQueryParams().order).toBeUndefined();
    });

    it('includes limit when non-default', () => {
      const svc = new FilterStateService();
      svc.limit.set(25);
      expect(svc.toQueryParams().limit).toBe('25');
    });

    it('omits limit when 50 (default)', () => {
      const svc = new FilterStateService();
      expect(svc.toQueryParams().limit).toBeUndefined();
    });
  });
});
