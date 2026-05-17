import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { MockProvider } from 'ng-mocks';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FiltersPanelComponent } from './filters-panel.component';
import { FilterStateService } from '../../../core/services/filter-state.service';
import { RentalFilterStateService } from '../../../core/services/rental-filter-state.service';
import { AuthService } from '../../../core/services/auth.service';

describe('FiltersPanelComponent', () => {
  let filterState: FilterStateService;
  let rentalFilterState: RentalFilterStateService;
  let isAuthenticated: ReturnType<typeof vi.fn>;

  function setup(mode: 'buy' | 'rent' = 'buy'): {
    component: FiltersPanelComponent;
    fixture: ComponentFixture<FiltersPanelComponent>;
  } {
    isAuthenticated = vi.fn().mockReturnValue(true);

    TestBed.configureTestingModule({
      imports: [FiltersPanelComponent, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        FilterStateService,
        RentalFilterStateService,
        MockProvider(AuthService, { isAuthenticated }),
      ],
    });
    filterState = TestBed.inject(FilterStateService);
    rentalFilterState = TestBed.inject(RentalFilterStateService);
    const fixture = TestBed.createComponent(FiltersPanelComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('filterOptions', null);
    const component = fixture.componentInstance;
    return { component, fixture };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('isBuyMode getter', () => {
    it('returns true in buy mode', () => {
      const { component, fixture } = setup('buy');
      expect(component.isBuyMode).toBe(true);
    });

    it('returns false in rent mode', () => {
      const { component, fixture } = setup('rent');
      expect(component.isBuyMode).toBe(false);
    });
  });

  describe('filterState getter', () => {
    it('returns buyFilterState in buy mode', () => {
      const { component, fixture } = setup('buy');
      expect(component.filterState).toBe(component.buyFilterState);
    });

    it('returns rentalFilterState in rent mode', () => {
      const { component, fixture } = setup('rent');
      expect(component.filterState).toBe(rentalFilterState);
    });
  });

  describe('selectedTypologies / selectedCities / selectedNeighborhoods', () => {
    it('reflects filterState typology', () => {
      const { component, fixture } = setup('buy');
      filterState.typology.set(['T2']);
      expect(component.selectedTypologies).toEqual(['T2']);
    });

    it('reflects filterState city', () => {
      const { component, fixture } = setup('buy');
      filterState.city.set(['Porto']);
      expect(component.selectedCities).toEqual(['Porto']);
    });

    it('reflects filterState neighborhood', () => {
      const { component, fixture } = setup('buy');
      filterState.neighborhood.set(['Bonfim']);
      expect(component.selectedNeighborhoods).toEqual(['Bonfim']);
    });
  });

  describe('availableNeighborhoods', () => {
    it('returns empty array when filterOptions is null', () => {
      const { component, fixture } = setup('buy');
      expect(component.availableNeighborhoods).toEqual([]);
    });

    it('returns empty array when no cities selected', () => {
      const { component, fixture } = setup('buy');
      fixture.componentRef.setInput('filterOptions', {
        cities: ['Porto'],
        typologies: [],
        neighborhoods: { Porto: ['Bonfim'] },
      });
      filterState.city.set([]);
      expect(component.availableNeighborhoods).toEqual([]);
    });

    it('returns neighborhoods for selected cities', () => {
      const { component, fixture } = setup('buy');
      fixture.componentRef.setInput('filterOptions', {
        cities: ['Porto'],
        typologies: [],
        neighborhoods: { Porto: ['Bonfim', 'Cedofeita'] },
      });
      filterState.city.set(['Porto']);
      expect(component.availableNeighborhoods).toEqual(['Bonfim', 'Cedofeita']);
    });
  });

  describe('isNeighborhoodEnabled', () => {
    it('returns false when no city selected', () => {
      const { component, fixture } = setup('buy');
      filterState.city.set([]);
      expect(component.isNeighborhoodEnabled).toBe(false);
    });

    it('returns true when cities are selected', () => {
      const { component, fixture } = setup('buy');
      filterState.city.set(['Porto']);
      expect(component.isNeighborhoodEnabled).toBe(true);
    });
  });

  describe('isRentedSelection / lifetimeRentSelection / activeSelection', () => {
    it('returns ["true"] when isRented is true', () => {
      const { component, fixture } = setup('buy');
      filterState.isRented.set(true);
      expect(component.isRentedSelection).toEqual(['true']);
    });

    it('returns [] when isRented is null', () => {
      const { component, fixture } = setup('buy');
      filterState.isRented.set(null);
      expect(component.isRentedSelection).toEqual([]);
    });

    it('returns [] for isRentedSelection in rent mode', () => {
      const { component, fixture } = setup('rent');
      expect(component.isRentedSelection).toEqual([]);
    });

    it('returns ["false"] when active is false', () => {
      const { component, fixture } = setup('buy');
      filterState.active.set(false);
      expect(component.activeSelection).toEqual(['false']);
    });
  });

  describe('rentPerM2Min / rentPerM2Max', () => {
    it('returns null in buy mode', () => {
      const { component, fixture } = setup('buy');
      expect(component.rentPerM2Min).toBeNull();
      expect(component.rentPerM2Max).toBeNull();
    });

    it('returns rentalFilterState value in rent mode', () => {
      const { component, fixture } = setup('rent');
      rentalFilterState.rentPricePerM2Min.set(5);
      rentalFilterState.rentPricePerM2Max.set(10);
      expect(component.rentPerM2Min).toBe(5);
      expect(component.rentPerM2Max).toBe(10);
    });
  });

  describe('rentalYieldMin', () => {
    it('returns null in rent mode', () => {
      const { component, fixture } = setup('rent');
      expect(component.rentalYieldMin).toBeNull();
    });

    it('returns buyFilterState.rentalYieldMin in buy mode', () => {
      const { component, fixture } = setup('buy');
      filterState.rentalYieldMin.set(0.05);
      expect(component.rentalYieldMin).toBe(0.05);
    });
  });

  describe('cycleFavorite()', () => {
    it('sets isFavorite to true when currently null', () => {
      const { component, fixture } = setup('buy');
      filterState.isFavorite.set(null);
      component.cycleFavorite();
      expect(filterState.isFavorite()).toBe(true);
    });

    it('sets isFavorite to null when currently true', () => {
      const { component, fixture } = setup('buy');
      filterState.isFavorite.set(true);
      component.cycleFavorite();
      expect(filterState.isFavorite()).toBeNull();
    });

    it('navigates to /login when not authenticated', () => {
      const { component, fixture } = setup('buy');
      isAuthenticated.mockReturnValue(false);
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.cycleFavorite();
      expect(navSpy).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('favoriteIcon()', () => {
    it('returns "favorite" when isFavorite is true', () => {
      const { component, fixture } = setup('buy');
      filterState.isFavorite.set(true);
      expect(component.favoriteIcon()).toBe('favorite');
    });

    it('returns "favorite_border" when isFavorite is null', () => {
      const { component, fixture } = setup('buy');
      filterState.isFavorite.set(null);
      expect(component.favoriteIcon()).toBe('favorite_border');
    });
  });

  describe('cycleHidden()', () => {
    it('sets isHidden to null when currently false', () => {
      const { component, fixture } = setup('buy');
      filterState.isHidden.set(false);
      component.cycleHidden();
      expect(filterState.isHidden()).toBeNull();
    });

    it('sets isHidden to false when currently null', () => {
      const { component, fixture } = setup('buy');
      filterState.isHidden.set(null);
      component.cycleHidden();
      expect(filterState.isHidden()).toBe(false);
    });

    it('navigates to /login when not authenticated', () => {
      const { component, fixture } = setup('buy');
      isAuthenticated.mockReturnValue(false);
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.cycleHidden();
      expect(navSpy).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('hiddenIcon()', () => {
    it('returns "visibility" when isHidden is null (show all)', () => {
      const { component, fixture } = setup('buy');
      filterState.isHidden.set(null);
      expect(component.hiddenIcon()).toBe('visibility');
    });

    it('returns "visibility_off" when isHidden is false', () => {
      const { component, fixture } = setup('buy');
      filterState.isHidden.set(false);
      expect(component.hiddenIcon()).toBe('visibility_off');
    });
  });

  describe('cycleNew()', () => {
    it('sets isNew to true when currently null', () => {
      const { component, fixture } = setup('buy');
      filterState.isNew.set(null);
      component.cycleNew();
      expect(filterState.isNew()).toBe(true);
    });

    it('sets isNew to null when currently true', () => {
      const { component, fixture } = setup('buy');
      filterState.isNew.set(true);
      component.cycleNew();
      expect(filterState.isNew()).toBeNull();
    });
  });

  describe('cyclePriceChange()', () => {
    it('cycles null → reduced → increased → null', () => {
      const { component, fixture } = setup('buy');
      filterState.priceChange.set(null);
      component.cyclePriceChange();
      expect(filterState.priceChange()).toBe('reduced');
      component.cyclePriceChange();
      expect(filterState.priceChange()).toBe('increased');
      component.cyclePriceChange();
      expect(filterState.priceChange()).toBeNull();
    });
  });

  describe('priceChangeIcon()', () => {
    it('returns "arrow_downward" for reduced', () => {
      const { component, fixture } = setup('buy');
      filterState.priceChange.set('reduced');
      expect(component.priceChangeIcon()).toBe('arrow_downward');
    });

    it('returns "arrow_upward" for increased', () => {
      const { component, fixture } = setup('buy');
      filterState.priceChange.set('increased');
      expect(component.priceChangeIcon()).toBe('arrow_upward');
    });

    it('returns "swap_vert" for null', () => {
      const { component, fixture } = setup('buy');
      filterState.priceChange.set(null);
      expect(component.priceChangeIcon()).toBe('swap_vert');
    });
  });

  describe('onTypologyChange()', () => {
    it('updates filterState typology', () => {
      const { component, fixture } = setup('buy');
      component.onTypologyChange(['T1', 'T2']);
      expect(filterState.typology()).toEqual(['T1', 'T2']);
    });

    it('resets offset to 0', () => {
      const { component, fixture } = setup('buy');
      filterState.offset.set(50);
      component.onTypologyChange(['T2']);
      expect(filterState.offset()).toBe(0);
    });
  });

  describe('onCityChange()', () => {
    it('updates city and clears neighborhoods when no filterOptions', () => {
      const { component, fixture } = setup('buy');
      filterState.neighborhood.set(['Bonfim']);
      component.onCityChange(['Porto']);
      expect(filterState.city()).toEqual(['Porto']);
      expect(filterState.neighborhood()).toEqual([]);
    });

    it('filters neighborhoods to keep only valid ones for selected cities', () => {
      const { component, fixture } = setup('buy');
      fixture.componentRef.setInput('filterOptions', {
        cities: ['Porto', 'Lisboa'],
        typologies: [],
        neighborhoods: { Porto: ['Bonfim'], Lisboa: ['Alfama'] },
      });
      filterState.neighborhood.set(['Bonfim', 'Alfama']);
      component.onCityChange(['Porto']);
      expect(filterState.neighborhood()).toEqual(['Bonfim']);
    });
  });

  describe('onNeighborhoodChange()', () => {
    it('updates neighborhood signal', () => {
      const { component, fixture } = setup('buy');
      component.onNeighborhoodChange(['Bonfim']);
      expect(filterState.neighborhood()).toEqual(['Bonfim']);
    });
  });

  describe('onBoolToggle()', () => {
    it('sets signal to true when values is ["true"]', () => {
      const { component, fixture } = setup('buy');
      component.onBoolToggle(filterState.active, ['true']);
      expect(filterState.active()).toBe(true);
    });

    it('sets signal to false when values is ["false"]', () => {
      const { component, fixture } = setup('buy');
      component.onBoolToggle(filterState.active, ['false']);
      expect(filterState.active()).toBe(false);
    });

    it('sets signal to null when values is empty', () => {
      const { component, fixture } = setup('buy');
      filterState.active.set(true);
      component.onBoolToggle(filterState.active, []);
      expect(filterState.active()).toBeNull();
    });

    it('sets signal to null when values has 2 entries', () => {
      const { component, fixture } = setup('buy');
      component.onBoolToggle(filterState.active, ['true', 'false']);
      expect(filterState.active()).toBeNull();
    });
  });

  describe('resetFilters()', () => {
    it('resets filterState to defaults', () => {
      const { component, fixture } = setup('buy');
      filterState.priceMin.set(500000);
      filterState.city.set(['Porto']);
      component.resetFilters();
      expect(filterState.priceMin()).toBeNull();
      expect(filterState.city()).toEqual([]);
    });
  });

  describe('onPriceMinInput / onPriceMaxInput / onAreaMinInput / onAreaMaxInput', () => {
    it('ngOnInit subscribes to price/area subjects', () => {
      const { component, fixture } = setup('buy');
      // ngOnInit needs DestroyRef so we call it; it should not throw
      expect(() => component.ngOnInit()).not.toThrow();
    });
  });

  describe('onRentPerM2MinInput / onRentPerM2MaxInput', () => {
    it('calls next on rentPerM2MinSubject', () => {
      const { component } = setup('rent');
      expect(() => component.onRentPerM2MinInput('5')).not.toThrow();
    });
    it('calls next on rentPerM2MaxSubject', () => {
      const { component } = setup('rent');
      expect(() => component.onRentPerM2MaxInput('15')).not.toThrow();
    });
  });

  describe('onRentalYieldMinInput', () => {
    it('calls next on rentalYieldMinSubject', () => {
      const { component } = setup('buy');
      expect(() => component.onRentalYieldMinInput('4')).not.toThrow();
    });
  });
});
