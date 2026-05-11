import { Component, ChangeDetectionStrategy, inject, signal, effect, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { FilterOptions } from '../../core/models/filter.model';
import { Listing } from '../../core/models/listing.model';
import { FiltersPanelComponent } from './filters-panel/filters-panel.component';
import { ListingsTableComponent } from './listings-table/listings-table.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FiltersPanelComponent, ListingsTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly filterState = inject(FilterStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  filterOptions = signal<FilterOptions | null>(null);
  listings = signal<Listing[]>([]);
  total = signal(0);
  listingsLoading = signal(true);

  constructor() {
    this.filterState.initFromParams(this.route.snapshot.queryParams);

    effect(() => {
      const queryParams = this.filterState.toQueryParams();
      this.router.navigate([], { queryParams, replaceUrl: true, queryParamsHandling: 'replace' });
    });

    effect(() => {
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
  }

  ngOnInit(): void {
    this.api.getFilterOptions().subscribe({
      next: (data) => this.filterOptions.set(data),
    });
  }
}
