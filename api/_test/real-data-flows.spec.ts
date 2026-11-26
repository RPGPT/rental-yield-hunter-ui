import 'dotenv/config';
import { randomUUID } from 'crypto';
import { describe, it, expect, afterAll } from 'vitest';
import { neon } from '@neondatabase/serverless';
import { MockRes } from './mock-res';
import filtersHandler from '../filters';
import rentalFiltersHandler from '../rental-filters';
import statsHandler from '../stats';
import listingsHandler from '../listings/index';
import listingByIdHandler from '../listings/[id]';
import rentalListingsHandler from '../rental-listings/index';
import rentalListingByIdHandler from '../rental-listings/[id]';
import favoritesHandler from '../favorites/index';
import hiddenHandler from '../hidden/index';

const REAL_DB_URL = process.env['DATABASE_URL'] ?? '';
const HAS_REAL_DB = Boolean(REAL_DB_URL && !REAL_DB_URL.includes('mock'));

function makeUserJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  return `${b64url({ alg: 'none' })}.${b64url(payload)}.sig`;
}

async function callHandler<T = any>(
  fn: (req: any, res: any) => Promise<unknown>,
  opts: {
    method?: string;
    query?: Record<string, string | undefined>;
    headers?: Record<string, string>;
    body?: unknown;
  } = {},
): Promise<{ status: number; body: T }> {
  const res = new MockRes();
  await fn(
    {
      method: opts.method ?? 'GET',
      query: opts.query ?? {},
      headers: opts.headers ?? {},
      cookies: {},
      body: opts.body ?? null,
    },
    res,
  );
  return { status: res._status, body: res._body as T };
}

describe.skipIf(!HAS_REAL_DB)('Real-Data API Flows (Neon Postgres)', { timeout: 30_000 }, () => {
  const sql = HAS_REAL_DB ? neon(REAL_DB_URL) : (null as never);
  const ephemeralUserId = `e2e-api-${randomUUID()}`;
  const userAuthHeader = {
    authorization: `Bearer ${makeUserJwt({ id: ephemeralUserId, email: 'e2e@test.local', name: 'E2E User' })}`,
  };
  const adminAuthHeader = { authorization: 'Bearer dev-token' };
  const createdManualIds: string[] = [];

  let sampleBuyCity = '';
  let sampleBuyTypology = '';
  let sampleBuyListingId = '';
  let sampleRentalListingId = '';

  afterAll(async () => {
    if (!HAS_REAL_DB) return;
    await sql`DELETE FROM user_favorites WHERE user_id = ${ephemeralUserId}`;
    await sql`DELETE FROM user_hidden WHERE user_id = ${ephemeralUserId}`;
    await sql`DELETE FROM saved_searches WHERE user_id = ${ephemeralUserId}`;
    for (const id of createdManualIds) {
      await sql`DELETE FROM rent_contract_details WHERE listing_id = ${id}`;
      await sql`DELETE FROM audit_log WHERE listing_id = ${id}`;
      await sql`DELETE FROM listings WHERE id = ${id}`;
    }
  });

  it('Flow 1: loads real buy filter options and queries filtered/sorted/deduplicated buy listings', async () => {
    const filtersRes = await callHandler<{
      cities: string[];
      typologies: string[];
      property_types: string[];
      neighborhoods: Record<string, string[]>;
      sources: string[];
    }>(filtersHandler);

    expect(filtersRes.status).toBe(200);
    expect(filtersRes.body.cities.length).toBeGreaterThan(0);
    expect(filtersRes.body.typologies.length).toBeGreaterThan(0);
    expect(filtersRes.body.sources.length).toBeGreaterThan(0);

    sampleBuyCity = filtersRes.body.cities.includes('Porto') ? 'Porto' : filtersRes.body.cities[0];
    sampleBuyTypology = filtersRes.body.typologies.includes('T2')
      ? 'T2'
      : filtersRes.body.typologies[0];

    // Filtered + sorted buy page
    const page1 = await callHandler<{ data: any[]; total: number; limit: number; offset: number }>(
      listingsHandler,
      {
        query: {
          city: sampleBuyCity,
          typology: sampleBuyTypology,
          active: 'true',
          sort: 'price',
          order: 'asc',
          limit: '10',
          offset: '0',
        },
        headers: userAuthHeader,
      },
    );

    expect(page1.status).toBe(200);
    expect(page1.body.total).toBeGreaterThan(0);
    expect(page1.body.data.length).toBeGreaterThan(0);
    expect(page1.body.data.length).toBeLessThanOrEqual(10);

    sampleBuyListingId = page1.body.data[0].id;
    for (const row of page1.body.data) {
      expect(row.city).toBe(sampleBuyCity);
      expect(row.typology).toBe(sampleBuyTypology);
      expect(row.active).toBe(true);
    }

    // Verify ascending price order
    for (let i = 1; i < page1.body.data.length; i++) {
      expect(Number(page1.body.data[i].price)).toBeGreaterThanOrEqual(
        Number(page1.body.data[i - 1].price),
      );
    }

    // Deduplicated vs non-deduplicated total invariant
    const [rawActive, dedupActive] = await Promise.all([
      callHandler<{ total: number }>(listingsHandler, {
        query: { active: 'true', limit: '1' },
      }),
      callHandler<{ total: number }>(listingsHandler, {
        query: { active: 'true', deduplicate: 'true', limit: '1' },
      }),
    ]);
    expect(rawActive.status).toBe(200);
    expect(dedupActive.status).toBe(200);
    expect(dedupActive.body.total).toBeLessThanOrEqual(rawActive.body.total);
    expect(dedupActive.body.total).toBeGreaterThan(0);

    // Price-reduced & yield-sorted queries on real data
    const [reducedRes, yieldRes] = await Promise.all([
      callHandler<{ data: any[]; total: number }>(listingsHandler, {
        query: {
          active: 'true',
          price_change: 'reduced',
          sort: 'price_drop_pct',
          order: 'desc',
          limit: '5',
        },
      }),
      callHandler<{ data: any[]; total: number }>(listingsHandler, {
        query: {
          active: 'true',
          rental_yield_min: '0.04',
          sort: 'rental_yield',
          order: 'desc',
          limit: '5',
        },
      }),
    ]);
    expect(reducedRes.status).toBe(200);
    expect(yieldRes.status).toBe(200);
    expect(yieldRes.body.data.length).toBeGreaterThan(0);
  });

  it('Flow 2: fetches real buy listing details including clustered siblings and price history', async () => {
    // Find a clustered active listing if present in the dataset
    const clusteredList = await callHandler<{ data: any[] }>(listingsHandler, {
      query: { active: 'true', sort: 'price_spread', order: 'desc', limit: '5' },
    });
    expect(clusteredList.status).toBe(200);

    const targetId =
      clusteredList.body.data.find((r) => (r.cluster_size ?? 1) > 1)?.id ?? sampleBuyListingId;
    expect(targetId).toBeTruthy();

    const detailRes = await callHandler<any>(listingByIdHandler, {
      query: { id: targetId },
      headers: userAuthHeader,
    });
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(targetId);
    expect(Array.isArray(detailRes.body.price_history)).toBe(true);
    expect(Array.isArray(detailRes.body.images)).toBe(true);

    if ((detailRes.body.cluster_size ?? 1) > 1 && detailRes.body.cluster_siblings) {
      expect(Array.isArray(detailRes.body.cluster_siblings)).toBe(true);
      for (const sib of detailRes.body.cluster_siblings) {
        expect(sib.id).not.toBe(targetId);
      }
    }
  });

  it('Flow 3: loads real rental filters, paginated rental listings, and rental detail', async () => {
    const rFilters = await callHandler<{
      cities: string[];
      typologies: string[];
      neighborhoods: Record<string, string[]>;
    }>(rentalFiltersHandler);
    expect(rFilters.status).toBe(200);
    expect(rFilters.body.cities.length).toBeGreaterThan(0);

    const rentCity = rFilters.body.cities.includes('Porto') ? 'Porto' : rFilters.body.cities[0];
    const rPage = await callHandler<{ data: any[]; total: number }>(rentalListingsHandler, {
      query: {
        city: rentCity,
        active: 'true',
        sort: 'rent_price_per_m2',
        order: 'asc',
        limit: '10',
      },
      headers: userAuthHeader,
    });
    expect(rPage.status).toBe(200);
    expect(rPage.body.total).toBeGreaterThan(0);
    expect(rPage.body.data.length).toBeGreaterThan(0);

    sampleRentalListingId = rPage.body.data[0].id;

    const rDetail = await callHandler<any>(rentalListingByIdHandler, {
      query: { id: sampleRentalListingId },
      headers: userAuthHeader,
    });
    expect(rDetail.status).toBe(200);
    expect(rDetail.body.id).toBe(sampleRentalListingId);
    expect(Array.isArray(rDetail.body.price_history)).toBe(true);
    expect(Array.isArray(rDetail.body.images)).toBe(true);
  });

  it('Flow 4: computes real portfolio stats with valid aggregate invariants', async () => {
    const res = await callHandler<{
      total_active: number;
      rented: number;
      lifetime_rent: number;
      avg_price: number;
      avg_price_per_m2: number;
      price_drops: number;
    }>(statsHandler);

    expect(res.status).toBe(200);
    expect(res.body.total_active).toBeGreaterThan(0);
    expect(res.body.rented).toBeGreaterThanOrEqual(0);
    expect(res.body.rented).toBeLessThanOrEqual(res.body.total_active);
    expect(res.body.avg_price).toBeGreaterThan(0);
    expect(res.body.avg_price_per_m2).toBeGreaterThan(0);
    expect(res.body.price_drops).toBeGreaterThanOrEqual(0);
  });

  it('Flow 5: persists favourites and hidden state per user across listings queries', async () => {
    expect(sampleBuyListingId).toBeTruthy();

    // Favourite buy listing
    const favPost = await callHandler(favoritesHandler, {
      method: 'POST',
      query: { id: sampleBuyListingId },
      headers: userAuthHeader,
    });
    expect(favPost.status).toBe(200);

    const favList = await callHandler<string[]>(favoritesHandler, { headers: userAuthHeader });
    expect(favList.body).toContain(sampleBuyListingId);

    const favFiltered = await callHandler<{ data: any[]; total: number }>(listingsHandler, {
      query: { is_favorite: 'true' },
      headers: userAuthHeader,
    });
    expect(favFiltered.status).toBe(200);
    expect(favFiltered.body.total).toBe(1);
    expect(favFiltered.body.data[0].id).toBe(sampleBuyListingId);
    expect(favFiltered.body.data[0].is_favorite).toBe(true);

    // Hide buy listing
    const hidePost = await callHandler(hiddenHandler, {
      method: 'POST',
      query: { id: sampleBuyListingId },
      headers: userAuthHeader,
    });
    expect(hidePost.status).toBe(200);

    const hiddenOnly = await callHandler<{ data: any[]; total: number }>(listingsHandler, {
      query: { is_hidden: 'true' },
      headers: userAuthHeader,
    });
    expect(hiddenOnly.body.total).toBe(1);
    expect(hiddenOnly.body.data[0].id).toBe(sampleBuyListingId);
    expect(hiddenOnly.body.data[0].is_hidden).toBe(true);

    const visibleOnly = await callHandler<{ data: any[] }>(listingsHandler, {
      query: { is_favorite: 'true', is_hidden: 'false' },
      headers: userAuthHeader,
    });
    expect(visibleOnly.body.data.find((d) => d.id === sampleBuyListingId)).toBeUndefined();

    // Remove favourite & unhide
    await callHandler(favoritesHandler, {
      method: 'DELETE',
      query: { id: sampleBuyListingId },
      headers: userAuthHeader,
    });
    await callHandler(hiddenHandler, {
      method: 'DELETE',
      query: { id: sampleBuyListingId },
      headers: userAuthHeader,
    });

    const favAfter = await callHandler<string[]>(favoritesHandler, { headers: userAuthHeader });
    expect(favAfter.body).toEqual([]);
  });

  it('Flow 6: creates, evaluates real alert counts, marks checked, and deletes saved searches', async () => {
    const createRes = await callHandler<any>(hiddenHandler, {
      method: 'POST',
      query: { resource: 'saved-searches' },
      headers: userAuthHeader,
      body: {
        name: 'E2E Porto T2 Deals',
        filters: { mode: 'buy', city: sampleBuyCity, typology: sampleBuyTypology },
      },
    });
    expect(createRes.status).toBe(201);
    const searchId = String(createRes.body.id);

    const listRes = await callHandler<any[]>(hiddenHandler, {
      method: 'GET',
      query: { resource: 'saved-searches' },
      headers: userAuthHeader,
    });
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(typeof listRes.body[0].new_matches).toBe('number');
    expect(typeof listRes.body[0].price_drops).toBe('number');

    const checkRes = await callHandler(hiddenHandler, {
      method: 'POST',
      query: { resource: 'saved-searches', id: searchId },
      headers: userAuthHeader,
    });
    expect(checkRes.status).toBe(200);

    const delRes = await callHandler(hiddenHandler, {
      method: 'DELETE',
      query: { resource: 'saved-searches', id: searchId },
      headers: userAuthHeader,
    });
    expect(delRes.status).toBe(200);
  });

  it('Flow 7: executes full admin manual listing, contract update, soft-delete, trash, and restore flow', async () => {
    process.env['NODE_ENV'] = 'test';

    const createRes = await callHandler<any>(listingsHandler, {
      method: 'POST',
      headers: adminAuthHeader,
      body: {
        title: '[E2E TEMP] Test Manual Listing',
        url: 'https://example.com/e2e-temp',
        city: sampleBuyCity || 'Porto',
        neighborhood: 'Bonfim',
        price: 200000,
        sizeM2: 80,
        isRented: false,
        currentRentPrice: null,
      },
    });
    expect(createRes.status).toBe(201);
    const manualId = createRes.body.id as string;
    createdManualIds.push(manualId);
    expect(createRes.body.source).toBe('manual');
    expect(Number(createRes.body.price_per_m2)).toBe(2500);

    // Mark as rented with contract details
    const patchRented = await callHandler(listingByIdHandler, {
      method: 'PATCH',
      query: { id: manualId },
      headers: adminAuthHeader,
      body: {
        is_rented: true,
        lifetime_rent: false,
        rent_per_month: 1000,
        contract_expiry_date: '2027-06-01',
      },
    });
    expect(patchRented.status).toBe(200);

    const afterRented = await callHandler<any>(listingByIdHandler, {
      query: { id: manualId },
      headers: adminAuthHeader,
    });
    expect(afterRented.status).toBe(200);
    expect(afterRented.body.is_rented).toBe(true);
    expect(afterRented.body.rent_current_rent).toBe(1000);
    expect(afterRented.body.rent_current_yield).toBeCloseTo(0.06, 4);

    // Mark as not rented -> clears contract details
    const patchVacant = await callHandler(listingByIdHandler, {
      method: 'PATCH',
      query: { id: manualId },
      headers: adminAuthHeader,
      body: { is_rented: false, lifetime_rent: false },
    });
    expect(patchVacant.status).toBe(200);

    const afterVacant = await callHandler<any>(listingByIdHandler, {
      query: { id: manualId },
      headers: adminAuthHeader,
    });
    expect(afterVacant.body.is_rented).toBe(false);
    expect(afterVacant.body.rent_current_rent).toBeNull();

    // Soft-delete -> disappears from detail & active, appears in Trash (deleted=true)
    const delRes = await callHandler(listingByIdHandler, {
      method: 'DELETE',
      query: { id: manualId },
      headers: adminAuthHeader,
    });
    expect(delRes.status).toBe(200);

    const deletedDetail = await callHandler(listingByIdHandler, {
      query: { id: manualId },
      headers: adminAuthHeader,
    });
    expect(deletedDetail.status).toBe(404);

    const trashRes = await callHandler<{ data: any[] }>(listingsHandler, {
      query: { deleted: 'true', limit: '100' },
      headers: adminAuthHeader,
    });
    expect(trashRes.status).toBe(200);
    expect(trashRes.body.data.some((r) => r.id === manualId)).toBe(true);

    // Restore from trash
    const restoreRes = await callHandler(listingByIdHandler, {
      method: 'PATCH',
      query: { id: manualId },
      headers: adminAuthHeader,
      body: { is_deleted: false },
    });
    expect(restoreRes.status).toBe(200);

    const restoredDetail = await callHandler<any>(listingByIdHandler, {
      query: { id: manualId },
      headers: adminAuthHeader,
    });
    expect(restoredDetail.status).toBe(200);
    expect(restoredDetail.body.id).toBe(manualId);
  });
});
