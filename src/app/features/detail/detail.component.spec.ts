import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MockComponent, MockProvider } from 'ng-mocks';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DetailComponent } from './detail.component';
import { PriceChartComponent } from './price-chart/price-chart.component';
import { BadgeComponent } from '../../shared/components/badge.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
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
  neighborhood: 'Bonfim',
  city: 'Porto',
  property_type: 'Apartment',
  typology: 'T3',
  floor: '2',
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

describe('DetailComponent', () => {
  let getListing: ReturnType<typeof vi.fn>;
  let setFavorite: ReturnType<typeof vi.fn>;
  let checkSnapshot: ReturnType<typeof vi.fn>;
  let triggerSnapshot: ReturnType<typeof vi.fn>;
  let updateListingStatus: ReturnType<typeof vi.fn>;
  let currentUserSignal: WritableSignal<{ id: string } | null>;

  beforeEach(() => {
    getListing = vi.fn().mockReturnValue(of({ ...MOCK_LISTING }));
    setFavorite = vi.fn().mockReturnValue(of(undefined));
    checkSnapshot = vi.fn().mockReturnValue(of({ exists: false }));
    triggerSnapshot = vi
      .fn()
      .mockReturnValue(of({ exists: true, url: '/api/listings/snapshot-download?id=123' }));
    updateListingStatus = vi.fn().mockReturnValue(of(undefined));
    currentUserSignal = signal<{ id: string } | null>({ id: 'dev-user' });

    TestBed.configureTestingModule({
      imports: [
        MockComponent(PriceChartComponent),
        MockComponent(BadgeComponent),
        NoopAnimationsModule,
      ],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        MockProvider(ApiService, {
          getListing,
          setFavorite,
          checkSnapshot,
          triggerSnapshot,
          updateListingStatus,
        } as Partial<ApiService>),
        {
          provide: AuthService,
          useValue: {
            currentUser: currentUserSignal,
            isAuthenticated: vi.fn(() => currentUserSignal() !== null),
            isAdmin: vi.fn(() => true),
            getToken: vi.fn(() => 'dev-token'),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '123' } } } },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('calls getListing with route param id and sets listing signal', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(getListing).toHaveBeenCalledWith('123');
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

  it('sets currentImage to first image large URL', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.currentImage()).toBe('https://img.example.com/1-large.jpg');
  });

  it('sets currentImage to empty string when listing has no images', () => {
    getListing.mockReturnValue(of({ ...MOCK_LISTING, images: [] }));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.currentImage()).toBe('');
  });

  it('sets loading to false on API error', () => {
    getListing.mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('selectImage() updates currentImage signal', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.selectImage('https://img.example.com/2-large.jpg');
    expect(component.currentImage()).toBe('https://img.example.com/2-large.jpg');
  });

  it('toggleFavorite() calls setFavorite with the negated current value', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit(); // isFavorite now true
    component.toggleFavorite();
    expect(setFavorite).toHaveBeenCalledWith('123', false);
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
    setFavorite.mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.toggleFavorite();
    expect(component.favLoading()).toBe(false);
  });

  it('toggleFavorite() does not flip isFavorite on error', () => {
    setFavorite.mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.isFavorite()).toBe(true);
    component.toggleFavorite();
    expect(component.isFavorite()).toBe(true);
  });

  it('toggleFavorite() calls triggerSnapshot when favoriting a listing', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.isFavorite.set(false); // start unfavorited
    triggerSnapshot.mockClear();
    component.toggleFavorite();
    expect(triggerSnapshot).toHaveBeenCalledWith('123');
  });

  it('toggleFavorite() does not call triggerSnapshot when un-favoriting', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.isFavorite.set(true); // start favorited
    triggerSnapshot.mockClear();
    component.toggleFavorite();
    expect(triggerSnapshot).not.toHaveBeenCalled();
  });

  describe('toggleFavorite() — unauthenticated', () => {
    beforeEach(() => {
      currentUserSignal.set(null); // simulate logged-out
    });

    it('does not call setFavorite when user is not authenticated', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.toggleFavorite();
      expect(setFavorite).not.toHaveBeenCalled();
    });

    it('does not change isFavorite when user is not authenticated', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      const before = component.isFavorite();
      component.toggleFavorite();
      expect(component.isFavorite()).toBe(before);
    });

    it('shows a snackbar prompting sign-in when user is not authenticated', () => {
      const snackBar = TestBed.inject(MatSnackBar);
      const spy = vi.spyOn(snackBar, 'open').mockReturnValue({
        onAction: () => of(undefined),
        dismiss: () => {},
        afterDismissed: () => of({ dismissedByAction: false }),
        afterOpened: () => of(undefined),
        _open: false,
        instance: {} as never,
        containerInstance: {} as never,
      } as never);
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.toggleFavorite();
      expect(spy).toHaveBeenCalledWith('Sign in to save favourites', 'Sign In', { duration: 4000 });
    });
  });

  it('saveSnapshot() calls triggerSnapshot with the listing id', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    triggerSnapshot.mockClear();
    component.saveSnapshot();
    expect(triggerSnapshot).toHaveBeenCalledWith('123');
  });

  it('saveSnapshot() sets snapshotExists to true after success', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.saveSnapshot();
    expect(component.snapshotExists()).toBe(true);
  });

  it('saveSnapshot() resets snapshotLoading to false after success', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.saveSnapshot();
    expect(component.snapshotLoading()).toBe(false);
  });

  it('saveSnapshot() does nothing when snapshotLoading is already true', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.snapshotLoading.set(true);
    component.saveSnapshot();
    expect(triggerSnapshot).not.toHaveBeenCalled();
  });

  it('saveSnapshot() resets snapshotLoading to false on error', () => {
    triggerSnapshot.mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.saveSnapshot();
    expect(component.snapshotLoading()).toBe(false);
  });

  it('saveSnapshot() navigates to snapshot viewer when snapshot already exists', () => {
    checkSnapshot.mockReturnValue(of({ exists: true }));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.saveSnapshot();
    expect(triggerSnapshot).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/listing', '123', 'snapshot']);
  });

  describe('markAsRented()', () => {
    it('calls updateListingStatus with is_rented: true', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsRented();
      expect(updateListingStatus).toHaveBeenCalledWith('123', { is_rented: true });
    });

    it('sets is_rented to true on the listing signal after success', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsRented();
      expect(component.listing()?.is_rented).toBe(true);
    });

    it('resets statusLoading to false after success', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsRented();
      expect(component.statusLoading()).toBe(false);
    });

    it('resets statusLoading to false on error', () => {
      updateListingStatus.mockReturnValue(throwError(() => new Error('fail')));
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsRented();
      expect(component.statusLoading()).toBe(false);
    });

    it('does not change listing on error', () => {
      updateListingStatus.mockReturnValue(throwError(() => new Error('fail')));
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsRented();
      expect(component.listing()?.is_rented).toBe(false);
    });
  });

  describe('markAsNotRented()', () => {
    it('calls updateListingStatus with is_rented: false', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.listing.set({ ...MOCK_LISTING, is_rented: true });
      component.markAsNotRented();
      expect(updateListingStatus).toHaveBeenCalledWith('123', { is_rented: false });
    });

    it('sets is_rented to false on the listing signal after success', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.listing.set({ ...MOCK_LISTING, is_rented: true });
      component.markAsNotRented();
      expect(component.listing()?.is_rented).toBe(false);
    });

    it('resets statusLoading to false on error', () => {
      updateListingStatus.mockReturnValue(throwError(() => new Error('fail')));
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsNotRented();
      expect(component.statusLoading()).toBe(false);
    });
  });

  describe('markAsLifetimeRent()', () => {
    it('calls updateListingStatus with lifetime_rent: true', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsLifetimeRent();
      expect(updateListingStatus).toHaveBeenCalledWith('123', { lifetime_rent: true });
    });

    it('sets lifetime_rent to true on the listing signal after success', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsLifetimeRent();
      expect(component.listing()?.lifetime_rent).toBe(true);
    });

    it('resets statusLoading to false after success', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsLifetimeRent();
      expect(component.statusLoading()).toBe(false);
    });

    it('resets statusLoading to false on error', () => {
      updateListingStatus.mockReturnValue(throwError(() => new Error('fail')));
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsLifetimeRent();
      expect(component.statusLoading()).toBe(false);
    });
  });

  describe('markAsNotLifetimeRent()', () => {
    it('calls updateListingStatus with lifetime_rent: false', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.listing.set({ ...MOCK_LISTING, lifetime_rent: true });
      component.markAsNotLifetimeRent();
      expect(updateListingStatus).toHaveBeenCalledWith('123', { lifetime_rent: false });
    });

    it('sets lifetime_rent to false on the listing signal after success', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.listing.set({ ...MOCK_LISTING, lifetime_rent: true });
      component.markAsNotLifetimeRent();
      expect(component.listing()?.lifetime_rent).toBe(false);
    });

    it('resets statusLoading to false on error', () => {
      updateListingStatus.mockReturnValue(throwError(() => new Error('fail')));
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.markAsNotLifetimeRent();
      expect(component.statusLoading()).toBe(false);
    });
  });
});
