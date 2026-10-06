import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SavedSearchesComponent } from './saved-searches.component';
import { ApiService } from '../../../core/services/api.service';
import { SavedSearch } from '../../../core/models/saved-search.model';

const search: SavedSearch = {
  id: 1,
  name: 'Lisbon T2',
  filters: { mode: 'buy', city: 'Lisboa' },
  last_checked_at: '',
  created_at: '',
  new_matches: 3,
  price_drops: 1,
};

describe('SavedSearchesComponent', () => {
  const api = {
    getSavedSearches: vi.fn(),
    createSavedSearch: vi.fn(),
    markSavedSearchChecked: vi.fn(),
    deleteSavedSearch: vi.fn(),
  };

  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.getSavedSearches.mockReturnValue(of([search]));
    api.markSavedSearchChecked.mockReturnValue(of(undefined));
    api.deleteSavedSearch.mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [SavedSearchesComponent],
      providers: [provideRouter([]), { provide: ApiService, useValue: api }],
    });
  });

  it('loads searches and shows alert badges', () => {
    const f = TestBed.createComponent(SavedSearchesComponent);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('3 new');
    expect(f.nativeElement.textContent).toContain('1 drops');
  });

  it('applying clears alerts and marks checked', () => {
    const f = TestBed.createComponent(SavedSearchesComponent);
    f.detectChanges();
    f.componentInstance.apply(search);
    expect(api.markSavedSearchChecked).toHaveBeenCalledWith(1);
    expect(f.componentInstance.searches()[0].new_matches).toBe(0);
  });

  it('removes a search', () => {
    const f = TestBed.createComponent(SavedSearchesComponent);
    f.detectChanges();
    f.componentInstance.remove(search);
    expect(f.componentInstance.searches()).toEqual([]);
  });
});
