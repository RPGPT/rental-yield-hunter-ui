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
  price: 300000,
  area: 100,
  price_per_m2: 3000,
  typology: 'T2',
  neighborhood: 'Bonfim',
  city: 'Porto',
  is_favorite: false,
  is_hidden: false,
  is_rented: false,
  is_new: false,
  price_change: null,
  active: true,
  estimated_rent: null,
  rental_yield: null,
  lifetime_rent: false,
  images: [],
  price_history: [],
  location: null,
  description: null,
  first_seen_at: '2024-01-01',
  last_seen_at: '2024-01-01',
  confidence: null,
  source: 'idealista',
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
});
