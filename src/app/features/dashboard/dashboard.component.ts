import { Component, ChangeDetectionStrategy, inject, signal, effect, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ApiService } from '../../core/services/api.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { RentalFilterStateService } from '../../core/services/rental-filter-state.service';
import { FilterOptions } from '../../core/models/filter.model';
import { Listing, RentalListing } from '../../core/models/listing.model';
import { FiltersPanelComponent } from './filters-panel/filters-panel.component';
import { ListingsTableComponent } from './listings-table/listings-table.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FiltersPanelComponent, ListingsTableComponent, MatButtonToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly filterState = inject(FilterStateService);
  private readonly rentalFilterState = inject(RentalFilterStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  mode = signal<'buy' | 'rent'>('buy');
  filterOptions = signal<FilterOptions | null>(null);
  listings = signal<Listing[]>([]);
  rentalListings = signal<RentalListing[]>([]);
  total = signal(0);
  listingsLoading = signal(true);

  constructor() {
    const params = this.route.snapshot.queryParams;
    if (params['mode'] === 'rent') this.mode.set('rent');

    this.filterState.initFromParams(params);
    this.rentalFilterState.initFromParams(params);

    // Sync buy filter state to URL
    effect(() => {
      if (this.mode() !== 'buy') return;
      const queryParams = { ...this.filterState.toQueryParams(), mode: undefined };
      this.router.navigate([], { queryParams, replaceUrl: true, queryParamsHandling: 'replace' });
    });

    // Sync rent filter state to URL
    effect(() => {
      if (this.mode() !== 'rent') return;
      const queryParams = { ...this.rentalFilterState.toQueryParams(), mode: 'rent' };
      this.router.navigate([], { queryParams, replaceUrl: true, queryParamsHandling: 'replace' });
    });

    // Fetch buy listings
    effect(() => {
      if (this.mode() !== 'buy') return;
      const state = this.filterState.state();
      this.listingsLoading.set(true);
      this.api.getListings(state).subscribe({
        next: (res) => {
          this.listings.set(res.data);
          this.total.set(res.total);
          this.listingsLoading.set(false);
        },
        error: () => this.listingsLoading.set(false),
      });
    });

    // Fetch rental listings
    effect(() => {
      if (this.mode() !== 'rent') return;
      const state = this.rentalFilterState.state();
      this.listingsLoading.set(true);
      this.api.getRentalListings(state).subscribe({
        next: (res) => {
          this.rentalListings.set(res.data);
          this.total.set(res.total);
          this.listingsLoading.set(false);
        },
        error: () => this.listingsLoading.set(false),
      });
    });
  }

  ngOnInit(): void {
    this.api.getFilterOptions().subscribe({ next: (data) => this.filterOptions.set(data) });
    this.api.getRentalFilterOptions().subscribe({
      next: (data) => {
        if (this.mode() === 'rent') this.filterOptions.set(data);
      },
    });
  }

  onModeChange(newMode: 'buy' | 'rent'): void {
    this.mode.set(newMode);
    this.listingsLoading.set(true);
    this.filterOptions.set(null);
    if (newMode === 'buy') {
      this.api.getFilterOptions().subscribe({ next: (data) => this.filterOptions.set(data) });
    } else {
      this.api.getRentalFilterOptions().subscribe({ next: (data) => this.filterOptions.set(data) });
    }
  }

  get activeListings(): (Listing | RentalListing)[] {
    return this.mode() === 'rent' ? this.rentalListings() : this.listings();
  }
}
