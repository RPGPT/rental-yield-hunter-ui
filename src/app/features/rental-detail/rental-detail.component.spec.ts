import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MockComponent, MockProvider } from 'ng-mocks';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RentalDetailComponent } from './rental-detail.component';
import { PriceChartComponent } from '../detail/price-chart/price-chart.component';
import { BadgeComponent } from '../../shared/components/badge.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import type { RentalListingDetail } from '../../core/models/listing.model';

const MOCK_LISTING: RentalListingDetail = {
  id: '10',
  source: 'idealista',
  url: 'https://example.com/r10',
  title: 'Rental T2',
  description: null,
  price: 900,
  area: 70,
  rent_price_per_m2: 12,
  location: 'Boavista',
  neighborhood: 'Bonfim',
  city: 'Porto',
  typology: 'T2',
  floor: '1',
  is_favorite: false,
  active: true,
  inactive_since: null,
  first_seen: '2024-01-01T00:00:00Z',
  last_seen: '2024-06-01T00:00:00Z',
  price_history: [{ price: 900, captured_at: '2024-01-01T00:00:00Z' }],
  images: [
    { large: 'http://img.example.com/1.jpg', medium: 'http://img.example.com/1m.jpg' },
    { large: 'http://img.example.com/2.jpg', medium: 'http://img.example.com/2m.jpg' },
  ],
};

describe('RentalDetailComponent', () => {
  let getRentalListing: ReturnType<typeof vi.fn>;
  let setFavorite: ReturnType<typeof vi.fn>;
  let checkSnapshot: ReturnType<typeof vi.fn>;
  let triggerSnapshot: ReturnType<typeof vi.fn>;
  let getListingDescription: ReturnType<typeof vi.fn>;
  let currentUserSignal: WritableSignal<{ id: string } | null>;

  beforeEach(() => {
    getRentalListing = vi.fn().mockReturnValue(of({ ...MOCK_LISTING }));
    setFavorite = vi.fn().mockReturnValue(of(undefined));
    checkSnapshot = vi.fn().mockReturnValue(of({ exists: false }));
    triggerSnapshot = vi.fn().mockReturnValue(of({ exists: true, url: '/snap/10' }));
    getListingDescription = vi
      .fn()
      .mockReturnValue(
        of({
          description: '<p>Desc</p>',
          images: [],
          characteristics: [],
          topInformation: [],
          additionalInformation: [],
        }),
      );
    currentUserSignal = signal<{ id: string } | null>({ id: 'u1' });

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
          getRentalListing,
          setFavorite,
          checkSnapshot,
          triggerSnapshot,
          getListingDescription,
        } as Partial<ApiService>),
        {
          provide: AuthService,
          useValue: {
            currentUser: currentUserSignal,
            isAuthenticated: vi.fn(() => currentUserSignal() !== null),
            isAdmin: vi.fn(() => false),
            getToken: vi.fn(() => 'dev-token'),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '10' } } } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads rental listing on ngOnInit', () => {
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(getRentalListing).toHaveBeenCalledWith('10');
    expect(component.listing()).toBeTruthy();
  });

  it('sets isFavorite from listing data', () => {
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.isFavorite()).toBe(false);
  });

  it('sets currentImage to first image on load', () => {
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.currentImage()).toBe('http://img.example.com/1.jpg');
  });

  it('sets loading to false after successful load', () => {
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('sets loading to false on API error', () => {
    getRentalListing.mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('sets currentImage to empty when listing has no images', () => {
    getRentalListing.mockReturnValue(of({ ...MOCK_LISTING, images: [] }));
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.currentImage()).toBe('');
  });

  it('sets snapshotExists on checkSnapshot response', () => {
    checkSnapshot.mockReturnValue(of({ exists: true }));
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.snapshotExists()).toBe(true);
  });

  it('loads description for imovirtual.com URLs', () => {
    getRentalListing.mockReturnValue(
      of({ ...MOCK_LISTING, url: 'https://www.imovirtual.com/listing/123' }),
    );
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(getListingDescription).toHaveBeenCalled();
  });

  it('sets richDescription when description is returned', () => {
    getRentalListing.mockReturnValue(
      of({ ...MOCK_LISTING, url: 'https://www.imovirtual.com/listing/123' }),
    );
    getListingDescription.mockReturnValue(
      of({
        description: '<p>Rich</p>',
        images: [],
        characteristics: [],
        topInformation: [],
        additionalInformation: [],
      }),
    );
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.richDescription()).toBeTruthy();
  });

  it('updates images from description response when images provided', () => {
    getRentalListing.mockReturnValue(
      of({ ...MOCK_LISTING, url: 'https://www.imovirtual.com/listing/123' }),
    );
    getListingDescription.mockReturnValue(
      of({
        description: null,
        images: [{ large: 'http://new/1.jpg', medium: 'http://new/1m.jpg' }],
        characteristics: [],
        topInformation: [],
        additionalInformation: [],
      }),
    );
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.currentImage()).toBe('http://new/1.jpg');
  });

  it('handles description load error gracefully', () => {
    getRentalListing.mockReturnValue(
      of({ ...MOCK_LISTING, url: 'https://www.imovirtual.com/listing/123' }),
    );
    getListingDescription.mockReturnValue(throwError(() => new Error('desc fail')));
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.descriptionLoading()).toBe(false);
  });

  describe('priceWentUp() / priceWentDown()', () => {
    it('priceWentUp returns false when listing is null', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      expect(component.priceWentUp()).toBe(false);
    });

    it('priceWentDown returns false when listing is null', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      expect(component.priceWentDown()).toBe(false);
    });

    it('priceWentUp returns true when a history price < current price', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.listing.set({
        ...MOCK_LISTING,
        price: 1000,
        price_history: [{ price: 800, captured_at: '2024-01-01' }],
      });
      expect(component.priceWentUp()).toBe(true);
    });

    it('priceWentDown returns true when a history price > current price', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.listing.set({
        ...MOCK_LISTING,
        price: 800,
        price_history: [{ price: 1000, captured_at: '2024-01-01' }],
      });
      expect(component.priceWentDown()).toBe(true);
    });

    it('priceWentUp returns false when no price went lower', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.listing.set({
        ...MOCK_LISTING,
        price: 800,
        price_history: [{ price: 1000, captured_at: '2024-01-01' }],
      });
      expect(component.priceWentUp()).toBe(false);
    });
  });

  describe('mapsUrl()', () => {
    it('returns google maps URL from location', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      const url = component.mapsUrl({ location: 'Boavista', neighborhood: null, city: null });
      expect(url).toContain('Boavista');
    });

    it('returns URL from neighborhood and city when location is null', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      const url = component.mapsUrl({ location: null, neighborhood: 'Bonfim', city: 'Porto' });
      expect(url).toContain('Bonfim');
      expect(url).toContain('Porto');
    });

    it('returns null when location, neighborhood, and city are all null', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      const url = component.mapsUrl({ location: null, neighborhood: null, city: null });
      expect(url).toBeNull();
    });
  });

  describe('currentImageIndex()', () => {
    it('returns the index of the current image', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      const images = [
        { large: 'http://img.example.com/1.jpg' },
        { large: 'http://img.example.com/2.jpg' },
      ];
      expect(component.currentImageIndex(images)).toBe(0);
    });
  });

  describe('selectImage() / navigateImage()', () => {
    it('selectImage() updates currentImage', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.selectImage('http://img.example.com/2.jpg');
      expect(component.currentImage()).toBe('http://img.example.com/2.jpg');
    });

    it('navigateImage() moves to next image', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.navigateImage(1);
      expect(component.currentImage()).toBe('http://img.example.com/2.jpg');
    });

    it('navigateImage() wraps around', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.navigateImage(-1);
      expect(component.currentImage()).toBe('http://img.example.com/2.jpg');
    });

    it('navigateImage() does nothing with < 2 images', () => {
      getRentalListing.mockReturnValue(
        of({ ...MOCK_LISTING, images: [{ large: 'only.jpg', medium: 'only-m.jpg' }] }),
      );
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.navigateImage(1);
      expect(component.currentImage()).toBe('only.jpg');
    });
  });

  describe('onKeyDown()', () => {
    it('navigates right on ArrowRight', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      const spy = vi.spyOn(component, 'navigateImage');
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('navigates left on ArrowLeft', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      const spy = vi.spyOn(component, 'navigateImage');
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(spy).toHaveBeenCalledWith(-1);
    });

    it('ignores key events from INPUT elements', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      const spy = vi.spyOn(component, 'navigateImage');
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      Object.defineProperty(event, 'target', { get: () => ({ tagName: 'INPUT' }) });
      component.onKeyDown(event);
      expect(spy).not.toHaveBeenCalled();
    });

    it('ignores other keys', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      const spy = vi.spyOn(component, 'navigateImage');
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('toggleFavorite()', () => {
    it('calls setFavorite when authenticated', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.toggleFavorite();
      expect(setFavorite).toHaveBeenCalledWith('10', true);
    });

    it('sets isFavorite to true on success', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.toggleFavorite();
      expect(component.isFavorite()).toBe(true);
    });

    it('calls triggerSnapshot when favoriting', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.toggleFavorite();
      expect(triggerSnapshot).toHaveBeenCalledWith('10', 'rental');
    });

    it('does not call triggerSnapshot when un-favoriting', () => {
      getRentalListing.mockReturnValue(of({ ...MOCK_LISTING, is_favorite: true }));
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.toggleFavorite();
      expect(triggerSnapshot).not.toHaveBeenCalled();
    });

    it('resets favLoading on error', () => {
      setFavorite.mockReturnValue(throwError(() => new Error('fail')));
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.toggleFavorite();
      expect(component.favLoading()).toBe(false);
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
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.toggleFavorite();
      expect(spy).toHaveBeenCalledWith('Sign in to save favourites', 'Sign In', { duration: 4000 });
      expect(setFavorite).not.toHaveBeenCalled();
    });
  });

  describe('saveSnapshot()', () => {
    it('calls triggerSnapshot when snapshot does not exist', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.saveSnapshot();
      expect(triggerSnapshot).toHaveBeenCalledWith('10', 'rental');
    });

    it('sets snapshotExists to true after triggering', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.saveSnapshot();
      expect(component.snapshotExists()).toBe(true);
    });

    it('navigates to snapshot viewer when snapshot already exists', () => {
      checkSnapshot.mockReturnValue(of({ exists: true }));
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      component.saveSnapshot();
      expect(triggerSnapshot).not.toHaveBeenCalled();
      expect(navSpy).toHaveBeenCalledWith(['/rental', '10', 'snapshot']);
    });

    it('does nothing when snapshotLoading is true', () => {
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.snapshotLoading.set(true);
      component.saveSnapshot();
      expect(triggerSnapshot).not.toHaveBeenCalled();
    });

    it('resets snapshotLoading on error', () => {
      triggerSnapshot.mockReturnValue(throwError(() => new Error('fail')));
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      component.saveSnapshot();
      expect(component.snapshotLoading()).toBe(false);
    });
  });
});
