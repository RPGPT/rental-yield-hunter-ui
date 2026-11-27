import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
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
import { AnalyticsResponse } from '../../core/models/analytics.model';
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
  private readonly destroyRef = inject(DestroyRef);

  selectedCity = signal<string>('');
  selectedTypology = signal<string>('');
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  data = signal<AnalyticsResponse | null>(null);
  isDark = signal<boolean>(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark-theme'),
  );

  constructor() {
    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        this.isDark.set(document.documentElement.classList.contains('dark-theme'));
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
      this.destroyRef.onDestroy(() => observer.disconnect());
    }

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
  readonly scopeLabel = computed(() => this.selectedCity() || 'All Cities');

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

  private readonly chartTextColor = computed(() =>
    this.isDark() ? 'rgba(255, 255, 255, 0.85)' : '#2a1f1a',
  );
  private readonly chartGridColor = computed(() =>
    this.isDark() ? 'rgba(255, 255, 255, 0.12)' : 'rgba(42, 31, 26, 0.1)',
  );

  readonly pm2EvolutionData = computed<ChartConfiguration<'line'>['data']>(() => {
    const months = this.data()?.evolution ?? [];
    return {
      labels: months.map((m) => this.formatMonth(m.month)),
      datasets: [
        {
          label: 'Buy Median €/m²',
          data: months.map((m) => m.buy_median_pm2),
          yAxisID: 'yBuy',
          borderColor: CHART_COLORS.primary,
          backgroundColor: CHART_COLORS.primaryAlpha,
          fill: true,
          tension: 0.25,
          pointRadius: 4,
          spanGaps: true,
        },
        {
          label: 'Rent Median €/m²',
          data: months.map((m) => m.rent_median_pm2),
          yAxisID: 'yRent',
          borderColor: CHART_COLORS.success,
          backgroundColor: 'rgba(46, 125, 50, 0.1)',
          fill: false,
          tension: 0.25,
          pointRadius: 4,
          spanGaps: true,
        },
      ],
    };
  });

  readonly pm2EvolutionOptions = computed<ChartConfiguration<'line'>['options']>(() => {
    const text = this.chartTextColor();
    const grid = this.chartGridColor();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { color: text } },
      },
      scales: {
        x: { ticks: { color: text }, grid: { color: grid } },
        yBuy: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Buy (€/m²)', color: text },
          ticks: { color: text, callback: (v) => `${Number(v).toLocaleString('pt-PT')}€` },
          grid: { color: grid },
        },
        yRent: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Rent (€/m²)', color: text },
          ticks: { color: text, callback: (v) => `${Number(v).toFixed(0)}€` },
        },
      },
    };
  });

  readonly activityEvolutionData = computed<ChartConfiguration<'line'>['data']>(() => {
    const months = this.data()?.evolution ?? [];
    return {
      labels: months.map((m) => this.formatMonth(m.month)),
      datasets: [
        {
          label: 'New Buy Listings',
          data: months.map((m) => m.buy_new_count),
          yAxisID: 'yBuy',
          borderColor: CHART_COLORS.primary,
          backgroundColor: CHART_COLORS.primaryAlpha,
          fill: true,
          tension: 0.25,
          pointRadius: 4,
          spanGaps: true,
        },
        {
          label: 'New Rentals',
          data: months.map((m) => m.rent_new_count),
          yAxisID: 'yRent',
          borderColor: CHART_COLORS.success,
          backgroundColor: 'rgba(46, 125, 50, 0.1)',
          fill: false,
          tension: 0.25,
          pointRadius: 4,
          spanGaps: true,
        },
      ],
    };
  });

  readonly activityEvolutionOptions = computed<ChartConfiguration<'line'>['options']>(() => {
    const text = this.chartTextColor();
    const grid = this.chartGridColor();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { color: text } },
      },
      scales: {
        x: { ticks: { color: text }, grid: { color: grid } },
        yBuy: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'New Buy Listings', color: text },
          ticks: { color: text },
          grid: { color: grid },
        },
        yRent: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'New Rentals', color: text },
          ticks: { color: text },
        },
      },
    };
  });

  readonly activeTypologyChartData = computed<ChartConfiguration<'bar'>['data']>(() =>
    this.buildTypologyPriceRentData(this.data()?.by_typology ?? []),
  );

  readonly inactiveTypologyChartData = computed<ChartConfiguration<'bar'>['data']>(() =>
    this.buildTypologyPriceRentData(this.data()?.by_typology_inactive ?? []),
  );

  private buildTypologyPriceRentData(
    rows: AnalyticsResponse['by_typology'],
  ): ChartConfiguration<'bar'>['data'] {
    return {
      labels: rows.map((r) => r.typology),
      datasets: [
        {
          label: 'Median Buy Price (€)',
          data: rows.map((r) => r.median_buy_price),
          yAxisID: 'yBuyPrice',
          backgroundColor: 'rgba(21, 101, 192, 0.72)',
          borderRadius: 4,
        },
        {
          label: 'Median Rent (€/mo)',
          data: rows.map((r) => r.median_rent_price ?? 0),
          yAxisID: 'yRentPrice',
          backgroundColor: 'rgba(46, 125, 50, 0.75)',
          borderRadius: 4,
        },
      ],
    };
  }

  readonly typologyPriceRentOptions = computed<ChartConfiguration<'bar'>['options']>(() => {
    const text = this.chartTextColor();
    const grid = this.chartGridColor();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: text } } },
      scales: {
        x: { ticks: { color: text }, grid: { color: grid } },
        yBuyPrice: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'Buy Price (€)', color: text },
          ticks: { color: text, callback: (v) => `${Math.round(Number(v) / 1000)}k€` },
          grid: { color: grid },
        },
        yRentPrice: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Rent (€/mo)', color: text },
          ticks: { color: text, callback: (v) => `${Number(v).toLocaleString('pt-PT')}€` },
        },
      },
    };
  });

  readonly cityComparisonData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const rows = this.data()?.by_city ?? [];
    return {
      labels: rows.map((r) => r.city),
      datasets: [
        {
          label: 'Median Buy €/m²',
          data: rows.map((r) => r.median_buy_pm2),
          yAxisID: 'yBuyPm2',
          backgroundColor: 'rgba(21, 101, 192, 0.72)',
          borderRadius: 4,
        },
        {
          label: 'Median Rent €/m²',
          data: rows.map((r) => r.median_rent_pm2 ?? 0),
          yAxisID: 'yRentPm2',
          backgroundColor: 'rgba(46, 125, 50, 0.72)',
          borderRadius: 4,
        },
      ],
    };
  });

  readonly cityComparisonOptions = computed<ChartConfiguration<'bar'>['options']>(() => {
    const text = this.chartTextColor();
    const grid = this.chartGridColor();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: text } } },
      scales: {
        x: { ticks: { color: text }, grid: { color: grid } },
        yBuyPm2: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'Buy (€/m²)', color: text },
          ticks: { color: text, callback: (v) => `${Number(v).toLocaleString('pt-PT')}€` },
          grid: { color: grid },
        },
        yRentPm2: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Rent (€/m²)', color: text },
          ticks: { color: text, callback: (v) => `${Number(v).toFixed(0)}€` },
        },
      },
    };
  });

  clearFilters(): void {
    this.selectedCity.set('');
    this.selectedTypology.set('');
  }

  openBuyForCity(city: string): void {
    void this.router.navigate(['/buy'], { queryParams: { city } });
  }

  formatYield(value: number | null): string {
    return value != null ? `${(value * 100).toFixed(2)}%` : '—';
  }

  private formatMonth(ym: string): string {
    const d = new Date(`${ym}-01T00:00:00`);
    return d.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' });
  }
}
