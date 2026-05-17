import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MockProvider } from 'ng-mocks';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ListingsTableComponent } from './listings-table.component';
import { FilterStateService } from '../../../core/services/filter-state.service';
import { RentalFilterStateService } from '../../../core/services/rental-filter-state.service';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { Sort } from '@angular/material/sort';
import { PageEvent } from '@angular/material/paginator';
import { Listing } from '../../../core/models/listing.model';

const MOCK_LISTING: Listing = {
  id: 'abc',
  title: 'Test listing',
  url: 'https://example.com',
  source: 'idealista',
  description: null,
  price: 300000,
  area: 100,
  price_per_m2: 3000,
  location: null,
  neighborhood: 'Bonfim',
  city: 'Porto',
  property_type: null,
  typology: 'T2',
  floor: null,
  is_favorite: false,
  is_hidden: false,
  is_rented: false,
  lifetime_rent: false,
  active: true,
  inactive_since: null,
  first_seen: '2024-01-01',
  last_seen: '2024-01-01',
  estimated_rent: null,
  avg_rent_per_m2: null,
  sample_count: null,
  confidence: null,
  match_level: null,
  rental_yield: null,
  rent_current_rent: null,
  rent_contract_expiry: null,
};

describe('ListingsTableComponent', () => {
  let setFavorite: ReturnType<typeof vi.fn>;
  let setHidden: ReturnType<typeof vi.fn>;
  let triggerSnapshot: ReturnType<typeof vi.fn>;
  let isAuthenticated: ReturnType<typeof vi.fn>;
  let filterState: FilterStateService;
  let rentalFilterState: RentalFilterStateService;

  function setup(mode: 'buy' | 'rent' = 'buy'): {
    component: ListingsTableComponent;
    fixture: ComponentFixture<ListingsTableComponent>;
  } {
    isAuthenticated = vi.fn().mockReturnValue(true);
    setFavorite = vi.fn().mockReturnValue(of({}));
    setHidden = vi.fn().mockReturnValue(of({}));
    triggerSnapshot = vi.fn().mockReturnValue(of({ url: 'https://blob.com/snap' }));

    TestBed.configureTestingModule({
      imports: [ListingsTableComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        FilterStateService,
        RentalFilterStateService,
        MockProvider(ApiService, { setFavorite, setHidden, triggerSnapshot }),
        MockProvider(AuthService, { isAuthenticated }),
        NoopAnimationsModule,
      ],
    });
    filterState = TestBed.inject(FilterStateService);
    rentalFilterState = TestBed.inject(RentalFilterStateService);
    const fixture = TestBed.createComponent(ListingsTableComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('listings', []);
    fixture.componentRef.setInput('total', 0);
    fixture.componentRef.setInput('loading', false);
    const component = fixture.componentInstance;
    return { component, fixture };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('displayedColumns', () => {
    it('returns buy columns in buy mode', () => {
      const { component } = setup('buy');
      expect(component.displayedColumns()).toContain('price_per_m2');
      expect(component.displayedColumns()).toContain('is_hidden');
    });

    it('returns rent columns in rent mode', () => {
      const { component } = setup('rent');
      expect(component.displayedColumns()).toContain('rent_price_per_m2');
      expect(component.displayedColumns()).not.toContain('is_hidden');
    });
  });

  describe('isFavorite()', () => {
    it('returns row.is_favorite when no override', () => {
      const { component } = setup('buy');
      expect(component.isFavorite({ ...MOCK_LISTING, is_favorite: true })).toBe(true);
    });

    it('returns override value when override exists', () => {
      const { component } = setup('buy');
      component.favoriteOverrides.set({ abc: false });
      expect(component.isFavorite({ ...MOCK_LISTING, is_favorite: true })).toBe(false);
    });
  });

  describe('isHidden()', () => {
    it('returns row.is_hidden when no override', () => {
      const { component } = setup('buy');
      expect(component.isHidden({ ...MOCK_LISTING, is_hidden: true })).toBe(true);
    });

    it('returns false when is_hidden is undefined (RentalListing)', () => {
      const { component } = setup('rent');
      const rental = { ...MOCK_LISTING };
      delete (rental as Partial<Listing>).is_hidden;
      expect(component.isHidden(rental)).toBe(false);
    });

    it('returns override value when override exists', () => {
      const { component } = setup('buy');
      component.hiddenOverrides.set({ abc: true });
      expect(component.isHidden({ ...MOCK_LISTING, is_hidden: false })).toBe(true);
    });
  });

  describe('visibleListings', () => {
    it('returns all listings when no hidden from filter', () => {
      const { component, fixture } = setup('buy');
      fixture.componentRef.setInput('listings', [MOCK_LISTING]);
      expect(component.visibleListings()).toHaveLength(1);
    });

    it('excludes listings hidden from filter', () => {
      const { component, fixture } = setup('buy');
      fixture.componentRef.setInput('listings', [MOCK_LISTING, { ...MOCK_LISTING, id: 'xyz' }]);
      component['hiddenFromFilter'].set(new Set(['abc']));
      expect(component.visibleListings()).toHaveLength(1);
      expect(component.visibleListings()[0].id).toBe('xyz');
    });
  });

  describe('onFavoriteClick()', () => {
    it('calls setFavorite with new value', () => {
      const { component } = setup('buy');
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onFavoriteClick(event, MOCK_LISTING);
      expect(setFavorite).toHaveBeenCalledWith('abc', true);
    });

    it('triggers snapshot when marking as favorite', () => {
      const { component } = setup('buy');
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onFavoriteClick(event, MOCK_LISTING);
      expect(triggerSnapshot).toHaveBeenCalledWith('abc', undefined);
    });

    it('triggers snapshot with "rental" source in rent mode', () => {
      const { component } = setup('rent');
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onFavoriteClick(event, MOCK_LISTING);
      expect(triggerSnapshot).toHaveBeenCalledWith('abc', 'rental');
    });

    it('hides from filter when unfavoriting in favorites-only filter', () => {
      const { component } = setup('buy');
      filterState.isFavorite.set(true);
      const favListing = { ...MOCK_LISTING, is_favorite: true };
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onFavoriteClick(event, favListing);
      expect(component['hiddenFromFilter']().has('abc')).toBe(true);
    });

    it('reverts favoriteOverride on error', () => {
      const { component } = setup('buy');
      setFavorite.mockReturnValue(throwError(() => new Error('fail')));
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onFavoriteClick(event, MOCK_LISTING);
      // after error, override should revert to false (original value)
      expect(component.favoriteOverrides()['abc']).toBe(false);
    });

    it('shows snackbar and navigates when not authenticated', () => {
      const { component } = setup('buy');
      isAuthenticated.mockReturnValue(false);
      const snackBar = TestBed.inject(MatSnackBar);
      const openSpy = vi.spyOn(snackBar, 'open').mockReturnValue({
        onAction: () => of(undefined),
        dismiss: vi.fn(),
        afterDismissed: () => of({ dismissedByAction: false }),
        afterOpened: () => of(undefined),
        _open: false,
        instance: {} as never,
        containerInstance: {} as never,
      } as never);
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onFavoriteClick(event, MOCK_LISTING);
      expect(openSpy).toHaveBeenCalledWith('Sign in to save favourites', 'Sign In', {
        duration: 4000,
      });
      expect(setFavorite).not.toHaveBeenCalled();
    });
  });

  describe('onHiddenClick()', () => {
    it('calls setHidden with new value', () => {
      const { component } = setup('buy');
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onHiddenClick(event, MOCK_LISTING);
      expect(setHidden).toHaveBeenCalledWith('abc', true);
    });

    it('hides from filter when hiding and filter is not show-hidden-only', () => {
      const { component } = setup('buy');
      filterState.isHidden.set(false); // hiding hidden listings
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onHiddenClick(event, MOCK_LISTING); // sets hidden=true
      expect(component['hiddenFromFilter']().has('abc')).toBe(true);
    });

    it('reverts hiddenOverride on error', () => {
      const { component } = setup('buy');
      setHidden.mockReturnValue(throwError(() => new Error('fail')));
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onHiddenClick(event, MOCK_LISTING);
      expect(component.hiddenOverrides()['abc']).toBe(false);
    });

    it('shows snackbar when not authenticated', () => {
      const { component } = setup('buy');
      isAuthenticated.mockReturnValue(false);
      const snackBar = TestBed.inject(MatSnackBar);
      const openSpy = vi.spyOn(snackBar, 'open').mockReturnValue({
        onAction: () => of(undefined),
        dismiss: vi.fn(),
        afterDismissed: () => of({ dismissedByAction: false }),
        afterOpened: () => of(undefined),
        _open: false,
        instance: {} as never,
        containerInstance: {} as never,
      } as never);
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onHiddenClick(event, MOCK_LISTING);
      expect(openSpy).toHaveBeenCalledWith('Sign in to hide listings', 'Sign In', {
        duration: 4000,
      });
      expect(setHidden).not.toHaveBeenCalled();
    });
  });

  describe('onRowClick()', () => {
    it('navigates to /listing/:id in buy mode', () => {
      const { component } = setup('buy');
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.onRowClick(MOCK_LISTING);
      expect(navSpy).toHaveBeenCalledWith(['/listing', 'abc']);
    });

    it('navigates to /rental/:id in rent mode', () => {
      const { component } = setup('rent');
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.onRowClick(MOCK_LISTING);
      expect(navSpy).toHaveBeenCalledWith(['/rental', 'abc']);
    });
  });

  describe('onTitleClick()', () => {
    it('stops propagation and opens URL in new tab', () => {
      const { component } = setup('buy');
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
      const event = { stopPropagation: vi.fn() } as unknown as Event;
      component.onTitleClick(event, 'https://example.com');
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank');
    });
  });

  describe('onSortChange()', () => {
    it('sets sort, order, and resets offset on buy mode', () => {
      const { component } = setup('buy');
      filterState.offset.set(50);
      const sort: Sort = { active: 'price', direction: 'desc' };
      component.onSortChange(sort);
      expect(filterState.sort()).toBe('price');
      expect(filterState.order()).toBe('desc');
      expect(filterState.offset()).toBe(0);
    });

    it('defaults sort to "price" and order to "asc" for empty sort', () => {
      const { component } = setup('buy');
      const sort: Sort = { active: '', direction: '' };
      component.onSortChange(sort);
      expect(filterState.sort()).toBe('price');
      expect(filterState.order()).toBe('asc');
    });
  });

  describe('onPageChange()', () => {
    it('sets limit and offset from PageEvent', () => {
      const { component } = setup('buy');
      const event: PageEvent = { pageSize: 25, pageIndex: 2, length: 100 };
      component.onPageChange(event);
      expect(filterState.limit()).toBe(25);
      expect(filterState.offset()).toBe(50);
    });
  });

  describe('pageSize / pageIndex getters', () => {
    it('returns current limit as pageSize', () => {
      const { component } = setup('buy');
      filterState.limit.set(25);
      expect(component.pageSize).toBe(25);
    });

    it('computes pageIndex from offset/limit', () => {
      const { component } = setup('buy');
      filterState.limit.set(25);
      filterState.offset.set(50);
      expect(component.pageIndex).toBe(2);
    });
  });

  describe('truncate()', () => {
    it('returns text unchanged if <= 50 chars', () => {
      const { component } = setup('buy');
      const text = 'Short title';
      expect(component.truncate(text)).toBe(text);
    });

    it('truncates to 50 chars with ellipsis', () => {
      const { component } = setup('buy');
      const text = 'A'.repeat(60);
      const result = component.truncate(text);
      expect(result).toHaveLength(51); // 50 chars + '…'
      expect(result.endsWith('…')).toBe(true);
    });
  });

  describe('typologyColor()', () => {
    it('returns "blue" for T1', () => {
      const { component } = setup('buy');
      expect(component.typologyColor('T1')).toBe('blue');
    });

    it('returns "amber" for T2', () => {
      const { component } = setup('buy');
      expect(component.typologyColor('T2')).toBe('amber');
    });

    it('returns "green" for T3', () => {
      const { component } = setup('buy');
      expect(component.typologyColor('T3')).toBe('green');
    });

    it('returns "green" for T4+', () => {
      const { component } = setup('buy');
      expect(component.typologyColor('T4')).toBe('green');
    });

    it('returns "grey" for T0', () => {
      const { component } = setup('buy');
      expect(component.typologyColor('T0')).toBe('grey');
    });

    it('returns "grey" for non-T format', () => {
      const { component } = setup('buy');
      expect(component.typologyColor('Studio')).toBe('grey');
    });
  });

  describe('confidenceColor()', () => {
    it('returns "green" for high', () => {
      const { component } = setup('buy');
      expect(component.confidenceColor('high')).toBe('green');
    });

    it('returns "amber" for medium', () => {
      const { component } = setup('buy');
      expect(component.confidenceColor('medium')).toBe('amber');
    });

    it('returns "grey" for low', () => {
      const { component } = setup('buy');
      expect(component.confidenceColor('low')).toBe('grey');
    });

    it('returns "grey" for null', () => {
      const { component } = setup('buy');
      expect(component.confidenceColor(null)).toBe('grey');
    });
  });

  describe('trackById()', () => {
    it('returns listing id', () => {
      const { component } = setup('buy');
      expect(component.trackById(0, MOCK_LISTING)).toBe('abc');
    });
  });

  describe('estRentTooltip()', () => {
    it('shows market estimate when rented with contract and estimate exists', () => {
      const { component } = setup('buy');
      const tooltip = component.estRentTooltip({
        ...MOCK_LISTING,
        is_rented: true,
        rent_current_rent: 800,
        estimated_rent: 900,
      });
      expect(tooltip).toContain('Market est.');
      expect(tooltip).toContain('900');
    });

    it('shows fallback when rented with contract but no estimate', () => {
      const { component } = setup('buy');
      expect(
        component.estRentTooltip({
          ...MOCK_LISTING,
          is_rented: true,
          rent_current_rent: 800,
          estimated_rent: null,
        }),
      ).toBe('No market estimate available');
    });

    it('returns confidence tooltip for normal (non-rented) listings with sample count', () => {
      const { component } = setup('buy');
      const tooltip = component.estRentTooltip({
        ...MOCK_LISTING,
        estimated_rent: 850,
        confidence: 'high',
        sample_count: 10,
        match_level: 'neighborhood',
      });
      expect(tooltip).toContain('high confidence');
      expect(tooltip).toContain('10 comparables');
    });

    it('returns short confidence tooltip when no sample count', () => {
      const { component } = setup('buy');
      const tooltip = component.estRentTooltip({
        ...MOCK_LISTING,
        estimated_rent: 850,
        confidence: 'medium',
        sample_count: null,
      });
      expect(tooltip).toBe('medium confidence');
    });

    it('returns empty string when no estimated rent and not a contract listing', () => {
      const { component } = setup('buy');
      expect(component.estRentTooltip({ ...MOCK_LISTING, estimated_rent: null })).toBe('');
    });

    it('uses normal estimate chip when lifetime_rent even with rent_current_rent', () => {
      const { component } = setup('buy');
      const tooltip = component.estRentTooltip({
        ...MOCK_LISTING,
        lifetime_rent: true,
        rent_current_rent: 800,
        estimated_rent: 850,
        confidence: 'high',
        sample_count: 5,
        match_level: 'city',
      });
      expect(tooltip).toContain('high confidence');
    });
  });

  describe('displayYield()', () => {
    it('returns contract-based yield when rented with contract rent', () => {
      const { component } = setup('buy');
      const result = component.displayYield({
        ...MOCK_LISTING,
        is_rented: true,
        rent_current_rent: 1000,
        price: 200000,
        rental_yield: 0.05,
      });
      expect(result).toBeCloseTo((1000 * 12) / 200000);
    });

    it('returns re.rental_yield when not rented', () => {
      const { component } = setup('buy');
      expect(component.displayYield({ ...MOCK_LISTING, rental_yield: 0.06 })).toBe(0.06);
    });

    it('returns re.rental_yield when lifetime_rent even with contract rent', () => {
      const { component } = setup('buy');
      expect(
        component.displayYield({
          ...MOCK_LISTING,
          lifetime_rent: true,
          rent_current_rent: 800,
          rental_yield: 0.04,
        }),
      ).toBe(0.04);
    });

    it('returns null when no rental_yield and not a contract listing', () => {
      const { component } = setup('buy');
      expect(component.displayYield({ ...MOCK_LISTING, rental_yield: null })).toBeNull();
    });
  });

  describe('yieldTooltip()', () => {
    it('shows contract calculation and est yield when both available', () => {
      const { component } = setup('buy');
      const tooltip = component.yieldTooltip({
        ...MOCK_LISTING,
        is_rented: true,
        rent_current_rent: 1000,
        price: 200000,
        rental_yield: 0.055,
      });
      expect(tooltip).toContain('Contract yield');
      expect(tooltip).toContain('1'); // rent amount
      expect(tooltip).toContain('Est. yield');
      expect(tooltip).toContain('5.50%');
    });

    it('shows contract calculation without est yield when rental_yield is null', () => {
      const { component } = setup('buy');
      const tooltip = component.yieldTooltip({
        ...MOCK_LISTING,
        is_rented: true,
        rent_current_rent: 800,
        price: 150000,
        rental_yield: null,
      });
      expect(tooltip).toContain('Contract yield');
      expect(tooltip).not.toContain('Est. yield');
    });

    it('returns empty string for non-contract listing', () => {
      const { component } = setup('buy');
      expect(component.yieldTooltip({ ...MOCK_LISTING, rental_yield: 0.05 })).toBe('');
    });

    it('returns empty string for lifetime_rent listing', () => {
      const { component } = setup('buy');
      expect(
        component.yieldTooltip({
          ...MOCK_LISTING,
          lifetime_rent: true,
          rent_current_rent: 800,
          rental_yield: 0.04,
        }),
      ).toBe('');
    });
  });

  describe('rentedChipColor()', () => {
    it('returns "red" when lifetime_rent is true', () => {
      const { component } = setup('buy');
      expect(component.rentedChipColor({ ...MOCK_LISTING, lifetime_rent: true })).toBe('red');
    });

    it('returns "green" when contract rent details are present', () => {
      const { component } = setup('buy');
      expect(
        component.rentedChipColor({ ...MOCK_LISTING, is_rented: true, rent_current_rent: 800 }),
      ).toBe('green');
    });

    it('returns "grey" when is_rented but no contract details', () => {
      const { component } = setup('buy');
      expect(
        component.rentedChipColor({ ...MOCK_LISTING, is_rented: true, rent_current_rent: null }),
      ).toBe('grey');
    });
  });

  describe('rentedTooltip()', () => {
    it('returns "Lifetime rent" for lifetime_rent listings', () => {
      const { component } = setup('buy');
      expect(component.rentedTooltip({ ...MOCK_LISTING, lifetime_rent: true })).toBe(
        'Lifetime rent',
      );
    });

    it('returns rent and expiry when contract details are present', () => {
      const { component } = setup('buy');
      const tooltip = component.rentedTooltip({
        ...MOCK_LISTING,
        is_rented: true,
        rent_current_rent: 800,
        rent_contract_expiry: '2026-12-01',
      });
      expect(tooltip).toContain('800');
      expect(tooltip).toContain('Dec 2026');
    });

    it('shows "No expiry date" when contract has no expiry', () => {
      const { component } = setup('buy');
      const tooltip = component.rentedTooltip({
        ...MOCK_LISTING,
        is_rented: true,
        rent_current_rent: 700,
        rent_contract_expiry: null,
      });
      expect(tooltip).toContain('No expiry date');
    });

    it('returns fallback message when no contract details', () => {
      const { component } = setup('buy');
      expect(
        component.rentedTooltip({ ...MOCK_LISTING, is_rented: true, rent_current_rent: null }),
      ).toBe('Rented — no contract details');
    });
  });
});
