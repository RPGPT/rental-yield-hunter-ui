import { Component, ChangeDetectionStrategy, inject, input, OnInit, DestroyRef, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
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

@Component({
  selector: 'app-filters-panel',
  standalone: true,
  imports: [
    FormsModule,
    TitleCasePipe,
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

  filterOptions = input<FilterOptions | null>(null);

  private priceMinSubject = new Subject<string>();
  private priceMaxSubject = new Subject<string>();
  private areaMinSubject = new Subject<string>();
  private areaMaxSubject = new Subject<string>();

  get selectedTypologies(): string[] { return this.filterState.typology(); }
  get selectedCities(): string[] { return this.filterState.city(); }
  get selectedPropertyTypes(): string[] { return this.filterState.propertyType(); }

  get hasGarageSelection(): string[] { return this.boolToSelection(this.filterState.hasGarage()); }
  get isRentedSelection(): string[] { return this.boolToSelection(this.filterState.isRented()); }
  get lifetimeRentSelection(): string[] { return this.boolToSelection(this.filterState.lifetimeRent()); }
  get activeSelection(): string[] { return this.boolToSelection(this.filterState.active()); }

  ngOnInit(): void {
    this.priceMinSubject.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(v => { this.filterState.priceMin.set(v ? Number(v) : null); this.resetOffset(); });

    this.priceMaxSubject.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(v => { this.filterState.priceMax.set(v ? Number(v) : null); this.resetOffset(); });

    this.areaMinSubject.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(v => { this.filterState.areaMin.set(v ? Number(v) : null); this.resetOffset(); });

    this.areaMaxSubject.pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(v => { this.filterState.areaMax.set(v ? Number(v) : null); this.resetOffset(); });
  }

  onPriceMinInput(value: string): void { this.priceMinSubject.next(value); }
  onPriceMaxInput(value: string): void { this.priceMaxSubject.next(value); }
  onAreaMinInput(value: string): void { this.areaMinSubject.next(value); }
  onAreaMaxInput(value: string): void { this.areaMaxSubject.next(value); }

  onTypologyChange(values: string[]): void {
    this.filterState.typology.set(values);
    this.resetOffset();
  }

  onCityChange(values: string[]): void {
    this.filterState.city.set(values);
    this.resetOffset();
  }

  onPropertyTypeChange(values: string[]): void {
    this.filterState.propertyType.set(values);
    this.resetOffset();
  }

  onBoolToggle(signal: WritableSignal<boolean | null>, values: string[]): void {
    signal.set(this.selectionToBool(values));
    this.resetOffset();
  }

  cycleFavorite(): void {
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
