import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { provideRouter, ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
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
  source: 'imovirtual',
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
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    getRentalListing = vi.fn().mockReturnValue(of({ ...MOCK_LISTING }));
    setFavorite = vi.fn().mockReturnValue(of(undefined));
    checkSnapshot = vi.fn().mockReturnValue(of({ exists: false }));
    triggerSnapshot = vi.fn().mockReturnValue(of({ exists: true, url: '/snap/10' }));
    getListingDescription = vi.fn().mockReturnValue(
      of({
        description: '<p>Desc</p>',
        images: [{ large: 'http://new/1.jpg', medium: 'http://new/1m.jpg' }],
        characteristics: [],
        topInformation: [],
        additionalInformation: [],
      }),
    );
    currentUserSignal = signal<{ id: string } | null>({ id: 'u1' });
    paramMap$ = new BehaviorSubject(convertToParamMap({ id: '10' }));

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
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap$.asObservable(),
            snapshot: { paramMap: convertToParamMap({ id: '10' }) },
          },
        },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads rental listing on ngOnInit and reloads when route param id changes', () => {
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(getRentalListing).toHaveBeenCalledWith('10');
    expect(component.loading()).toBe(false);

    getRentalListing.mockReturnValueOnce(of({ ...MOCK_LISTING, id: '20', title: 'Rental T1' }));
    paramMap$.next(convertToParamMap({ id: '20' }));
    expect(getRentalListing).toHaveBeenCalledWith('20');
    expect(component.listing()?.id).toBe('20');
  });

  it('sets loading to false on API error', () => {
    getRentalListing.mockReturnValue(throwError(() => new Error('fail')));
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('hydrates rich description and images for imovirtual, era, and casasapo rental URLs', () => {
    for (const url of [
      'https://www.imovirtual.com/pt/anuncio/r1',
      'https://www.era.pt/arrendar/apartamento-t2-12345',
      'https://casa.sapo.pt/alugar-apartamento-t2-123.html',
    ]) {
      getRentalListing.mockReturnValueOnce(of({ ...MOCK_LISTING, url }));
      const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
      component.ngOnInit();
      expect(getListingDescription).toHaveBeenCalledWith(url);
      expect(component.richDescription()).toBeTruthy();
      expect(component.listing()?.images[0].large).toBe('http://new/1.jpg');
    }
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

  it('evaluates priceWentUp() / priceWentDown() including 1-cut price_drop_amount', () => {
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    expect(component.priceWentUp()).toBe(false);
    expect(component.priceWentDown()).toBe(false);

    component.listing.set({
      ...MOCK_LISTING,
      price: 850,
      price_drop_amount: 100,
      price_history: [{ price: 850, captured_at: '2026-01-01' }],
    });
    expect(component.priceWentDown()).toBe(true);
  });

  it('toggles favourite with rental snapshot trigger and handles unauthenticated state', () => {
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    component.toggleFavorite();
    expect(setFavorite).toHaveBeenCalledWith('10', true);
    expect(triggerSnapshot).toHaveBeenCalledWith('10', 'rental');

    currentUserSignal.set(null);
    setFavorite.mockClear();
    const snackBar = TestBed.inject(MatSnackBar);
    vi.spyOn(snackBar, 'open').mockReturnValue({ onAction: () => of(undefined) } as never);
    component.toggleFavorite();
    expect(setFavorite).not.toHaveBeenCalled();
  });

  it('saves or opens rental snapshot cleanly', () => {
    const component = TestBed.runInInjectionContext(() => new RentalDetailComponent());
    component.ngOnInit();
    component.saveSnapshot();
    expect(triggerSnapshot).toHaveBeenCalledWith('10', 'rental');
    expect(component.snapshotExists()).toBe(true);

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    triggerSnapshot.mockClear();
    component.saveSnapshot();
    expect(triggerSnapshot).not.toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/rental', '10', 'snapshot']);
  });
});
