export interface SavedSearch {
  id: number;
  name: string;
  filters: Record<string, string> & { mode?: 'buy' | 'rent' };
  last_checked_at: string;
  created_at: string;
  new_matches: number;
  price_drops: number;
}
