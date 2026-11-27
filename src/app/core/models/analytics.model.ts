export interface AnalyticsOutliers {
  buy_excluded: number;
  buy_total: number;
  rent_excluded: number;
  rent_total: number;
  buy_bounds: {
    minArea: number;
    maxArea: number;
    minPrice: number;
    maxPrice: number;
    minPricePerM2: number;
    maxPricePerM2: number;
  };
  rent_bounds: {
    minArea: number;
    maxArea: number;
    minPrice: number;
    maxPrice: number;
    minPricePerM2: number;
    maxPricePerM2: number;
  };
}

export interface AnalyticsKpis {
  active_buy_count: number;
  active_rent_count: number;
  median_buy_price: number;
  median_buy_pm2: number;
  p25_buy_pm2: number;
  p75_buy_pm2: number;
  median_area: number;
  median_rent_price: number | null;
  median_rent_pm2: number | null;
  median_gross_yield: number | null;
  price_drop_share_pct: number;
  median_price_drop_pct: number | null;
  median_days_on_market: number | null;
}

export interface AnalyticsWeekPoint {
  week: string;
  buy_new_count: number;
  buy_median_pm2: number | null;
  buy_median_price: number | null;
  rent_new_count: number;
  rent_median_pm2: number | null;
  rent_median_price: number | null;
  price_drops_count: number;
  price_increases_count: number;
}

export interface AnalyticsCityRow {
  city: string;
  buy_count: number;
  median_buy_price: number;
  median_buy_pm2: number;
  p25_buy_pm2: number;
  p75_buy_pm2: number;
  rent_count: number;
  median_rent_price: number | null;
  median_rent_pm2: number | null;
  median_yield: number | null;
  price_drop_share_pct: number;
}

export interface AnalyticsTypologyRow {
  typology: string;
  buy_count: number;
  median_buy_price: number;
  median_buy_pm2: number;
  median_area: number;
  rent_count: number;
  median_rent_price: number | null;
  median_rent_pm2: number | null;
  median_yield: number | null;
}

export interface AnalyticsNeighborhoodRow {
  city: string;
  neighborhood: string;
  buy_count: number;
  median_buy_price: number;
  median_buy_pm2: number;
  median_est_rent: number | null;
  median_yield: number | null;
}

export interface AnalyticsResponse {
  meta: {
    cities: string[];
    typologies: string[];
    selected_city: string | null;
    selected_typology: string | null;
    date_range: { from: string | null; to: string | null };
    outliers: AnalyticsOutliers;
  };
  kpis: AnalyticsKpis;
  evolution: AnalyticsWeekPoint[];
  by_city: AnalyticsCityRow[];
  by_typology: AnalyticsTypologyRow[];
  top_neighborhoods: AnalyticsNeighborhoodRow[];
}
