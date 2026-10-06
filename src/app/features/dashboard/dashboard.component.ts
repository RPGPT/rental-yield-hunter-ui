import { Component, ChangeDetectionStrategy, inject, signal, effect, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { RentalFilterStateService } from '../../core/services/rental-filter-state.service';
import { FilterOptions } from '../../core/models/filter.model';
import { Listing, RentalListing } from '../../core/models/listing.model';
import { FiltersPanelComponent } from './filters-panel/filters-panel.component';
import { ListingsTableComponent } from './listings-table/listings-table.component';
import { MatDialog } from '@angular/material/dialog';
import { CreateManualListing } from '../create-manual-listing/create-manual-listing';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FiltersPanelComponent, ListingsTableComponent, MatIconButton, MatIcon],
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
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  mode = signal<'buy' | 'rent'>('buy');
  filterOptions = signal<FilterOptions | null>(null);
  listings = signal<Listing[]>([]);
  rentalListings = signal<RentalListing[]>([]);
  total = signal(0);
  listingsLoading = signal(true);

  constructor() {
    const routeMode = (this.route.snapshot.data['mode'] as 'buy' | 'rent') ?? 'buy';
    this.mode.set(routeMode);

    const params = this.route.snapshot.queryParams;
    if (routeMode === 'buy') {
      this.filterState.initFromParams(params);
    } else {
      this.rentalFilterState.initFromParams(params);
    }

    // Sync buy filter state to URL query params
    effect(() => {
      if (this.mode() !== 'buy') return;
      const queryParams = this.filterState.toQueryParams();
      this.router.navigate([], { queryParams, replaceUrl: true, queryParamsHandling: 'replace' });
    });

    // Sync rent filter state to URL query params
    effect(() => {
      if (this.mode() !== 'rent') return;
      const queryParams = this.rentalFilterState.toQueryParams();
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
    if (this.mode() === 'buy') {
      this.api.getFilterOptions().subscribe({ next: (data) => this.filterOptions.set(data) });
    } else {
      this.api.getRentalFilterOptions().subscribe({ next: (data) => this.filterOptions.set(data) });
    }
  }

  onCreateNewListing() {
    const dialogRef = this.dialog.open(CreateManualListing, {
      width: '520px',
      autoFocus: false,
      data: { neighborhoods: this.filterOptions()?.neighborhoods },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.api.createListing(result).subscribe({
          next: (newListing) => {
            this.listings.update((list) => [newListing, ...list]);
            this.total.update((t) => t + 1);
          },
        });
      }
    });
  }

  onModeChange(newMode: 'buy' | 'rent'): void {
    void this.router.navigate([newMode === 'buy' ? '/buy' : '/rent']);
  }

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  get activeListings(): (Listing | RentalListing)[] {
    return this.mode() === 'rent' ? this.rentalListings() : this.listings();
  }
}
