import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import type { FilterState } from '../models/filter.model';

const DEFAULT_FILTER: FilterState = {
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
  active: null,
  sort: 'price',
  order: 'asc',
  limit: 50,
  offset: 0,
};

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiService,
      ],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('getListings() sends GET to /api/listings', () => {
    service.getListings({ ...DEFAULT_FILTER }).subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/api/listings'));
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], total: 0, limit: 50, offset: 0 });
  });

  it('getListings() includes limit param', () => {
    service.getListings({ ...DEFAULT_FILTER }).subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/api/listings'));
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ data: [], total: 0, limit: 50, offset: 0 });
  });

  it('getListings() includes offset param', () => {
    service.getListings({ ...DEFAULT_FILTER }).subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/api/listings'));
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ data: [], total: 0, limit: 50, offset: 0 });
  });

  it('getListings() passes city as comma-joined string', () => {
    service.getListings({ ...DEFAULT_FILTER, city: ['Porto', 'Lisboa'] }).subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/api/listings'));
    expect(req.request.params.get('city')).toBe('Porto,Lisboa');
    req.flush({ data: [], total: 0, limit: 50, offset: 0 });
  });

  it('getListing() sends GET to /api/listings/:id', () => {
    service.getListing('42').subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/api/listings/42'));
    expect(req.request.method).toBe('GET');
    req.flush({ id: '42' });
  });

  it('setFavorite(id, true) sends PATCH with is_favorite=true', () => {
    service.setFavorite('10', true).subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/api/listings/10'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.urlWithParams).toContain('is_favorite=true');
    req.flush(null);
  });

  it('setFavorite(id, false) sends PATCH with is_favorite=false', () => {
    service.setFavorite('10', false).subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/api/listings/10'));
    expect(req.request.urlWithParams).toContain('is_favorite=false');
    req.flush(null);
  });

  it('triggerSnapshot() sends POST to /api/listings/snapshot with id', () => {
    service.triggerSnapshot('99').subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/api/listings/snapshot'));
    expect(req.request.method).toBe('POST');
    expect(req.request.urlWithParams).toContain('id=99');
    req.flush({ exists: true, url: '/api/listings/snapshot-download?id=99' });
  });

  it('getStats() sends GET to /api/stats', () => {
    service.getStats().subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/api/stats'));
    expect(req.request.method).toBe('GET');
    req.flush({ total: 10, favorites: 2, active: 8 });
  });

  it('getStats() returns the same observable within cache TTL', () => {
    const obs1 = service.getStats();
    const obs2 = service.getStats();
    expect(obs1).toBe(obs2);
    obs1.subscribe();
    httpMock.expectOne((r) => r.url.includes('/api/stats')).flush({ total: 1 });
  });

  it('getStats() re-fetches after cache expires', () => {
    vi.useFakeTimers();
    service.getStats().subscribe();
    httpMock.expectOne((r) => r.url.includes('/api/stats')).flush({ total: 1 });
    vi.advanceTimersByTime(31_000);
    service.getStats().subscribe();
    httpMock.expectOne((r) => r.url.includes('/api/stats')).flush({ total: 2 });
    vi.useRealTimers();
  });

  it('getFilterOptions() sends GET to /api/filters', () => {
    service.getFilterOptions().subscribe();
    const req = httpMock.expectOne((r) => r.url.includes('/api/filters'));
    expect(req.request.method).toBe('GET');
    req.flush({ cities: [], typologies: [], property_types: [] });
  });

  it('getFilterOptions() returns same observable on second call', () => {
    const obs1 = service.getFilterOptions();
    const obs2 = service.getFilterOptions();
    expect(obs1).toBe(obs2);
    obs1.subscribe();
    httpMock.expectOne((r) => r.url.includes('/api/filters')).flush({ cities: [] });
  });
});
