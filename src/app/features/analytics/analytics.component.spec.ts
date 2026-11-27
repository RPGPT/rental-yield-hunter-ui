import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AnalyticsComponent } from './analytics.component';
import { ApiService } from '../../core/services/api.service';
import { AnalyticsResponse } from '../../core/models/analytics.model';

const MOCK_ANALYTICS: AnalyticsResponse = {
  meta: {
    cities: ['Porto', 'Vila Nova de Gaia'],
    typologies: ['T0', 'T1', 'T2', 'T3', 'T4+'],
    selected_city: null,
    selected_typology: null,
    date_range: { from: '2026-05-02', to: '2026-11-26' },
    outliers: {
      buy_excluded: 154,
      buy_total: 42866,
      rent_excluded: 363,
      rent_total: 11920,
      buy_bounds: {
        minArea: 15,
        maxArea: 400,
        minPrice: 30000,
        maxPrice: 1500000,
        minPricePerM2: 500,
        maxPricePerM2: 10000,
      },
      rent_bounds: {
        minArea: 15,
        maxArea: 350,
        minPrice: 250,
        maxPrice: 5000,
        minPricePerM2: 3,
        maxPricePerM2: 50,
      },
    },
  },
  kpis: {
    active_buy_count: 11500,
    active_rent_count: 2900,
    median_buy_price: 290000,
    median_buy_pm2: 4320,
    p25_buy_pm2: 3400,
    p75_buy_pm2: 5300,
    median_area: 69,
    median_rent_price: 1150,
    median_rent_pm2: 17.8,
    median_gross_yield: 0.0525,
    price_drop_share_pct: 12.4,
    median_price_drop_pct: 0.048,
    median_days_on_market: 34,
  },
  evolution: [
    {
      week: '2026-11-09',
      buy_new_count: 626,
      buy_median_pm2: 4182,
      buy_median_price: 285000,
      rent_new_count: 190,
      rent_median_pm2: 17.6,
      rent_median_price: 1120,
      price_drops_count: 42,
      price_increases_count: 5,
    },
    {
      week: '2026-11-16',
      buy_new_count: 641,
      buy_median_pm2: 4167,
      buy_median_price: 288000,
      rent_new_count: 205,
      rent_median_pm2: 17.9,
      rent_median_price: 1150,
      price_drops_count: 51,
      price_increases_count: 4,
    },
  ],
  by_city: [
    {
      city: 'Porto',
      buy_count: 3728,
      median_buy_price: 295000,
      median_buy_pm2: 5095,
      p25_buy_pm2: 4200,
      p75_buy_pm2: 6100,
      rent_count: 1400,
      median_rent_price: 1200,
      median_rent_pm2: 19.1,
      median_yield: 0.051,
      price_drop_share_pct: 11.2,
    },
  ],
  by_typology: [
    {
      typology: 'T2',
      buy_count: 4665,
      median_buy_price: 315000,
      median_buy_pm2: 4079,
      median_area: 80,
      rent_count: 900,
      median_rent_price: 1250,
      median_rent_pm2: 16.5,
      median_yield: 0.053,
    },
  ],
  top_neighborhoods: [
    {
      city: 'Porto',
      neighborhood: 'Paranhos',
      buy_count: 210,
      median_buy_price: 270000,
      median_buy_pm2: 4400,
      median_est_rent: 1220,
      median_yield: 0.056,
    },
    {
      city: 'Porto',
      neighborhood: 'Bonfim',
      buy_count: 180,
      median_buy_price: 285000,
      median_buy_pm2: 4900,
      median_est_rent: 1200,
      median_yield: 0.052,
    },
  ],
};

describe('AnalyticsComponent', () => {
  let apiSpy: { getAnalytics: ReturnType<typeof vi.fn> };
  let routerSpy: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiSpy = { getAnalytics: vi.fn(() => of(MOCK_ANALYTICS)) };
    routerSpy = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AnalyticsComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ApiService, useValue: apiSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('loads analytics on init and computes chart datasets + outlier tooltip', () => {
    const fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(apiSpy.getAnalytics).toHaveBeenCalledWith({ city: undefined, typology: undefined });
    expect(comp.loading()).toBe(false);
    expect(comp.pm2EvolutionData().datasets).toHaveLength(2);
    expect(comp.activityEvolutionData().datasets).toHaveLength(3);
    expect(comp.cityComparisonData().labels).toEqual(['Porto']);
    expect(comp.outlierTooltip()).toContain('154');
  });

  it('re-fetches analytics when city or typology filter changes', () => {
    const fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.selectedCity.set('Porto');
    fixture.detectChanges();
    expect(apiSpy.getAnalytics).toHaveBeenLastCalledWith({ city: 'Porto', typology: undefined });

    comp.clearFilters();
    fixture.detectChanges();
    expect(apiSpy.getAnalytics).toHaveBeenLastCalledWith({ city: undefined, typology: undefined });
  });

  it('sorts neighborhoods by selected ranking metric and navigates on click', () => {
    const fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.sortedNeighborhoods()[0].neighborhood).toBe('Paranhos');

    comp.neighborhoodSort.set('median_buy_pm2');
    expect(comp.sortedNeighborhoods()[0].neighborhood).toBe('Bonfim');

    comp.openBuyForCity('Porto');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/buy'], { queryParams: { city: 'Porto' } });

    comp.openBuyForNeighborhood(MOCK_ANALYTICS.top_neighborhoods[0]);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/buy'], {
      queryParams: { city: 'Porto', neighborhood: 'Paranhos' },
    });
  });

  it('sets error state when API call fails', () => {
    apiSpy.getAnalytics.mockReturnValueOnce(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe('Failed to load market analytics.');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
