import { Component, ChangeDetectionStrategy, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api.service';
import { FilterStateService } from '../../../core/services/filter-state.service';
import { RentalFilterStateService } from '../../../core/services/rental-filter-state.service';
import { SavedSearch } from '../../../core/models/saved-search.model';
import { BadgeComponent } from '../../../shared/components/badge.component';

@Component({
  selector: 'app-saved-searches',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './saved-searches.component.html',
  styleUrl: './saved-searches.component.scss',
})
export class SavedSearchesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly buyState = inject(FilterStateService);
  private readonly rentState = inject(RentalFilterStateService);

  mode = input<'buy' | 'rent'>('buy');
  searches = signal<SavedSearch[]>([]);

  ngOnInit(): void {
    this.api.getSavedSearches().subscribe({
      next: (list) => this.searches.set(list),
      error: () => this.searches.set([]),
    });
  }

  save(): void {
    const name = window.prompt('Name this search')?.trim();
    if (!name) return;
    const state = this.mode() === 'buy' ? this.buyState : this.rentState;
    const filters = { ...state.toQueryParams(), mode: this.mode() } as Record<string, string>;
    this.api.createSavedSearch(name, filters).subscribe({
      next: (created) => this.searches.update((l) => [created, ...l]),
    });
  }

  apply(search: SavedSearch): void {
    const { mode = 'buy', ...params } = search.filters;
    if (mode === this.mode()) {
      const state = mode === 'buy' ? this.buyState : this.rentState;
      state.reset();
      state.initFromParams(params);
    } else {
      void this.router.navigate([mode === 'buy' ? '/buy' : '/rent'], { queryParams: params });
    }
    this.api.markSavedSearchChecked(search.id).subscribe({
      next: () =>
        this.searches.update((l) =>
          l.map((s) => (s.id === search.id ? { ...s, new_matches: 0, price_drops: 0 } : s)),
        ),
    });
  }

  remove(search: SavedSearch): void {
    this.api.deleteSavedSearch(search.id).subscribe({
      next: () => this.searches.update((l) => l.filter((s) => s.id !== search.id)),
    });
  }
}
