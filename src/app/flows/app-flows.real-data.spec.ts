import 'dotenv/config';
import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  HttpBackend,
  HttpEvent,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, from, switchMap, of, throwError } from 'rxjs';
import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.disableWarningInBrowsers = true;

import { routes } from '../app.routes';
import { authInterceptor } from '../core/interceptors/auth.interceptor';
import { errorInterceptor } from '../core/interceptors/error.interceptor';
import { AuthService } from '../core/services/auth.service';
import { FilterStateService } from '../core/services/filter-state.service';
import { RentalFilterStateService } from '../core/services/rental-filter-state.service';
import { DashboardComponent } from '../features/dashboard/dashboard.component';
import { DetailComponent } from '../features/detail/detail.component';
import { RentalDetailComponent } from '../features/rental-detail/rental-detail.component';
import { SavedSearchesComponent } from '../features/dashboard/saved-searches/saved-searches.component';

import { MockRes } from '../../../api/_test/mock-res';
import filtersHandler from '../../../api/filters';
import rentalFiltersHandler from '../../../api/rental-filters';
import statsHandler from '../../../api/stats';
import listingsHandler from '../../../api/listings/index';
import listingByIdHandler from '../../../api/listings/[id]';
import rentalListingsHandler from '../../../api/rental-listings/index';
import rentalListingByIdHandler from '../../../api/rental-listings/[id]';
import favoritesHandler from '../../../api/favorites/index';
import hiddenHandler from '../../../api/hidden/index';

const REAL_DB_URL = process.env['DATABASE_URL'] ?? '';
const HAS_REAL_DB = Boolean(REAL_DB_URL && !REAL_DB_URL.includes('mock'));

function makeUserJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.sig`;
}

/**
 * In-process HttpBackend that routes Angular HttpClient `/api/*` requests directly
 * into the real serverless TypeScript handlers backed by Neon Postgres.
 */
class RealApiHttpBackend implements HttpBackend {
  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    return from(this.dispatch(req)).pipe(
      switchMap((res) => {
        if (res._status >= 400) {
          return throwError(
            () =>
              new HttpErrorResponse({
                error: res._body,
                status: res._status,
                url: req.urlWithParams,
              }),
          );
        }
        return of(
          new HttpResponse({
            status: res._status,
            body: res._body,
            headers: new HttpHeaders(),
            url: req.urlWithParams,
          }),
        );
      }),
    );
  }

  private async dispatch(req: HttpRequest<unknown>): Promise<MockRes> {
    const parsed = new URL(req.urlWithParams, 'http://localhost');
    const query: Record<string, string | undefined> = {};
    parsed.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    req.params.keys().forEach((k) => {
      const val = req.params.get(k);
      if (val != null) query[k] = val;
    });

    const headers: Record<string, string> = {};
    req.headers.keys().forEach((k) => {
      const val = req.headers.get(k);
      if (val != null) headers[k.toLowerCase()] = val;
    });

    const fakeReq: any = {
      method: req.method,
      query,
      headers,
      cookies: {},
      body: req.body,
    };
    const fakeRes = new MockRes();
    const pathname = parsed.pathname;

    if (pathname === '/api/listings') {
      await listingsHandler(fakeReq, fakeRes as any);
    } else if (pathname === '/api/listings/description') {
      // Avoid external portal scraping flakiness in DB flow tests; return fast empty hydration
      fakeRes.status(200).json({
        description: null,
        images: [],
        characteristics: [],
        topInformation: [],
        additionalInformation: [],
      });
    } else if (pathname === '/api/listings/snapshot') {
      fakeRes.status(200).json({ exists: false });
    } else if (pathname.startsWith('/api/listings/')) {
      fakeReq.query = { ...query, id: pathname.replace('/api/listings/', '') };
      await listingByIdHandler(fakeReq, fakeRes as any);
    } else if (pathname === '/api/filters') {
      await filtersHandler(fakeReq, fakeRes as any);
    } else if (pathname === '/api/rental-filters') {
      await rentalFiltersHandler(fakeReq, fakeRes as any);
    } else if (pathname === '/api/rental-listings') {
      await rentalListingsHandler(fakeReq, fakeRes as any);
    } else if (pathname.startsWith('/api/rental-listings/')) {
      fakeReq.query = { ...query, id: pathname.replace('/api/rental-listings/', '') };
      await rentalListingByIdHandler(fakeReq, fakeRes as any);
    } else if (pathname === '/api/favorites') {
      await favoritesHandler(fakeReq, fakeRes as any);
    } else if (pathname === '/api/hidden') {
      await hiddenHandler(fakeReq, fakeRes as any);
    } else if (pathname === '/api/stats') {
      await statsHandler(fakeReq, fakeRes as any);
    } else {
      fakeRes.status(404).json({ error: 'Not found' });
    }

    return fakeRes;
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for async UI state');
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

describe.skipIf(!HAS_REAL_DB)(
  'Full-Stack Angular Flows with Real Neon Data',
  { timeout: 30_000 },
  () => {
    const sql = HAS_REAL_DB ? neon(REAL_DB_URL) : (null as never);
    const ephemeralUserId = `e2e-ui-${randomUUID()}`;
    const ephemeralToken = makeUserJwt({
      id: ephemeralUserId,
      email: 'e2e-ui@test.local',
      name: 'E2E UI User',
    });

    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem(
        'auth_user',
        JSON.stringify({
          id: ephemeralUserId,
          email: 'e2e-ui@test.local',
          name: 'E2E UI User',
          picture: null,
          role: 'user',
        }),
      );
      localStorage.setItem('auth_token', ephemeralToken);

      TestBed.configureTestingModule({
        imports: [NoopAnimationsModule],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter(routes),
          provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
          { provide: HttpBackend, useClass: RealApiHttpBackend },
        ],
      });

      // Ensure AuthService uses our isolated ephemeral user token
      const auth = TestBed.inject(AuthService);
      expect(auth.currentUser()?.id).toBe(ephemeralUserId);
    });

    afterAll(async () => {
      if (!HAS_REAL_DB) return;
      await sql`DELETE FROM user_favorites WHERE user_id = ${ephemeralUserId}`;
      await sql`DELETE FROM user_hidden WHERE user_id = ${ephemeralUserId}`;
      await sql`DELETE FROM saved_searches WHERE user_id = ${ephemeralUserId}`;
    });

    it('UI Flow 1: boots /buy dashboard with real listings & filter options, applies real filters, and syncs URL', async () => {
      const harness = await RouterTestingHarness.create();
      const dashboard = await harness.navigateByUrl('/buy', DashboardComponent);
      const filterState = TestBed.inject(FilterStateService);
      const router = TestBed.inject(Router);

      await waitUntil(() => !dashboard.listingsLoading() && dashboard.filterOptions() !== null);

      expect(dashboard.listings().length).toBeGreaterThan(0);
      expect(dashboard.total()).toBeGreaterThan(0);
      const cities = dashboard.filterOptions()!.cities;
      expect(cities.length).toBeGreaterThan(0);

      const chosenCity = cities.includes('Porto') ? 'Porto' : cities[0];
      filterState.city.set([chosenCity]);
      filterState.deduplicate.set(true);
      TestBed.flushEffects();

      await waitUntil(
        () =>
          !dashboard.listingsLoading() && dashboard.listings().every((l) => l.city === chosenCity),
      );

      expect(router.url).toContain(`city=${encodeURIComponent(chosenCity)}`);
      expect(router.url).toContain('deduplicate=true');
      expect(dashboard.listings().length).toBeGreaterThan(0);
    });

    it('UI Flow 2: opens real buy listing detail (/listing/:id) and loads real metadata & price history', async () => {
      const harness = await RouterTestingHarness.create();
      const dashboard = await harness.navigateByUrl('/buy?limit=5', DashboardComponent);
      await waitUntil(() => !dashboard.listingsLoading() && dashboard.listings().length >= 2);

      const first = dashboard.listings()[0];
      const second = dashboard.listings()[1];

      const detail = await harness.navigateByUrl(`/listing/${first.id}`, DetailComponent);
      await waitUntil(() => !detail.loading() && detail.listing() !== null);

      expect(detail.listing()!.id).toBe(first.id);
      expect(detail.listing()!.title).toBe(first.title);

      // Navigate directly from /listing/:first to /listing/:second (same component route!)
      const detail2 = await harness.navigateByUrl(`/listing/${second.id}`, DetailComponent);
      await waitUntil(() => !detail2.loading() && detail2.listing()?.id === second.id);
      expect(detail2.listing()!.id).toBe(second.id);
    });

    it('UI Flow 3: boots /rent dashboard with real rental listings and navigates to /rental/:id', async () => {
      const harness = await RouterTestingHarness.create();
      const dashboard = await harness.navigateByUrl('/rent?limit=5', DashboardComponent);
      const rentalState = TestBed.inject(RentalFilterStateService);

      await waitUntil(() => !dashboard.listingsLoading() && dashboard.filterOptions() !== null);
      expect(dashboard.mode()).toBe('rent');
      expect(dashboard.rentalListings().length).toBeGreaterThan(0);

      const rentCities = dashboard.filterOptions()!.cities;
      const chosenCity = rentCities.includes('Porto') ? 'Porto' : rentCities[0];
      rentalState.city.set([chosenCity]);
      TestBed.flushEffects();

      await waitUntil(
        () =>
          !dashboard.listingsLoading() &&
          dashboard.rentalListings().every((r) => r.city === chosenCity),
      );

      const targetRental = dashboard.rentalListings()[0];
      const rentalDetail = await harness.navigateByUrl(
        `/rental/${targetRental.id}`,
        RentalDetailComponent,
      );
      await waitUntil(() => !rentalDetail.loading() && rentalDetail.listing() !== null);
      expect(rentalDetail.listing()!.id).toBe(targetRental.id);
    });

    it('UI Flow 4: saves search, applies saved search cleanly across modes, and toggles favourites on real data', async () => {
      const harness = await RouterTestingHarness.create();
      const dashboard = await harness.navigateByUrl('/buy?limit=5', DashboardComponent);
      const buyState = TestBed.inject(FilterStateService);
      await waitUntil(() => !dashboard.listingsLoading() && dashboard.listings().length > 0);

      const targetListing = dashboard.listings()[0];

      // Create a saved search component instance and persist a real search
      const savedFixture = TestBed.createComponent(SavedSearchesComponent);
      savedFixture.detectChanges();
      await waitUntil(() => savedFixture.componentInstance.searches() !== null);

      // Simulate polluted filter state in buy mode, switch to rent mode, then apply buy saved search
      buyState.priceMin.set(999999);
      buyState.city.set(['Porto']);
      const savedComp = savedFixture.componentInstance;
      savedFixture.componentRef.setInput('mode', 'rent');

      const createdSearch = await new Promise<any>((resolve) => {
        TestBed.inject(DashboardComponent as never, null, { optional: true });
        savedComp['api']
          .createSavedSearch('E2E Saved Buy', { mode: 'buy', typology: 'T2' })
          .subscribe(resolve);
      });
      savedComp.searches.set([createdSearch]);

      // Applying buy saved search from rent mode should reset stale priceMin=999999
      savedComp.apply(createdSearch);
      expect(buyState.priceMin()).toBeNull();
      expect(buyState.typology()).toEqual(['T2']);
      await waitUntil(() => savedComp.searches()[0]?.new_matches === 0);

      // Clean up saved search via component
      savedComp.remove(createdSearch);
      await waitUntil(() => savedComp.searches().length === 0);

      // Toggle favourite via DetailComponent and verify persistence
      const detail = await harness.navigateByUrl(`/listing/${targetListing.id}`, DetailComponent);
      await waitUntil(() => !detail.loading());
      expect(detail.isFavorite()).toBe(false);

      detail.toggleFavorite();
      await waitUntil(() => !detail.favLoading() && detail.isFavorite() === true);

      // Toggle back off
      detail.toggleFavorite();
      await waitUntil(() => !detail.favLoading() && detail.isFavorite() === false);
    });
  },
);
