import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Listing, ListingDetail } from '../models/listing.model';
import { Stats } from '../models/stats.model';
import { FilterOptions, FilterState, PaginatedResponse } from '../models/filter.model';
import { buildQueryParams } from '../../shared/utils/query-params.util';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  private statsCache$: Observable<Stats> | null = null;
  private filterOptionsCache$: Observable<FilterOptions> | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 30_000;

  getListings(filters: FilterState): Observable<PaginatedResponse<Listing>> {
    const params = buildQueryParams(filters);
    return this.http.get<PaginatedResponse<Listing>>(`${this.baseUrl}/listings`, {
      params: params as unknown as Record<string, string>,
    });
  }

  getListing(id: string): Observable<ListingDetail> {
    return this.http.get<ListingDetail>(`${this.baseUrl}/listings/${id}`);
  }

  getListingDescription(url: string): Observable<{
    description: string | null;
    images: { medium: string; large: string }[];
    characteristics: unknown[];
    topInformation: unknown[];
    additionalInformation: unknown[];
  }> {
    return this.http.get<{
      description: string | null;
      images: { medium: string; large: string }[];
      characteristics: unknown[];
      topInformation: unknown[];
      additionalInformation: unknown[];
    }>(`${this.baseUrl}/listings/description?url=${encodeURIComponent(url)}`);
  }

  getFavorites(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/favorites`);
  }

  setFavorite(id: string, value: boolean): Observable<void> {
    if (value) {
      return this.http.post<void>(`${this.baseUrl}/favorites?id=${id}`, null);
    } else {
      return this.http.delete<void>(`${this.baseUrl}/favorites?id=${id}`);
    }
  }

  triggerSnapshot(id: string): Observable<{ exists: boolean; url?: string }> {
    return this.http.post<{ exists: boolean; url?: string }>(
      `${this.baseUrl}/listings/snapshot?id=${id}`,
      null,
    );
  }

  getStats(): Observable<Stats> {
    const now = Date.now();
    if (!this.statsCache$ || now - this.cacheTimestamp > this.CACHE_DURATION) {
      this.cacheTimestamp = now;
      this.statsCache$ = this.http
        .get<Stats>(`${this.baseUrl}/stats`)
        .pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.statsCache$;
  }

  getFilterOptions(): Observable<FilterOptions> {
    if (!this.filterOptionsCache$) {
      this.filterOptionsCache$ = this.http
        .get<FilterOptions>(`${this.baseUrl}/filters`)
        .pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this.filterOptionsCache$;
  }
}
