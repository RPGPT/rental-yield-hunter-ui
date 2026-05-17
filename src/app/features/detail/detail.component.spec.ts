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
  is_hidden: false,
  active: true,
  inactive_since: null,
  first_seen: '2024-01-01T00:00:00Z',
  last_seen: '2024-06-01T00:00:00Z',
  rental_yield: null,
  estimated_rent: null,
  avg_rent_per_m2: null,
  sample_count: null,
  confidence: null,
  match_level: null,
  rent_current_rent: null,
  rent_contract_expiry: null,
  price_history: [{ price: 1200, captured_at: '2024-01-01T00:00:00Z' }],
  images: [
    { large: 'https://img.example.com/1-large.jpg', medium: 'https://img.example.com/1-med.jpg' },
    { large: 'https://img.example.com/2-large.jpg', medium: 'https://img.example.com/2-med.jpg' },
  ],
};

describe('DetailComponent', () => {
  let getListing: ReturnType<typeof vi.fn>;
  let setFavorite: ReturnType<typeof vi.fn>;
  let setHidden: ReturnType<typeof vi.fn>;
  let checkSnapshot: ReturnType<typeof vi.fn>;
  let triggerSnapshot: ReturnType<typeof vi.fn>;
  let updateListingStatus: ReturnType<typeof vi.fn>;
  let currentUserSignal: WritableSignal<{ id: string } | null>;

  beforeEach(() => {
    getListing = vi.fn().mockReturnValue(of({ ...MOCK_LISTING }));
    setFavorite = vi.fn().mockReturnValue(of(undefined));
    setHidden = vi.fn().mockReturnValue(of(undefined));
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
          setHidden,
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

  describe('toggleHidden()', () => {
    it('calls setHidden with true when not currently hidden', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.isHidden.set(false);
      component.toggleHidden();
      expect(setHidden).toHaveBeenCalledWith('123', true);
    });

    it('sets isHidden to true on success', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.isHidden.set(false);
      component.toggleHidden();
      expect(component.isHidden()).toBe(true);
    });

    it('resets hiddenLoading to false after success', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.toggleHidden();
      expect(component.hiddenLoading()).toBe(false);
    });

    it('resets hiddenLoading to false on error', () => {
      setHidden.mockReturnValue(throwError(() => new Error('fail')));
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.toggleHidden();
      expect(component.hiddenLoading()).toBe(false);
    });

    it('shows snackbar when not authenticated', () => {
      currentUserSignal.set(null);
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
      component.toggleHidden();
      expect(spy).toHaveBeenCalledWith('Sign in to hide listings', 'Sign In', { duration: 4000 });
      expect(setHidden).not.toHaveBeenCalled();
    });
  });

  describe('priceWentUp() / priceWentDown()', () => {
    it('priceWentUp() returns false when listing is null', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      expect(component.priceWentUp()).toBe(false);
    });

    it('priceWentDown() returns false when listing is null', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      expect(component.priceWentDown()).toBe(false);
    });

    it('priceWentUp() returns true when a history price < current price', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.listing.set({
        ...MOCK_LISTING,
        price: 1200,
        price_history: [{ price: 900, captured_at: '2024-01-01' }],
      });
      expect(component.priceWentUp()).toBe(true);
    });

    it('priceWentDown() returns true when a history price > current price', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.listing.set({
        ...MOCK_LISTING,
        price: 900,
        price_history: [{ price: 1200, captured_at: '2024-01-01' }],
      });
      expect(component.priceWentDown()).toBe(true);
    });
  });

  describe('isAdmin()', () => {
    it('delegates to auth.isAdmin()', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      expect(component.isAdmin()).toBe(true);
    });
  });

  describe('confidenceColor()', () => {
    it('returns "green" for high confidence', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      expect(component.confidenceColor('high')).toBe('green');
    });

    it('returns "amber" for medium confidence', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      expect(component.confidenceColor('medium')).toBe('amber');
    });

    it('returns "grey" for low confidence', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      expect(component.confidenceColor('low')).toBe('grey');
    });

    it('returns "grey" for null confidence', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      expect(component.confidenceColor(null)).toBe('grey');
    });
  });

  describe('mapsUrl()', () => {
    it('returns URL using location when available', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const url = component.mapsUrl({ location: 'Boavista', neighborhood: null, city: null });
      expect(url).toContain('Boavista');
    });

    it('returns URL using neighborhood and city when location is null', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const url = component.mapsUrl({ location: null, neighborhood: 'Bonfim', city: 'Porto' });
      expect(url).toContain('Bonfim');
    });

    it('returns null when all location fields are null', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const url = component.mapsUrl({ location: null, neighborhood: null, city: null });
      expect(url).toBeNull();
    });
  });

  describe('currentImageIndex()', () => {
    it('returns the index of the current image', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      const images = MOCK_LISTING.images.map((img) => ({ large: img.large }));
      expect(component.currentImageIndex(images)).toBe(0);
    });
  });

  describe('navigateImage()', () => {
    it('does nothing when there are fewer than 2 images', () => {
      getListing.mockReturnValue(
        of({ ...MOCK_LISTING, images: [{ large: 'only.jpg', medium: 'only-m.jpg' }] }),
      );
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.navigateImage(1);
      expect(component.currentImage()).toBe('only.jpg');
    });
  });

  describe('onKeyDown()', () => {
    it('navigates right on ArrowRight key', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      const spy = vi.spyOn(component, 'navigateImage');
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('navigates left on ArrowLeft key', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      const spy = vi.spyOn(component, 'navigateImage');
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(spy).toHaveBeenCalledWith(-1);
    });

    it('ignores key events from TEXTAREA elements', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      const spy = vi.spyOn(component, 'navigateImage');
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      Object.defineProperty(event, 'target', { get: () => ({ tagName: 'TEXTAREA' }) });
      component.onKeyDown(event);
      expect(spy).not.toHaveBeenCalled();
    });

    it('ignores other keys', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      const spy = vi.spyOn(component, 'navigateImage');
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getListingDescription (imovirtual URL path)', () => {
    let getListingDescription: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      getListingDescription = vi.fn().mockReturnValue(
        of({
          description: '<p>Rich</p>',
          images: [],
          characteristics: [],
          topInformation: [],
          additionalInformation: [],
        }),
      );
      getListing.mockReturnValue(
        of({ ...MOCK_LISTING, url: 'https://www.imovirtual.com/imovel/123' }),
      );
      TestBed.overrideProvider(ApiService, {
        useValue: {
          getListing,
          setFavorite,
          setHidden,
          checkSnapshot,
          triggerSnapshot,
          updateListingStatus,
          getListingDescription,
        },
      });
    });

    it('calls getListingDescription for imovirtual URLs', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      expect(getListingDescription).toHaveBeenCalled();
    });

    it('sets richDescription from response', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      expect(component.richDescription()).toBeTruthy();
    });

    it('updates images from description response', () => {
      getListingDescription.mockReturnValue(
        of({
          description: null,
          images: [{ large: 'http://new/img.jpg', medium: 'http://new/img-m.jpg' }],
          characteristics: [],
          topInformation: [],
          additionalInformation: [],
        }),
      );
      TestBed.overrideProvider(ApiService, {
        useValue: {
          getListing,
          setFavorite,
          setHidden,
          checkSnapshot,
          triggerSnapshot,
          updateListingStatus,
          getListingDescription,
        },
      });
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      expect(component.currentImage()).toBe('http://new/img.jpg');
    });

    it('handles description error gracefully', () => {
      getListingDescription.mockReturnValue(throwError(() => new Error('fail')));
      TestBed.overrideProvider(ApiService, {
        useValue: {
          getListing,
          setFavorite,
          setHidden,
          checkSnapshot,
          triggerSnapshot,
          updateListingStatus,
          getListingDescription,
        },
      });
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      expect(component.descriptionLoading()).toBe(false);
    });
  });

  describe('displayYield()', () => {
    it('returns contract yield when listing is rented with contract rent', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        price: 100000,
        is_rented: true,
        lifetime_rent: false,
        rent_current_rent: 500,
        rental_yield: 0.04,
      };
      expect(component.displayYield(l)).toBeCloseTo(0.06); // 500*12/100000
    });

    it('falls back to rental_yield when not rented with contract details', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = { ...MOCK_LISTING, rental_yield: 0.05 };
      expect(component.displayYield(l)).toBe(0.05);
    });

    it('falls back to rental_yield for lifetime listings (ignores contract rent)', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        is_rented: true,
        lifetime_rent: true,
        rent_current_rent: 500,
        rental_yield: 0.03,
      };
      expect(component.displayYield(l)).toBe(0.03);
    });

    it('returns null when no yield data at all', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = { ...MOCK_LISTING, rental_yield: null };
      expect(component.displayYield(l)).toBeNull();
    });
  });

  describe('yieldTooltip()', () => {
    it('returns contract yield breakdown with est yield when available', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        price: 120000,
        is_rented: true,
        lifetime_rent: false,
        rent_current_rent: 600,
        rental_yield: 0.04,
      };
      const tip = component.yieldTooltip(l);
      expect(tip).toContain('Contract yield:');
      expect(tip).toContain('600');
      expect(tip).toContain('6.00%');
      expect(tip).toContain('Est. yield: 4.00%');
    });

    it('returns contract yield breakdown without est yield when rental_yield is null', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        price: 100000,
        is_rented: true,
        lifetime_rent: false,
        rent_current_rent: 500,
        rental_yield: null,
      };
      const tip = component.yieldTooltip(l);
      expect(tip).toContain('Contract yield:');
      expect(tip).not.toContain('Est. yield:');
    });

    it('returns empty string for non-contract listing', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = { ...MOCK_LISTING, rental_yield: 0.05 };
      expect(component.yieldTooltip(l)).toBe('');
    });

    it('returns empty string for lifetime listing even with contract rent', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        is_rented: true,
        lifetime_rent: true,
        rent_current_rent: 500,
      };
      expect(component.yieldTooltip(l)).toBe('');
    });
  });

  describe('estRentTooltip()', () => {
    it('returns market estimate for contract listing when estimated_rent is set', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        is_rented: true,
        lifetime_rent: false,
        rent_current_rent: 500,
        estimated_rent: 750,
      };
      expect(component.estRentTooltip(l)).toBe('Market est.: 750€/mo');
    });

    it('returns fallback message for contract listing when no estimated_rent', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        is_rented: true,
        lifetime_rent: false,
        rent_current_rent: 500,
        estimated_rent: null,
      };
      expect(component.estRentTooltip(l)).toBe('No market estimate available');
    });

    it('returns empty string for non-rented listing without estimate', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = { ...MOCK_LISTING, estimated_rent: null };
      expect(component.estRentTooltip(l)).toBe('');
    });

    it('returns confidence tooltip with sample count for normal listing', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        estimated_rent: 900,
        confidence: 'high',
        sample_count: 12,
        match_level: 'typology',
      };
      expect(component.estRentTooltip(l)).toBe(
        'high confidence · based on 12 comparables (typology)',
      );
    });

    it('returns simple confidence tooltip when sample_count is null', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        estimated_rent: 900,
        confidence: 'medium',
        sample_count: null,
        match_level: null,
      };
      expect(component.estRentTooltip(l)).toBe('medium confidence');
    });

    it('returns empty string for lifetime listing even with contract rent', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        is_rented: true,
        lifetime_rent: true,
        rent_current_rent: 500,
        estimated_rent: 750,
      };
      // lifetime bypasses contract branch → falls through to normal estimated_rent path
      expect(component.estRentTooltip(l)).toContain('confidence');
    });
  });
});
