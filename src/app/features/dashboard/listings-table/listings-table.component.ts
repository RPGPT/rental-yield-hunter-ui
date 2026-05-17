import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  signal,
  computed,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Listing, RentalListing } from '../../../core/models/listing.model';
import { FilterStateService } from '../../../core/services/filter-state.service';
import { RentalFilterStateService } from '../../../core/services/rental-filter-state.service';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { EurPipe } from '../../../shared/pipes/eur.pipe';
import { RelativeDatePipe } from '../../../shared/pipes/relative-date.pipe';
import { BadgeComponent } from '../../../shared/components/badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';

export type ListingColumn = string;

const TITLE_MAX_LENGTH = 50;

const BUY_COLUMNS: ListingColumn[] = [
  'is_favorite',
  'is_hidden',
  'title',
  'price',
  'area',
  'price_per_m2',
  'typology',
  'neighborhood',
  'city',
  'is_rented',
  'active',
  'first_seen',
  'last_seen',
];

const RENT_COLUMNS: ListingColumn[] = [
  'is_favorite',
  'title',
  'price',
  'area',
  'rent_price_per_m2',
  'typology',
  'neighborhood',
  'city',
  'active',
  'first_seen',
  'last_seen',
];

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
  private readonly rentalFilterState = inject(RentalFilterStateService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  listings = input<(Listing | RentalListing)[]>([]);
  total = input<number>(0);
  loading = input<boolean>(false);
  mode = input<'buy' | 'rent'>('buy');

  favoriteOverrides = signal<Record<string, boolean>>({});
  hiddenOverrides = signal<Record<string, boolean>>({});
  private hiddenFromFilter = signal<Set<string>>(new Set());

  visibleListings = computed(() => {
    const hidden = this.hiddenFromFilter();
    return hidden.size === 0 ? this.listings() : this.listings().filter((l) => !hidden.has(l.id));
  });

  displayedColumns = computed<ListingColumn[]>(() =>
    this.mode() === 'rent' ? RENT_COLUMNS : BUY_COLUMNS,
  );

  constructor() {
    effect(() => {
      this.listings();
      this.hiddenFromFilter.set(new Set());
      this.favoriteOverrides.set({});
      this.hiddenOverrides.set({});
    });
  }

  private get fs() {
    return this.mode() === 'rent' ? this.rentalFilterState : this.filterState;
  }

  get pageSize(): number {
    return this.fs.limit();
  }
  get pageIndex(): number {
    return this.fs.offset() / this.fs.limit();
  }

  isFavorite(row: Listing | RentalListing): boolean {
    const overrides = this.favoriteOverrides();
    return row.id in overrides ? overrides[row.id] : row.is_favorite;
  }

  isHidden(row: Listing | RentalListing): boolean {
    const overrides = this.hiddenOverrides();
    return row.id in overrides ? overrides[row.id] : ((row as Listing).is_hidden ?? false);
  }

  onFavoriteClick(event: Event, row: Listing | RentalListing): void {
    event.stopPropagation();

    if (!this.auth.isAuthenticated()) {
      this.snackBar
        .open('Sign in to save favourites', 'Sign In', { duration: 4000 })
        .onAction()
        .subscribe(() => this.router.navigate(['/login']));
      return;
    }

    const newValue = !this.isFavorite(row);
    this.favoriteOverrides.update((o) => ({ ...o, [row.id]: newValue }));
    this.api.setFavorite(row.id, newValue).subscribe({
      next: () => {
        if (!newValue && this.fs.isFavorite() === true) {
          this.hiddenFromFilter.update((s) => new Set([...s, row.id]));
        }
        if (newValue) {
          const source = this.mode() === 'rent' ? 'rental' : undefined;
          this.api.triggerSnapshot(row.id, source).subscribe({
            next: (r) => console.log(`[snapshot] ${row.id}`, r.url),
            error: (e) => console.warn(`[snapshot] failed ${row.id}:`, e),
          });
        }
      },
      error: () => this.favoriteOverrides.update((o) => ({ ...o, [row.id]: !newValue })),
    });
  }

  onHiddenClick(event: Event, row: Listing | RentalListing): void {
    event.stopPropagation();

    if (!this.auth.isAuthenticated()) {
      this.snackBar
        .open('Sign in to hide listings', 'Sign In', { duration: 4000 })
        .onAction()
        .subscribe(() => this.router.navigate(['/login']));
      return;
    }

    const newValue = !this.isHidden(row);
    this.hiddenOverrides.update((o) => ({ ...o, [row.id]: newValue }));
    this.api.setHidden(row.id, newValue).subscribe({
      next: () => {
        if (newValue && (this.fs as FilterStateService).isHidden() !== true) {
          this.hiddenFromFilter.update((s) => new Set([...s, row.id]));
        }
      },
      error: () => this.hiddenOverrides.update((o) => ({ ...o, [row.id]: !newValue })),
    });
  }

  trackById(_index: number, item: Listing | RentalListing): string {
    return item.id;
  }

  onRowClick(listing: Listing | RentalListing): void {
    const route = this.mode() === 'rent' ? '/rental' : '/listing';
    this.router.navigate([route, listing.id]);
  }

  onTitleClick(event: Event, url: string): void {
    event.stopPropagation();
    window.open(url, '_blank');
  }

  onSortChange(sort: Sort): void {
    this.fs.sort.set(sort.active || 'price');
    this.fs.order.set((sort.direction || 'asc') as 'asc' | 'desc');
    this.fs.offset.set(0);
  }

  onPageChange(event: PageEvent): void {
    this.fs.limit.set(event.pageSize);
    this.fs.offset.set(event.pageIndex * event.pageSize);
  }

  truncate(text: string): string {
    return text.length > TITLE_MAX_LENGTH ? text.substring(0, TITLE_MAX_LENGTH) + '…' : text;
  }

  typologyColor(typology: string): 'red' | 'amber' | 'green' | 'grey' | 'blue' {
    const match = typology.match(/^T(\d+)$/);
    if (!match) return 'grey';
    const n = Number(match[1]);
    if (n === 1) return 'blue';
    if (n === 2) return 'amber';
    if (n >= 3) return 'green';
    return 'grey';
  }
}
