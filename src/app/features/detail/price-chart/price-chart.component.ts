import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { PricePoint } from '../../../core/models/listing.model';

Chart.register(
  LineController, LineElement, PointElement,
  LinearScale, TimeScale, CategoryScale,
  Tooltip, Legend, Filler,
);

@Component({
  selector: 'app-price-chart',
  standalone: true,
  imports: [BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './price-chart.component.html',
  styleUrl: './price-chart.component.scss',
})
export class PriceChartComponent {
  priceHistory = input<PricePoint[]>([]);
  currentPrice = input<number>(0);

  hasData = computed(() => this.priceHistory().length > 0);

  chartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const history = this.priceHistory();
    if (!history || history.length === 0) {
      return { labels: [], datasets: [] };
    }

    const points = [...history];
    const lastPoint = points[points.length - 1];
    if (lastPoint && lastPoint.price !== this.currentPrice()) {
      points.push({ price: this.currentPrice(), captured_at: new Date().toISOString() });
    }

    return {
      labels: points.map(p => new Date(p.captured_at).toLocaleDateString('pt-PT')),
      datasets: [
        {
          label: 'Price',
          data: points.map(p => p.price),
          borderColor: '#1565C0',
          backgroundColor: 'rgba(21, 101, 192, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };
  });

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => '€' + (ctx.parsed.y ?? 0).toLocaleString('pt-PT', { maximumFractionDigits: 0 }),
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => '€' + Number(value).toLocaleString('pt-PT', { maximumFractionDigits: 0 }),
        },
      },
    },
  };
}
