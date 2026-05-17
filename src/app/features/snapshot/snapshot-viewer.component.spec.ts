import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MockProvider } from 'ng-mocks';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SnapshotViewerComponent } from './snapshot-viewer.component';
import { ApiService } from '../../core/services/api.service';

vi.mock('../../../environments/environment', () => ({
  environment: {
    production: false,
    apiUrl: '/api',
    neonAuthUrl: 'http://fake',
    devBypassAuth: false,
  },
}));

describe('SnapshotViewerComponent', () => {
  let getListing: ReturnType<typeof vi.fn>;
  let getRentalListing: ReturnType<typeof vi.fn>;

  function buildRoute(path: string, id: string) {
    return {
      snapshot: {
        paramMap: { get: () => id },
        url: [{ path }],
      },
    };
  }

  function setup(routePath: string = 'listing', id: string = '123') {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        MockProvider(ApiService, { getListing, getRentalListing } as Partial<ApiService>),
        { provide: ActivatedRoute, useValue: buildRoute(routePath, id) },
      ],
    });
    return TestBed.runInInjectionContext(() => new SnapshotViewerComponent());
  }

  beforeEach(() => {
    getListing = vi.fn().mockReturnValue(of({ title: 'Buy Listing' }));
    getRentalListing = vi.fn().mockReturnValue(of({ title: 'Rental Listing' }));
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('initializes iframeUrl with buy listing URL on ngOnInit', () => {
    const component = setup('listing', '42');
    component.ngOnInit();
    expect(component.iframeUrl()).toBeTruthy();
  });

  it('calls getListing for non-rental path', () => {
    const component = setup('listing', '42');
    component.ngOnInit();
    expect(getListing).toHaveBeenCalledWith('42');
  });

  it('sets listingTitle from getListing response', () => {
    getListing.mockReturnValue(of({ title: 'Test Title', price: 1000 }));
    const component = setup('listing', '42');
    component.ngOnInit();
    expect(component.listingTitle()).toBe('Test Title');
  });

  it('sets listingTitle to null on getListing error', () => {
    getListing.mockReturnValue(throwError(() => new Error('fail')));
    const component = setup('listing', '42');
    component.ngOnInit();
    expect(component.listingTitle()).toBeNull();
  });

  it('calls getRentalListing for rental path', () => {
    const component = setup('rental', '99');
    component.ngOnInit();
    expect(getRentalListing).toHaveBeenCalledWith('99');
  });

  it('sets listingTitle from getRentalListing response', () => {
    getRentalListing.mockReturnValue(of({ title: 'Rental Title', price: 800 }));
    const component = setup('rental', '99');
    component.ngOnInit();
    expect(component.listingTitle()).toBe('Rental Title');
  });

  it('sets listingTitle to null on getRentalListing error', () => {
    getRentalListing.mockReturnValue(throwError(() => new Error('fail')));
    const component = setup('rental', '99');
    component.ngOnInit();
    expect(component.listingTitle()).toBeNull();
  });

  it('includes &source=rental in iframeUrl for rental path', () => {
    const component = setup('rental', '99');
    component.ngOnInit();
    const url = String(component.iframeUrl());
    // The URL should contain source=rental
    expect(url).toContain('source=rental');
  });

  it('onIframeLoad() sets loading to false', () => {
    const component = setup('listing', '42');
    component.ngOnInit();
    expect(component.loading()).toBe(true);
    component.onIframeLoad();
    expect(component.loading()).toBe(false);
  });

  it('goBack() navigates to /listing/:id for buy path', () => {
    const component = setup('listing', '42');
    component.ngOnInit();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.goBack();
    expect(navSpy).toHaveBeenCalledWith(['/listing', '42']);
  });

  it('goBack() navigates to /rental/:id for rental path', () => {
    const component = setup('rental', '99');
    component.ngOnInit();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.goBack();
    expect(navSpy).toHaveBeenCalledWith(['/rental', '99']);
  });
});
