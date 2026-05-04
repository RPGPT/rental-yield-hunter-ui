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
    expect(svc.active()).toBe(true);
    expect(svc.sort()).toBe('price');
    expect(svc.order()).toBe('asc');
    expect(svc.limit()).toBe(50);
    expect(svc.offset()).toBe(0);
  });
});
