import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { provideRouter, ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { MockComponent, MockProvider } from 'ng-mocks';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { DetailComponent } from './detail.component';
import { PriceChartComponent } from './price-chart/price-chart.component';
import { BadgeComponent } from '../../shared/components/badge.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import type { ListingDetail } from '../../core/models/listing.model';
import { MarkAsRentedDialogComponent } from './mark-as-rented-dialog.component';

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
  let dialogAfterClosed: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

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
    dialogAfterClosed = vi.fn().mockReturnValue(of(null));
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: dialogAfterClosed });
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: '123' }));

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
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            snapshot: { paramMap: convertToParamMap({ id: '123' }) },
          },
        },
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('calls getListing with route param id and reloads when sibling route param changes', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(getListing).toHaveBeenCalledWith('123');
    expect(component.listing()).toEqual(MOCK_LISTING);

    getListing.mockReturnValueOnce(of({ ...MOCK_LISTING, id: '456', title: 'Sibling Ad' }));
    paramMap$.next(convertToParamMap({ id: '456' }));
    expect(getListing).toHaveBeenCalledWith('456');
    expect(component.listing()?.id).toBe('456');
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

  it('sets loading to false on API error', () => {
    getListing.mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('toggleFavorite() calls setFavorite with the negated current value', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.toggleFavorite();
    expect(setFavorite).toHaveBeenCalledWith('123', false);
  });

  it('toggleFavorite() flips isFavorite to false on success and resets favLoading', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.toggleFavorite();
    expect(component.isFavorite()).toBe(false);
    expect(component.favLoading()).toBe(false);
  });

  it('toggleFavorite() resets favLoading and preserves isFavorite on error', () => {
    setFavorite.mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.toggleFavorite();
    expect(component.favLoading()).toBe(false);
    expect(component.isFavorite()).toBe(true);
  });

  it('toggleFavorite() triggers snapshot only when favoriting and handles snapshot errors', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.isFavorite.set(false);
    triggerSnapshot.mockClear();
    component.toggleFavorite();
    expect(triggerSnapshot).toHaveBeenCalledWith('123');

    triggerSnapshot.mockClear();
    component.toggleFavorite();
    expect(triggerSnapshot).not.toHaveBeenCalled();

    triggerSnapshot.mockReturnValue(throwError(() => new Error('snapshot fail')));
    component.isFavorite.set(false);
    component.toggleFavorite();
    expect(component.isFavorite()).toBe(true);
  });

  describe('toggleFavorite() — unauthenticated', () => {
    beforeEach(() => {
      currentUserSignal.set(null);
    });

    it('prompts sign-in snackbar without calling setFavorite', () => {
      const snackBar = TestBed.inject(MatSnackBar);
      const spy = vi.spyOn(snackBar, 'open').mockReturnValue({
        onAction: () => of(undefined),
      } as never);
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.toggleFavorite();
      expect(setFavorite).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith('Sign in to save favourites', 'Sign In', { duration: 4000 });
    });
  });

  it('saveSnapshot() triggers capture or navigates directly when snapshot already exists', () => {
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    triggerSnapshot.mockClear();
    component.saveSnapshot();
    expect(triggerSnapshot).toHaveBeenCalledWith('123');
    expect(component.snapshotExists()).toBe(true);
    expect(component.snapshotLoading()).toBe(false);

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    triggerSnapshot.mockClear();
    component.saveSnapshot();
    expect(triggerSnapshot).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/listing', '123', 'snapshot']);
  });

  it('saveSnapshot() handles loading guard and errors cleanly', () => {
    triggerSnapshot.mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new DetailComponent());
    component.ngOnInit();
    component.snapshotLoading.set(true);
    component.saveSnapshot();
    expect(triggerSnapshot).not.toHaveBeenCalled();

    component.snapshotLoading.set(false);
    component.saveSnapshot();
    expect(component.snapshotLoading()).toBe(false);
  });

  describe('openMarkAsRentedDialog() & markAsNotRented()', () => {
    it('opens dialog and updates listing status with contract details', () => {
      dialogAfterClosed.mockReturnValue(
        of({ lifetimeRent: false, rentPerMonth: 1200, contractExpiryDate: '2025-12-31' }),
      );
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.openMarkAsRentedDialog();
      expect(dialogOpen).toHaveBeenCalledWith(MarkAsRentedDialogComponent);
      expect(updateListingStatus).toHaveBeenCalledWith('123', {
        is_rented: true,
        lifetime_rent: false,
        rent_per_month: 1200,
        contract_expiry_date: '2025-12-31',
      });
      expect(component.listing()?.is_rented).toBe(true);
      expect(component.statusLoading()).toBe(false);
    });

    it('marks as not rented and handles errors gracefully', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.listing.set({ ...MOCK_LISTING, is_rented: true });
      component.markAsNotRented();
      expect(updateListingStatus).toHaveBeenCalledWith('123', {
        is_rented: false,
        lifetime_rent: false,
      });
      expect(component.listing()?.is_rented).toBe(false);

      updateListingStatus.mockReturnValue(throwError(() => new Error('fail')));
      component.markAsNotRented();
      expect(component.statusLoading()).toBe(false);
    });
  });

  describe('toggleHidden()', () => {
    it('toggles hidden state when authenticated and prompts sign-in when unauthenticated', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      component.isHidden.set(false);
      component.toggleHidden();
      expect(setHidden).toHaveBeenCalledWith('123', true);
      expect(component.isHidden()).toBe(true);

      currentUserSignal.set(null);
      setHidden.mockClear();
      const snackBar = TestBed.inject(MatSnackBar);
      vi.spyOn(snackBar, 'open').mockReturnValue({ onAction: () => of(undefined) } as never);
      component.toggleHidden();
      expect(setHidden).not.toHaveBeenCalled();
    });
  });

  describe('priceWentUp() / priceWentDown()', () => {
    it('evaluates history and 1-cut price_drop_amount signals', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      expect(component.priceWentUp()).toBe(false);
      expect(component.priceWentDown()).toBe(false);

      component.listing.set({
        ...MOCK_LISTING,
        price: 185000,
        price_drop_amount: 15000,
        price_history: [{ price: 185000, captured_at: '2026-02-01' }],
      });
      expect(component.priceWentDown()).toBe(true);
    });
  });

  describe('portal description & image hydration', () => {
    let getListingDescription: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      getListingDescription = vi.fn().mockReturnValue(
        of({
          description: '<p>Rich</p>',
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
    });

    it('hydrates rich description and gallery images for imovirtual, era, and casasapo URLs', () => {
      for (const url of [
        'https://www.imovirtual.com/imovel/123',
        'https://www.era.pt/comprar/apartamento-t3-423260032',
        'https://casa.sapo.pt/comprar-apartamento-t2-porto-123.html',
      ]) {
        getListing.mockReturnValueOnce(of({ ...MOCK_LISTING, url }));
        const component = TestBed.runInInjectionContext(() => new DetailComponent());
        component.ngOnInit();
        expect(getListingDescription).toHaveBeenCalledWith(url);
        expect(component.richDescription()).toBeTruthy();
        expect(component.listing()?.images[0].large).toBe('http://new/img.jpg');
      }
    });

    it('handles description error gracefully', () => {
      getListing.mockReturnValueOnce(
        of({ ...MOCK_LISTING, url: 'https://www.imovirtual.com/imovel/123' }),
      );
      getListingDescription.mockReturnValueOnce(throwError(() => new Error('fail')));
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      component.ngOnInit();
      expect(component.descriptionLoading()).toBe(false);
    });
  });

  describe('delegated domain helpers', () => {
    it('computes displayYield, yieldTooltip, estRentTooltip, mapsUrl, and confidenceColor', () => {
      const component = TestBed.runInInjectionContext(() => new DetailComponent());
      const l: ListingDetail = {
        ...MOCK_LISTING,
        price: 120000,
        is_rented: true,
        lifetime_rent: false,
        rent_current_rent: 600,
        rental_yield: 0.04,
        estimated_rent: 750,
      };
      expect(component.displayYield(l)).toBeCloseTo(0.06);
      expect(component.yieldTooltip(l)).toContain('Contract yield:');
      expect(component.estRentTooltip(l)).toBe('Market est.: 750€/mo');
      expect(component.confidenceColor('high')).toBe('green');
      expect(component.mapsUrl({ location: 'Boavista', neighborhood: null, city: null })).toContain(
        'Boavista',
      );
    });
  });
});
