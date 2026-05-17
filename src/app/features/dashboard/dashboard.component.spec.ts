import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MockProvider } from 'ng-mocks';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DashboardComponent } from './dashboard.component';
import { ApiService } from '../../core/services/api.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { RentalFilterStateService } from '../../core/services/rental-filter-state.service';

function buildRoute(mode: 'buy' | 'rent' = 'buy', queryParams: Record<string, string> = {}) {
  return {
    snapshot: {
      data: { mode },
      queryParams,
    },
  };
}

describe('DashboardComponent', () => {
  let getListings: ReturnType<typeof vi.fn>;
  let getRentalListings: ReturnType<typeof vi.fn>;
  let getFilterOptions: ReturnType<typeof vi.fn>;
  let getRentalFilterOptions: ReturnType<typeof vi.fn>;

  function setup(
    mode: 'buy' | 'rent' = 'buy',
    queryParams: Record<string, string> = {},
  ): { component: DashboardComponent; fixture: ComponentFixture<DashboardComponent> } {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        MockProvider(ApiService, {
          getListings,
          getRentalListings,
          getFilterOptions,
          getRentalFilterOptions,
        } as Partial<ApiService>),
        FilterStateService,
        RentalFilterStateService,
        { provide: ActivatedRoute, useValue: buildRoute(mode, queryParams) },
        NoopAnimationsModule,
      ],
    });
    TestBed.overrideComponent(DashboardComponent, {
      set: { imports: [], template: '<div></div>' },
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    TestBed.flushEffects();
    return { component: fixture.componentInstance, fixture };
  }

  beforeEach(() => {
    getListings = vi
      .fn()
      .mockReturnValue(of({ data: [{ id: '1' }], total: 1, limit: 50, offset: 0 }));
    getRentalListings = vi
      .fn()
      .mockReturnValue(of({ data: [{ id: 'r1' }], total: 1, limit: 50, offset: 0 }));
    getFilterOptions = vi
      .fn()
      .mockReturnValue(of({ cities: [], typologies: [], neighborhoods: {} }));
    getRentalFilterOptions = vi
      .fn()
      .mockReturnValue(of({ cities: [], typologies: [], neighborhoods: {} }));
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('initializes in buy mode by default', () => {
    const { component } = setup('buy');
    expect(component.mode()).toBe('buy');
  });

  it('initializes in rent mode from route data', () => {
    const { component } = setup('rent');
    expect(component.mode()).toBe('rent');
  });

  it('loads buy listings on init (buy mode)', () => {
    setup('buy');
    expect(getListings).toHaveBeenCalled();
  });

  it('sets listings signal after loading', () => {
    const { component } = setup('buy');
    expect(component.listings()).toEqual([{ id: '1' }]);
    expect(component.total()).toBe(1);
  });

  it('loads rental listings on init (rent mode)', () => {
    setup('rent');
    expect(getRentalListings).toHaveBeenCalled();
  });

  it('sets rentalListings signal after loading', () => {
    const { component } = setup('rent');
    expect(component.rentalListings()).toEqual([{ id: 'r1' }]);
  });

  it('handles buy listing load error gracefully', () => {
    getListings.mockReturnValue(throwError(() => new Error('fail')));
    const { component } = setup('buy');
    expect(component.listingsLoading()).toBe(false);
  });

  it('handles rental listing load error gracefully', () => {
    getRentalListings.mockReturnValue(throwError(() => new Error('fail')));
    const { component } = setup('rent');
    expect(component.listingsLoading()).toBe(false);
  });

  it('ngOnInit fetches buy filter options in buy mode', () => {
    const { component } = setup('buy');
    component.ngOnInit();
    expect(getFilterOptions).toHaveBeenCalled();
  });

  it('ngOnInit fetches rental filter options in rent mode', () => {
    const { component } = setup('rent');
    component.ngOnInit();
    expect(getRentalFilterOptions).toHaveBeenCalled();
  });

  it('sets filterOptions after ngOnInit', () => {
    getFilterOptions.mockReturnValue(
      of({ cities: ['Porto'], typologies: ['T2'], neighborhoods: {} }),
    );
    const { component } = setup('buy');
    component.ngOnInit();
    expect(component.filterOptions()?.cities).toEqual(['Porto']);
  });

  it('activeListings returns listings in buy mode', () => {
    const { component } = setup('buy');
    expect(component.activeListings).toEqual([{ id: '1' }]);
  });

  it('activeListings returns rentalListings in rent mode', () => {
    const { component } = setup('rent');
    expect(component.activeListings).toEqual([{ id: 'r1' }]);
  });

  it('onModeChange() navigates to /buy for buy mode', () => {
    const { component } = setup('buy');
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.onModeChange('buy');
    expect(navSpy).toHaveBeenCalledWith(['/buy']);
  });

  it('onModeChange() navigates to /rent for rent mode', () => {
    const { component } = setup('buy');
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.onModeChange('rent');
    expect(navSpy).toHaveBeenCalledWith(['/rent']);
  });

  it('initializes buy filter state from query params', () => {
    setup('buy', { price_min: '300' });
    const filterState = TestBed.inject(FilterStateService);
    expect(filterState.priceMin()).toBe(300);
  });

  it('initializes rental filter state from query params in rent mode', () => {
    setup('rent', { price_min: '500' });
    const rentalFilterState = TestBed.inject(RentalFilterStateService);
    expect(rentalFilterState.priceMin()).toBe(500);
  });
});
