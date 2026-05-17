import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, Directive, Input } from '@angular/core';

vi.mock('ng2-charts', async () => {
  const { Directive, Input } = await import('@angular/core');
  @Directive({ selector: '[baseChart]', standalone: true })
  class BaseChartDirective {
    @Input() data: unknown;
    @Input() options: unknown;
    @Input() type: unknown;
  }
  return { BaseChartDirective };
});

// Import AFTER the mock so the mocked version is used
const { PriceChartComponent } = await import('./price-chart.component');

describe('PriceChartComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PriceChartComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });
  afterEach(() => TestBed.resetTestingModule());

  function create(priceHistory: { price: number; captured_at: string }[], currentPrice: number) {
    const fixture = TestBed.createComponent(PriceChartComponent);
    fixture.componentRef.setInput('priceHistory', priceHistory);
    fixture.componentRef.setInput('currentPrice', currentPrice);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('hasData is false when priceHistory is empty', () => {
    expect(create([], 0).hasData()).toBe(false);
  });

  it('hasData is true when priceHistory has entries', () => {
    expect(create([{ price: 1000, captured_at: '2024-01-01T00:00:00Z' }], 1000).hasData()).toBe(
      true,
    );
  });

  it('chartData returns empty datasets when no history', () => {
    const comp = create([], 0);
    expect(comp.chartData().labels).toEqual([]);
    expect(comp.chartData().datasets).toEqual([]);
  });

  it('chartData maps price history points', () => {
    const comp = create([{ price: 1200, captured_at: '2024-06-15T00:00:00Z' }], 1200);
    expect(comp.chartData().datasets[0].data).toEqual([1200]);
  });

  it('chartData appends current price when it differs from last history entry', () => {
    const comp = create([{ price: 1200, captured_at: '2024-01-01T00:00:00Z' }], 1100);
    expect(comp.chartData().datasets[0].data).toHaveLength(2);
    expect(comp.chartData().datasets[0].data[1]).toBe(1100);
  });

  it('chartData does NOT append extra point when current price matches last entry', () => {
    const comp = create([{ price: 1200, captured_at: '2024-01-01T00:00:00Z' }], 1200);
    expect(comp.chartData().datasets[0].data).toHaveLength(1);
  });

  it('chartOptions tooltip label callback appends €', () => {
    const comp = create([], 0);
    const cb = comp.chartOptions!.plugins!.tooltip!.callbacks!.label!;
    expect(String(cb({ parsed: { y: 1500 } } as any))).toContain('€');
  });

  it('chartOptions y-axis tick callback appends €', () => {
    const comp = create([], 0);
    const cb = (comp.chartOptions!.scales as any).y.ticks.callback;
    expect(String(cb(2000, 0, []))).toContain('€');
  });
});
