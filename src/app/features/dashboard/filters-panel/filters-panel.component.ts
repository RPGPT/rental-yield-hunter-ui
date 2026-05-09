import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  OnInit,
  DestroyRef,
  WritableSignal,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FilterOptions } from '../../../core/models/filter.model';
import { FilterStateService } from '../../../core/services/filter-state.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-filters-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filters-panel.component.html',
  styleUrl: './filters-panel.component.scss',
})
export class FiltersPanelComponent implements OnInit {
  readonly filterState = inject(FilterStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  filtersExpanded = signal(window.innerWidth > 767);

  filterOptions = input<FilterOptions | null>(null);

  private priceMinSubject = new Subject<string>();
  private priceMaxSubject = new Subject<string>();
  private areaMinSubject = new Subject<string>();
  private areaMaxSubject = new Subject<string>();

  get selectedTypologies(): string[] {
    return this.filterState.typology();
  }
  get selectedCities(): string[] {
    return this.filterState.city();
  }
  get selectedNeighborhoods(): string[] {
    return this.filterState.neighborhood();
  }

  get availableNeighborhoods(): string[] {
    const opts = this.filterOptions();
    if (!opts) return [];
    const cities = this.filterState.city();
    if (!cities.length) return [];
    return cities.flatMap((c) => opts.neighborhoods[c] ?? []).sort();
  }

  get isNeighborhoodEnabled(): boolean {
    return this.filterState.city().length > 0;
  }

  get isRentedSelection(): string[] {
    return this.boolToSelection(this.filterState.isRented());
  }
  get lifetimeRentSelection(): string[] {
    return this.boolToSelection(this.filterState.lifetimeRent());
  }
  get activeSelection(): string[] {
    return this.boolToSelection(this.filterState.active());
  }

  ngOnInit(): void {
    this.priceMinSubject
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.filterState.priceMin.set(v ? Number(v) : null);
        this.resetOffset();
      });

    this.priceMaxSubject
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.filterState.priceMax.set(v ? Number(v) : null);
        this.resetOffset();
      });

    this.areaMinSubject
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.filterState.areaMin.set(v ? Number(v) : null);
        this.resetOffset();
      });

    this.areaMaxSubject
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        this.filterState.areaMax.set(v ? Number(v) : null);
        this.resetOffset();
      });
  }

  onPriceMinInput(value: string): void {
    this.priceMinSubject.next(value);
  }
  onPriceMaxInput(value: string): void {
    this.priceMaxSubject.next(value);
  }
  onAreaMinInput(value: string): void {
    this.areaMinSubject.next(value);
  }
  onAreaMaxInput(value: string): void {
    this.areaMaxSubject.next(value);
  }

  onTypologyChange(values: string[]): void {
    this.filterState.typology.set(values);
    this.resetOffset();
  }

  onCityChange(values: string[]): void {
    this.filterState.city.set(values);
    // Drop any neighborhoods that no longer belong to the selected cities
    const opts = this.filterOptions();
    if (opts) {
      const valid = new Set(values.flatMap((c) => opts.neighborhoods[c] ?? []));
      this.filterState.neighborhood.update((n) => n.filter((v) => valid.has(v)));
    } else {
      this.filterState.neighborhood.set([]);
    }
    this.resetOffset();
  }

  onNeighborhoodChange(values: string[]): void {
    this.filterState.neighborhood.set(values);
    this.resetOffset();
  }

  onBoolToggle(signal: WritableSignal<boolean | null>, values: string[]): void {
    signal.set(this.selectionToBool(values));
    this.resetOffset();
  }

  cycleFavorite(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    const current = this.filterState.isFavorite();
    this.filterState.isFavorite.set(current === null ? true : null);
    this.resetOffset();
  }

  favoriteIcon(): string {
    return this.filterState.isFavorite() === true ? 'favorite' : 'favorite_border';
  }

  favoriteTooltip(): string {
    return this.filterState.isFavorite() === true
      ? 'Showing favorites only — click to show all'
      : 'Show all — click to show favorites only';
  }

  cycleNew(): void {
    const current = this.filterState.isNew();
    this.filterState.isNew.set(current === null ? true : null);
    this.resetOffset();
  }

  newTooltip(): string {
    return this.filterState.isNew() === true
      ? 'Showing new listings (last 2 days) — click to show all'
      : 'Show all — click to show new listings only (last 2 days)';
  }

  resetFilters(): void {
    this.filterState.reset();
  }

  private resetOffset(): void {
    this.filterState.offset.set(0);
  }

  private boolToSelection(value: boolean | null): string[] {
    if (value === true) return ['true'];
    if (value === false) return ['false'];
    return [];
  }

  private selectionToBool(values: string[]): boolean | null {
    if (values.length === 0 || values.length === 2) return null;
    return values[0] === 'true';
  }
}
