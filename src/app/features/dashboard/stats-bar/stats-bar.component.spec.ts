import { describe, it, expect, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { StatsBarComponent } from './stats-bar.component';
import { Stats } from '../../../core/models/stats.model';

describe('StatsBarComponent', () => {
  function render(
    inputs: { stats?: Stats | null; loading?: boolean } = {},
  ): ComponentFixture<StatsBarComponent> {
    TestBed.configureTestingModule({
      imports: [StatsBarComponent, NoopAnimationsModule],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(StatsBarComponent);
    if ('stats' in inputs) fixture.componentRef.setInput('stats', inputs.stats ?? null);
    if ('loading' in inputs) fixture.componentRef.setInput('loading', inputs.loading ?? false);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders without errors when stats is null', () => {
    const fixture = render({ stats: null, loading: false });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders with stats data', () => {
    const fixture = render({
      stats: {
        total_active: 100,
        rented: 20,
        lifetime_rent: 5,
        avg_price: 150000,
        avg_price_per_m2: 2000,
        price_drops: 10,
      },
      loading: false,
    });
    expect(fixture.componentInstance.stats()).toBeTruthy();
  });

  it('reflects loading input', () => {
    const fixture = render({ stats: null, loading: true });
    expect(fixture.componentInstance.loading()).toBe(true);
  });
});
