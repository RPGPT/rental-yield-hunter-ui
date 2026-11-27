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
    date_range: { from: '2026-05-12', to: '2026-11-26' },
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
      month: '2026-10',
      buy_new_count: 2626,
      buy_median_pm2: 4182,
      buy_median_price: 285000,
      rent_new_count: 790,
      rent_median_pm2: 17.6,
      rent_median_price: 1120,
    },
    {
      month: '2026-11',
      buy_new_count: 2641,
      buy_median_pm2: 4167,
      buy_median_price: 288000,
      rent_new_count: 805,
      rent_median_pm2: 17.9,
      rent_median_price: 1150,
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
  by_typology_inactive: [
    {
      typology: 'T2',
      buy_count: 8200,
      median_buy_price: 298000,
      median_buy_pm2: 3920,
      median_area: 79,
      rent_count: 2100,
      median_rent_price: 1180,
      median_rent_pm2: 15.8,
      median_yield: 0.054,
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

  it('loads monthly analytics on init and computes evolution, city, and typology charts', () => {
    const fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(apiSpy.getAnalytics).toHaveBeenCalledWith({ city: undefined, typology: undefined });
    expect(comp.loading()).toBe(false);
    expect(comp.pm2EvolutionData().datasets).toHaveLength(2);
    expect(comp.activityEvolutionData().datasets).toHaveLength(2);
    expect(comp.activeTypologyChartData().datasets).toHaveLength(2);
    expect(comp.inactiveTypologyChartData().datasets).toHaveLength(2);
    expect(comp.cityComparisonData().labels).toEqual(['Porto']);
    expect(comp.outlierTooltip()).toContain('154');
  });

  it('re-fetches analytics when city or typology filter changes and updates scopeLabel', () => {
    const fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.scopeLabel()).toBe('All Cities');
    comp.selectedCity.set('Porto');
    fixture.detectChanges();
    expect(comp.scopeLabel()).toBe('Porto');
    expect(apiSpy.getAnalytics).toHaveBeenLastCalledWith({ city: 'Porto', typology: undefined });

    comp.clearFilters();
    fixture.detectChanges();
    expect(apiSpy.getAnalytics).toHaveBeenLastCalledWith({ city: undefined, typology: undefined });
  });

  it('navigates to /buy filtered by city on city row click', () => {
    const fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.openBuyForCity('Porto');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/buy'], { queryParams: { city: 'Porto' } });
  });

  it('sets error state when API call fails', () => {
    apiSpy.getAnalytics.mockReturnValueOnce(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(AnalyticsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe('Failed to load market analytics.');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
