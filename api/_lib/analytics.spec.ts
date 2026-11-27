import { describe, it, expect, beforeEach, vi } from 'vitest';
import statsHandler from '../stats';
import { BUY_BOUNDS, RENT_BOUNDS } from './analytics';
import { MockRes } from '../_test/mock-res';

let queryCall = 0;
let queryResponses: unknown[][] = [];

vi.mock('@neondatabase/serverless', () => ({
  neon: () => {
    const sql = async (..._: unknown[]) => queryResponses[queryCall++] ?? [];
    (sql as any).query = async (..._: unknown[]) => queryResponses[queryCall++] ?? [];
    return sql;
  },
}));

describe('GET /api/stats?view=analytics', () => {
  beforeEach(() => {
    queryCall = 0;
    queryResponses = [];
    process.env['DATABASE_URL'] = 'postgresql://mock';
  });

  it('returns structured monthly analytics payload with outlier metadata, KPIs, and breakdowns', async () => {
    queryResponses = [
      // 1. meta
      [
        {
          buy_total: 1000,
          buy_clean: 980,
          rent_total: 400,
          rent_clean: 390,
          date_from: '2026-05-12',
          date_to: '2026-11-26',
        },
      ],
      // 2. cities list
      [{ city: 'Porto' }, { city: 'Vila Nova de Gaia' }],
      // 3. buy kpis
      [
        {
          active_buy_count: 500,
          median_buy_price: 290000,
          median_buy_pm2: 4500,
          p25_buy_pm2: 3600,
          p75_buy_pm2: 5400,
          median_area: 70,
          median_gross_yield: 0.052,
          price_drop_count: 50,
          median_price_drop_pct: 0.045,
          median_days_on_market: 32,
        },
      ],
      // 4. rent kpis
      [{ active_rent_count: 150, median_rent_price: 1200, median_rent_pm2: 18.5 }],
      // 5. buy monthly
      [{ month: '2026-11', buy_new_count: 80, buy_median_pm2: 4450, buy_median_price: 285000 }],
      // 6. rent monthly
      [{ month: '2026-11', rent_new_count: 25, rent_median_pm2: 18.2, rent_median_price: 1180 }],
      // 7. city buy
      [
        {
          city: 'Porto',
          buy_count: 300,
          median_buy_price: 300000,
          median_buy_pm2: 5100,
          p25_buy_pm2: 4200,
          p75_buy_pm2: 6000,
          median_yield: 0.051,
          price_drop_share_pct: 9.5,
        },
      ],
      // 8. city rent
      [{ city: 'Porto', rent_count: 100, median_rent_price: 1250, median_rent_pm2: 19.2 }],
      // 9. typo buy (active)
      [
        {
          typology: 'T2',
          buy_count: 220,
          median_buy_price: 315000,
          median_buy_pm2: 4100,
          median_area: 80,
          median_yield: 0.054,
        },
      ],
      // 10. typo rent (active)
      [{ typology: 'T2', rent_count: 60, median_rent_price: 1300, median_rent_pm2: 17.5 }],
      // 11. typo buy (inactive)
      [
        {
          typology: 'T2',
          buy_count: 400,
          median_buy_price: 295000,
          median_buy_pm2: 3900,
          median_area: 78,
          median_yield: 0.055,
        },
      ],
      // 12. typo rent (inactive)
      [{ typology: 'T2', rent_count: 120, median_rent_price: 1200, median_rent_pm2: 16.4 }],
    ];

    const res = new MockRes();
    await statsHandler(
      { method: 'GET', query: { view: 'analytics' }, headers: {} } as any,
      res as any,
    );

    expect(res._status).toBe(200);
    const body = res._body as any;
    expect(body.meta.outliers.buy_excluded).toBe(20);
    expect(body.meta.outliers.rent_excluded).toBe(10);
    expect(body.meta.outliers.buy_bounds).toEqual(BUY_BOUNDS);
    expect(body.meta.outliers.rent_bounds).toEqual(RENT_BOUNDS);
    expect(body.kpis.median_buy_pm2).toBe(4500);
    expect(body.kpis.price_drop_share_pct).toBe(10);
    expect(body.evolution).toHaveLength(1);
    expect(body.evolution[0]).toMatchObject({
      month: '2026-11',
      buy_new_count: 80,
      rent_new_count: 25,
    });
    expect(body.by_city[0]).toMatchObject({ city: 'Porto', median_rent_price: 1250 });
    expect(body.by_typology[0]).toMatchObject({ typology: 'T2', median_rent_pm2: 17.5 });
    expect(body.by_typology_inactive[0]).toMatchObject({
      typology: 'T2',
      median_buy_price: 295000,
      median_rent_price: 1200,
    });
    expect(body.top_neighborhoods).toBeUndefined();
  });
});
