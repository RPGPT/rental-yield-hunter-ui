import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BaseChartDirective } from 'ng2-charts';
import {
  Chart,
  ChartConfiguration,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { ApiService } from '../../core/services/api.service';
import { AnalyticsNeighborhoodRow, AnalyticsResponse } from '../../core/models/analytics.model';
import { EurPipe } from '../../shared/pipes/eur.pipe';
import { CHART_COLORS } from '../../../styles/chart-colors';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
);

type NeighborhoodSortKey = 'median_yield' | 'median_buy_pm2' | 'median_buy_price' | 'buy_count';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    BaseChartDirective,
    EurPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
})
export class AnalyticsComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  selectedCity = signal<string>('');
  selectedTypology = signal<string>('');
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  data = signal<AnalyticsResponse | null>(null);
  neighborhoodSort = signal<NeighborhoodSortKey>('median_yield');

  constructor() {
    effect((onCleanup) => {
      const city = this.selectedCity() || undefined;
      const typology = this.selectedTypology() || undefined;
      this.loading.set(true);
      this.error.set(null);

      const sub = this.api.getAnalytics({ city, typology }).subscribe({
        next: (res) => {
          this.data.set(res);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load market analytics.');
          this.loading.set(false);
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  readonly cities = computed(() => this.data()?.meta.cities ?? []);
  readonly typologies = computed(() => this.data()?.meta.typologies ?? []);

  readonly outlierTooltip = computed(() => {
    const o = this.data()?.meta.outliers;
    if (!o) return '';
    return (
      `Buy filter: ${o.buy_bounds.minArea}–${o.buy_bounds.maxArea} m², ` +
      `${o.buy_bounds.minPricePerM2.toLocaleString('pt-PT')}–${o.buy_bounds.maxPricePerM2.toLocaleString('pt-PT')} €/m² ` +
      `(${o.buy_excluded.toLocaleString('pt-PT')} of ${o.buy_total.toLocaleString('pt-PT')} excluded). ` +
      `Rent filter: ${o.rent_bounds.minArea}–${o.rent_bounds.maxArea} m², ` +
      `${o.rent_bounds.minPricePerM2}–${o.rent_bounds.maxPricePerM2} €/m² ` +
      `(${o.rent_excluded.toLocaleString('pt-PT')} of ${o.rent_total.toLocaleString('pt-PT')} excluded). ` +
      `All metrics use medians and P25–P75 interquartile ranges.`
    );
  });

  readonly pm2EvolutionData = computed<ChartConfiguration<'line'>['data']>(() => {
    const weeks = this.data()?.evolution ?? [];
    return {
      labels: weeks.map((w) => this.formatWeek(w.week)),
      datasets: [
        {
          label: 'Buy Median €/m²',
          data: weeks.map((w) => w.buy_median_pm2),
          yAxisID: 'yBuy',
          borderColor: CHART_COLORS.primary,
          backgroundColor: CHART_COLORS.primaryAlpha,
          fill: true,
          tension: 0.25,
          pointRadius: 2.5,
          spanGaps: true,
        },
        {
          label: 'Rent Median €/m²',
          data: weeks.map((w) => w.rent_median_pm2),
          yAxisID: 'yRent',
          borderColor: CHART_COLORS.success,
          backgroundColor: 'rgba(46, 125, 50, 0.1)',
          fill: false,
          tension: 0.25,
          pointRadius: 2.5,
          spanGaps: true,
        },
      ],
    };
  });

  readonly pm2EvolutionOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
    },
    scales: {
      yBuy: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'Buy (€/m²)' },
        ticks: {
          callback: (v) => `${Number(v).toLocaleString('pt-PT')}€`,
        },
      },
      yRent: {
        type: 'linear',
        position: 'right',
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Rent (€/m²)' },
        ticks: {
          callback: (v) => `${Number(v).toFixed(0)}€`,
        },
      },
    },
  };

  readonly activityEvolutionData = computed<ChartConfiguration<'bar' | 'line'>['data']>(() => {
    const weeks = this.data()?.evolution ?? [];
    return {
      labels: weeks.map((w) => this.formatWeek(w.week)),
      datasets: [
        {
          type: 'bar',
          label: 'New Buy Listings',
          data: weeks.map((w) => w.buy_new_count),
          backgroundColor: 'rgba(21, 101, 192, 0.55)',
          borderRadius: 3,
        },
        {
          type: 'bar',
          label: 'New Rentals',
          data: weeks.map((w) => w.rent_new_count),
          backgroundColor: 'rgba(46, 125, 50, 0.55)',
          borderRadius: 3,
        },
        {
          type: 'line',
          label: 'Price Drops',
          data: weeks.map((w) => w.price_drops_count),
          borderColor: CHART_COLORS.error,
          backgroundColor: CHART_COLORS.error,
          tension: 0.25,
          pointRadius: 2.5,
        },
      ],
    };
  });

  readonly activityEvolutionOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Weekly Listings / Events' },
      },
    },
  };

  readonly cityComparisonData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const rows = this.data()?.by_city ?? [];
    return {
      labels: rows.map((r) => r.city),
      datasets: [
        {
          label: 'Median Buy €/m²',
          data: rows.map((r) => r.median_buy_pm2),
          yAxisID: 'yPm2',
          backgroundColor: 'rgba(21, 101, 192, 0.72)',
          borderRadius: 4,
        },
        {
          label: 'Median Gross Yield (%)',
          data: rows.map((r) =>
            r.median_yield != null ? Number((r.median_yield * 100).toFixed(2)) : 0,
          ),
          yAxisID: 'yYield',
          backgroundColor: 'rgba(46, 125, 50, 0.72)',
          borderRadius: 4,
        },
      ],
    };
  });

  readonly cityComparisonOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: {
      yPm2: {
        type: 'linear',
        position: 'left',
        beginAtZero: true,
        title: { display: true, text: 'Buy €/m²' },
        ticks: { callback: (v) => `${Number(v).toLocaleString('pt-PT')}€` },
      },
      yYield: {
        type: 'linear',
        position: 'right',
        beginAtZero: true,
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Gross Yield (%)' },
        ticks: { callback: (v) => `${v}%` },
      },
    },
  };

  readonly typologyChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const rows = this.data()?.by_typology ?? [];
    return {
      labels: rows.map((r) => r.typology),
      datasets: [
        {
          label: 'Median Buy €/m²',
          data: rows.map((r) => r.median_buy_pm2),
          backgroundColor: 'rgba(255, 143, 0, 0.75)',
          borderRadius: 4,
        },
      ],
    };
  });

  readonly typologyChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => `${Number(v).toLocaleString('pt-PT')}€` },
      },
    },
  };

  readonly sortedNeighborhoods = computed<AnalyticsNeighborhoodRow[]>(() => {
    const rows = [...(this.data()?.top_neighborhoods ?? [])];
    const key = this.neighborhoodSort();
    return rows.sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1));
  });

  clearFilters(): void {
    this.selectedCity.set('');
    this.selectedTypology.set('');
  }

  openBuyForCity(city: string): void {
    void this.router.navigate(['/buy'], { queryParams: { city } });
  }

  openBuyForNeighborhood(row: AnalyticsNeighborhoodRow): void {
    void this.router.navigate(['/buy'], {
      queryParams: { city: row.city, neighborhood: row.neighborhood },
    });
  }

  formatYield(value: number | null): string {
    return value != null ? `${(value * 100).toFixed(2)}%` : '—';
  }

  private formatWeek(isoDate: string): string {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  }
}
