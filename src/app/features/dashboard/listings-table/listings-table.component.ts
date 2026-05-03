import { Component, ChangeDetectionStrategy, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TitleCasePipe } from '@angular/common';
import { Listing } from '../../../core/models/listing.model';
import { FilterStateService } from '../../../core/services/filter-state.service';
import { ApiService } from '../../../core/services/api.service';
import { EurPipe } from '../../../shared/pipes/eur.pipe';
import { RelativeDatePipe } from '../../../shared/pipes/relative-date.pipe';
import { BadgeComponent } from '../../../shared/components/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';

@Component({
  selector: 'app-listings-table',
  standalone: true,
  imports: [
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    TitleCasePipe,
    EurPipe,
    RelativeDatePipe,
    BadgeComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listings-table.component.html',
  styleUrl: './listings-table.component.scss',
})
export class ListingsTableComponent {
  private readonly router = inject(Router);
  private readonly filterState = inject(FilterStateService);
  private readonly api = inject(ApiService);

  listings = input<Listing[]>([]);
  total = input<number>(0);
  loading = input<boolean>(false);

  favoriteOverrides = signal<Record<string, boolean>>({});

  displayedColumns = [
    'is_favorite',
    'title', 'price', 'area', 'price_per_m2', 'property_type', 'typology',
    'city', 'has_garage', 'is_rented', 'lifetime_rent', 'active',
    'first_seen', 'last_seen',
  ];

  get pageSize(): number { return this.filterState.limit(); }
  get pageIndex(): number { return this.filterState.offset() / this.filterState.limit(); }

  isFavorite(row: Listing): boolean {
    const overrides = this.favoriteOverrides();
    return row.id in overrides ? overrides[row.id] : row.is_favorite;
  }

  onFavoriteClick(event: Event, row: Listing): void {
    event.stopPropagation();
    const newValue = !this.isFavorite(row);
    this.favoriteOverrides.update(o => ({ ...o, [row.id]: newValue }));
    this.api.setFavorite(row.id, newValue).subscribe({
      next: () => {
        if (newValue) {
          this.api.triggerSnapshot(row.id).subscribe({
            next: (r) => console.log(`[snapshot] ${row.id}`, r.url),
            error: (e) => console.warn(`[snapshot] failed ${row.id}:`, e),
          });
        }
      },
      error: () => {
        this.favoriteOverrides.update(o => ({ ...o, [row.id]: !newValue }));
      },
    });
  }

  trackById(_index: number, item: Listing): string {
    return item.id;
  }

  onRowClick(listing: Listing): void {
    this.router.navigate(['/listing', listing.id]);
  }

  onTitleClick(event: Event, url: string): void {
    event.stopPropagation();
    window.open(url, '_blank');
  }

  onSortChange(sort: Sort): void {
    this.filterState.sort.set(sort.active || 'price');
    this.filterState.order.set((sort.direction || 'asc') as 'asc' | 'desc');
    this.filterState.offset.set(0);
  }

  onPageChange(event: PageEvent): void {
    this.filterState.limit.set(event.pageSize);
    this.filterState.offset.set(event.pageIndex * event.pageSize);
  }

  truncate(text: string, maxLen = 50): string {
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
  }
}
