import { Component, ChangeDetectionStrategy, inject, signal, effect, OnInit } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { FilterStateService } from '../../core/services/filter-state.service';
import { Stats } from '../../core/models/stats.model';
import { FilterOptions } from '../../core/models/filter.model';
import { Listing } from '../../core/models/listing.model';
import { StatsBarComponent } from './stats-bar/stats-bar.component';
import { FiltersPanelComponent } from './filters-panel/filters-panel.component';
import { ListingsTableComponent } from './listings-table/listings-table.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [StatsBarComponent, FiltersPanelComponent, ListingsTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly filterState = inject(FilterStateService);

  stats = signal<Stats | null>(null);
  statsLoading = signal(true);
  filterOptions = signal<FilterOptions | null>(null);
  listings = signal<Listing[]>([]);
  total = signal(0);
  listingsLoading = signal(true);

  constructor() {
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
    this.api.getStats().subscribe({
      next: (data) => { this.stats.set(data); this.statsLoading.set(false); },
      error: () => this.statsLoading.set(false),
    });

    this.api.getFilterOptions().subscribe({
      next: (data) => this.filterOptions.set(data),
    });
  }
}


