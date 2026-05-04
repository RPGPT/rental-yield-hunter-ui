import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { MockComponent } from 'ng-mocks';
import { DetailComponent } from './detail.component';
import { PriceChartComponent } from './price-chart/price-chart.component';
import { BadgeComponent } from '../../shared/components/badge.component';
import { ApiService } from '../../core/services/api.service';
import type { ListingDetail } from '../../core/models/listing.model';

const MOCK_LISTING: ListingDetail = {
  id: '123',
  source: 'imovirtual',
  url: 'https://example.com/123',
  title: 'Apartamento T3 Porto',
  description: 'Nice apartment',
  price: 1200,
  area: 90,
  price_per_m2: null,
  location: 'Boavista',
  city: 'Porto',
  property_type: 'Apartment',
  typology: 'T3',
  floor: '2',
  has_garage: false,
  is_rented: false,
  lifetime_rent: false,
  is_favorite: true,
  active: true,
  inactive_since: null,
  first_seen: '2024-01-01T00:00:00Z',
  last_seen: '2024-06-01T00:00:00Z',
  price_history: [{ price: 1200, captured_at: '2024-01-01T00:00:00Z' }],
  images: [
    { large: 'https://img.example.com/1-large.jpg', medium: 'https://img.example.com/1-med.jpg' },
    { large: 'https://img.example.com/2-large.jpg', medium: 'https://img.example.com/2-med.jpg' },
  ],
};

class FakeApiService {
  getListing(_id: string): Observable<ListingDetail> {
    return of({ ...MOCK_LISTING });
  }
  setFavorite(_id: string, _value: boolean): Observable<void> {
    return of(undefined as void);
  }
  triggerSnapshot(_id: string): Observable<{ exists: boolean; url?: string }> {
    return of({ exists: true, url: '/api/listings/snapshot-download?id=123' });
  }
}

describe('DetailComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MockComponent(PriceChartComponent), MockComponent(BadgeComponent)],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ApiService, useClass: FakeApiService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '123' } } } },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('calls getListing with route param id and sets listing signal', () => {
    const svc = TestBed.inject(ApiService);
    const spy = vi.spyOn(svc, 'getListing');
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(spy).toHaveBeenCalledWith('123');
    expect(component.listing()).toEqual(MOCK_LISTING);
  });

  it('sets loading to false after successful load', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('sets isFavorite from listing data', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.isFavorite()).toBe(true);
  });

  it('sets selectedImage to first image large URL', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.selectedImage()).toBe('https://img.example.com/1-large.jpg');
  });

  it('sets selectedImage to empty string when listing has no images', () => {
    const svc = TestBed.inject(ApiService);
    vi.spyOn(svc, 'getListing').mockReturnValue(of({ ...MOCK_LISTING, images: [] }));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.selectedImage()).toBe('');
  });

  it('sets loading to false on API error', () => {
    const svc = TestBed.inject(ApiService);
    vi.spyOn(svc, 'getListing').mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('selectImage() updates selectedImage signal', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.selectImage('https://img.example.com/2-large.jpg');
    expect(component.selectedImage()).toBe('https://img.example.com/2-large.jpg');
  });

  it('toggleFavorite() calls setFavorite with the negated current value', () => {
    const svc = TestBed.inject(ApiService);
    const spy = vi.spyOn(svc, 'setFavorite');
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit(); // isFavorite now true
    component.toggleFavorite();
    expect(spy).toHaveBeenCalledWith('123', false);
  });

  it('toggleFavorite() flips isFavorite to false on success', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.toggleFavorite();
    expect(component.isFavorite()).toBe(false);
  });

  it('toggleFavorite() resets favLoading after success', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.toggleFavorite();
    expect(component.favLoading()).toBe(false);
  });

  it('toggleFavorite() resets favLoading on error', () => {
    const svc = TestBed.inject(ApiService);
    vi.spyOn(svc, 'setFavorite').mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.toggleFavorite();
    expect(component.favLoading()).toBe(false);
  });

  it('toggleFavorite() does not flip isFavorite on error', () => {
    const svc = TestBed.inject(ApiService);
    vi.spyOn(svc, 'setFavorite').mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.isFavorite()).toBe(true);
    component.toggleFavorite();
    expect(component.isFavorite()).toBe(true);
  });

  it('saveSnapshot() calls triggerSnapshot with the listing id', () => {
    const svc = TestBed.inject(ApiService);
    const spy = vi.spyOn(svc, 'triggerSnapshot');
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.saveSnapshot();
    expect(spy).toHaveBeenCalledWith('123');
  });

  it('saveSnapshot() sets snapshotSaved to true after success', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.saveSnapshot();
    expect(component.snapshotSaved()).toBe(true);
  });

  it('saveSnapshot() resets snapshotLoading to false after success', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.saveSnapshot();
    expect(component.snapshotLoading()).toBe(false);
  });

  it('saveSnapshot() does nothing when snapshotLoading is already true', () => {
    const svc = TestBed.inject(ApiService);
    const spy = vi.spyOn(svc, 'triggerSnapshot');
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.snapshotLoading.set(true);
    component.saveSnapshot();
    expect(spy).not.toHaveBeenCalled();
  });

  it('saveSnapshot() resets snapshotLoading to false on error', () => {
    const svc = TestBed.inject(ApiService);
    vi.spyOn(svc, 'triggerSnapshot').mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.saveSnapshot();
    expect(component.snapshotLoading()).toBe(false);
  });

  it('saveSnapshot() does not throw when url is absent in response', () => {
    const svc = TestBed.inject(ApiService);
    vi.spyOn(svc, 'triggerSnapshot').mockReturnValue(of({ exists: true }));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(() => component.saveSnapshot()).not.toThrow();
    expect(component.snapshotSaved()).toBe(true);
  });
});

