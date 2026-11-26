# API & Database Reference

Complete reference for the serverless backend (`api/`), local development router (`server.ts`), authentication verification tiers, Vercel function constraints, and the Neon Postgres schema used by `rental-yield-hunter-ui`.

---

## 1. Vercel Serverless Architecture & Hard Constraints

### 1.1 The 12-Function Ceiling (Hobby Tier)

Vercel Hobby deployments fail if a project defines more than **12 Serverless Functions**. Every `.ts` file inside `api/` is treated as an independent function **except**:

- Files inside underscore-prefixed folders (`api/_lib/**`, `api/_test/**`)
- Underscore-prefixed files (`api/_types.ts`)
- Test files (`**/*.spec.ts`, excluded in build/deployment)

All **12 function slots** are currently allocated:

| #   | Function File                       | Route(s) Served                                                                  |
| --- | ----------------------------------- | -------------------------------------------------------------------------------- |
| 1   | `api/listings/index.ts`             | `GET /api/listings`, `POST /api/listings`                                        |
| 2   | `api/listings/[id].ts`              | `GET /api/listings/:id`, `PATCH /api/listings/:id`, `DELETE /api/listings/:id`   |
| 3   | `api/listings/description.ts`       | `GET /api/listings/description`                                                  |
| 4   | `api/listings/snapshot.ts`          | `GET /api/listings/snapshot`, `POST /api/listings/snapshot` (`maxDuration: 300`) |
| 5   | `api/listings/snapshot-download.ts` | `GET /api/listings/snapshot-download`                                            |
| 6   | `api/rental-listings/index.ts`      | `GET /api/rental-listings`                                                       |
| 7   | `api/rental-listings/[id].ts`       | `GET /api/rental-listings/:id`                                                   |
| 8   | `api/favorites/index.ts`            | `GET /api/favorites`, `POST /api/favorites`, `DELETE /api/favorites`             |
| 9   | `api/hidden/index.ts`               | `GET/POST/DELETE /api/hidden` + `?resource=saved-searches`                       |
| 10  | `api/filters.ts`                    | `GET /api/filters`                                                               |
| 11  | `api/rental-filters.ts`             | `GET /api/rental-filters`                                                        |
| 12  | `api/stats.ts`                      | `GET /api/stats`                                                                 |

> [!WARNING]
> **Adding New Backend Features:** Never create a 13th endpoint file in `api/`. Implement new handler logic inside `api/_lib/<feature>.ts` (imported with a `.js` suffix!) and dispatch to it from an existing endpoint via HTTP method or query parameter (e.g. `req.query['resource'] === '<feature>'`).

### 1.2 ESM Import Requirement

Because `package.json` sets `"type": "module"`, Vercel's Node runtime requires explicit `.js` extensions on relative value imports inside `api/`:

```ts
// Correct
import { getUserFromRequest } from '../_lib/auth.js';
import { sendError } from './errors.js';

// Type-only imports do not emit runtime JS, so extensionless is safe
import type { VercelRequest, VercelResponse } from '../_types';
```

### 1.3 Local Dev Router (`server.ts`)

`server.ts` starts an HTTP server on port `3000` (`tsx watch server.ts`), wraps `http.ServerResponse` with Express/Vercel-compatible `.status()`, `.json()`, and `.send()` helpers, parses JSON bodies for `POST`/`PATCH`/`PUT`, populates `req.query`, and dispatches requests to the imported `api/` handlers. It also serves local dev snapshot files directly at `GET /api/snapshots/:id`.

---

## 2. Authentication Verification Tiers

Frontend requests to `/api/*` attach `Authorization: Bearer <token>` via `authInterceptor`. Backend handlers use one of two verification strategies:

### Tier A — Full Cryptographic + DB Role Verification (`api/_lib/auth.ts`)

Used by `api/listings/[id].ts` and `POST /api/listings` (`createListing`):

1. If `token === 'dev-token'` and `NODE_ENV !== 'production'`, returns `{ id: 'dev-user', email: 'dev@local', name: 'Dev User', image: null, role: 'admin' }`.
2. Verifies JWT signature and `exp` against `${NEON_AUTH_URL}/.well-known/jwks.json` (1-hour in-memory JWKS cache by `kid`).
3. Queries `SELECT role FROM neon_auth."user" WHERE id = $1 LIMIT 1` because Neon Auth JWTs may carry a generic `role` claim (such as `"authenticated"`) while admin privileges live in `neon_auth."user".role`.
4. Falls back to `${NEON_AUTH_URL}/get-session` (5s timeout) if JWKS verification fails or no role is found.

### Tier B — Lightweight JWT Payload Decode (`getFastUserFromRequest` in `api/_lib/auth.ts`)

Used by `GET /api/listings`, `api/rental-listings/*`, `api/favorites/index.ts`, and `api/hidden/index.ts`:

1. Supports `dev-token` in non-production.
2. Base64url-decodes the JWT payload, checks `exp`, and extracts `id ?? sub`, `email`, and `name` with zero network/DB auth roundtrips.

### Shared Backend Modules (`api/_lib/`)

- `auth.ts`: `getUserFromRequest` (Tier A) and `getFastUserFromRequest` (Tier B).
- `listings-query.ts`: Parameterized SQL builder (`buildListingsQueryPlan` with conditional `COUNT(*)` joins and single-evaluation `PREV_PRICE_SQL` sort expression) + `createManualListing`.
- `rental-listings-query.ts`: Parameterized SQL builder (`buildRentalListingsQueryPlan`) for rental listings.
- `portals.ts`: Shared Imovirtual (`buildId` cache + NextData + HTML fallback), ERA, and Casa Sapo live scrapers used by `description.ts` and `snapshot.ts`.
- `price-history.ts`: `buildPriceHistory` (1-cut `initial_price` reconstruction) and `extractRawImages` shared across `listings/[id].ts` and `rental-listings/[id].ts`.
- `saved-searches.ts`: Single-pass `COUNT(*) FILTER (...)` alert evaluator and CRUD handler multiplexed onto `/api/hidden?resource=saved-searches`.
- `audit.ts` & `errors.ts`: Audit log writer and structured `sendError` helper.

---

## 3. HTTP Endpoints Specification

### 3.1 Buy Listings

#### `GET /api/listings`

Returns `{ data: Listing[], total: number, limit: number, offset: number }`. Auth is optional (enables `is_favorite` and `is_hidden` joins; required when `deleted=true`).

- **Numeric filters**: `price_min`, `price_max`, `area_min`, `area_max`, `rental_yield_min` (decimal, e.g. `0.06` for 6%).
- **Multi-value CSV filters**: `typology`, `city`, `neighborhood`, `source` (`imovirtual`, `era`, `casasapo`, `manual`), `property_type` _(implemented in SQL, not yet exposed in UI filter panel)_.
- **Boolean/mode filters**:
  - `has_garage`: `'true' | 'false'` _(implemented in SQL, not yet exposed in UI filter panel)_
  - `is_rented`: `'true' | 'false'`
  - `lifetime_rent`: `'true' | 'false'`
  - `has_contract_details`: `'true'` (enforces `is_rented = true AND lifetime_rent = false AND rcd.current_rent IS NOT NULL`)
  - `is_favorite`: `'true'` (requires auth)
  - `is_hidden`: `'false'` (hide hidden, UI default), `'true'` (only hidden), or omitted/`'all'` (show all)
  - `is_new`: `'true'` (`first_seen >= NOW() - INTERVAL '2 days'`)
  - `price_change`: `'reduced' | 'increased'`
  - `deduplicate`: `'true'` (cheapest active non-deleted listing per `cluster_id`, plus unclustered rows)
  - `active`: `'true' | 'false'` (omit for all)
  - `deleted`: `'true'` (Trash view; requires auth, returns `is_deleted = true`)
- **Sorting & pagination**:
  - `sort`: `price` (default), `area`, `price_per_m2`, `property_type`, `typology`, `city`, `neighborhood`, `source`, `has_garage`, `is_rented`, `lifetime_rent`, `active`, `first_seen`, `last_seen`, `estimated_rent`, `rental_yield`, `price_drop_pct`, `price_spread`, `rent_upside_pct`, `reversion_yield`. _(Note: `price_spread`, `rent_upside_pct`, and `reversion_yield` work via URL query params today even though they do not yet have dedicated table column headers.)_
  - `order`: `'asc'` (default) | `'desc'` (`NULLS LAST`).
  - `limit`: `1..100` (default `50`), `offset`: `>= 0` (default `0`).

#### `POST /api/listings`

**Auth:** Admin only (`user.role === 'admin'` via `api/_lib/auth.ts`).
Creates a manual buy listing (`source = 'manual'`) and optionally inserts `rent_contract_details` if `isRented && currentRentPrice`.

- **Body**: `{ title, url?, city, neighborhood, price, sizeM2, isRented?, currentRentPrice? }`.

#### `GET /api/listings/:id`

Returns `ListingDetail` (`Listing` + `price_history: PricePoint[]` + `images: ListingImage[]` + optional `cluster_siblings: ClusterSibling[]`). Returns `404` if missing or `is_deleted = true`.

#### `PATCH /api/listings/:id`

**Auth:** Authenticated user (`api/_lib/auth.ts`; UI restricts buttons to admins).

- Updates any subset of `{ is_rented?: boolean, lifetime_rent?: boolean, is_deleted?: false }`.
- Contract side-effects:
  - If `is_rented === false` or `lifetime_rent === true`: deletes matching row from `rent_contract_details`.
  - Else if `typeof rent_per_month === 'number'`: upserts `rent_contract_details` (`current_rent`, `contract_expiry_date`, and SQL-computed `current_yield`, `reversion_yield`, `rent_upside_pct`, `months_to_expiry` joined against `listings` + `rental_estimates`).

#### `DELETE /api/listings/:id`

**Auth:** Authenticated user (`api/_lib/auth.ts`; UI restricts menu item to admins).
Soft-deletes the listing (`UPDATE listings SET is_deleted = true`) and writes an `'delete'` entry to `audit_log` via `api/_lib/audit.ts`.

#### `GET /api/listings/description?url=<encoded_url>`

Public/CDN-cached (`Cache-Control: s-maxage=3600, stale-while-revalidate=86400`). Live-scrapes portal description and gallery images for `imovirtual.com`, `era.pt`, and `casa.sapo.pt`.

#### `GET | POST /api/listings/snapshot?id=<id>[&source=rental]`

- `GET`: Checks whether a snapshot exists (`listing_snapshots` table on Vercel; `snapshots/<id>.html|.mhtml` locally) and returns `{ exists: boolean, url?: string }`.
- `POST`: Captures and stores a snapshot if one does not already exist, returning `{ exists: true, url }`.

#### `GET /api/listings/snapshot-download?id=<id>`

Looks up `blob_url` in `listing_snapshots`, fetches the private Vercel Blob using `BLOB_READ_WRITE_TOKEN`, and streams `text/html; charset=utf-8` inline.

---

### 3.2 Rental Listings

#### `GET /api/rental-listings`

Returns `{ data: RentalListing[], total, limit, offset }`.

- **Filters**: `price_min`, `price_max`, `area_min`, `area_max`, `rent_price_per_m2_min`, `rent_price_per_m2_max`, `typology` (CSV), `city` (CSV), `neighborhood` (CSV), `is_favorite` (`'true'`), `is_new` (`'true'`), `price_change` (`'reduced' | 'increased'`), `active` (`'true' | 'false'`).
- **Sorting**: `price`, `area`, `rent_price_per_m2`, `typology`, `city`, `active`, `first_seen`, `last_seen`.

#### `GET /api/rental-listings/:id`

Returns `RentalListingDetail` (`RentalListing` + `price_history` + `images`).

---

### 3.3 User Preferences, Saved Searches & Metadata

| Method   | Path                                          | Auth     | Purpose                                                                                                      |
| -------- | --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/favorites`                              | Required | Returns `string[]` of favourited `listing_id`s                                                               |
| `POST`   | `/api/favorites?id=<listing_id>`              | Required | Marks listing (buy or rent) as favourite                                                                     |
| `DELETE` | `/api/favorites?id=<listing_id>`              | Required | Removes favourite                                                                                            |
| `GET`    | `/api/hidden`                                 | Required | Returns `string[]` of hidden `listing_id`s                                                                   |
| `POST`   | `/api/hidden?id=<listing_id>`                 | Required | Hides buy listing for current user                                                                           |
| `DELETE` | `/api/hidden?id=<listing_id>`                 | Required | Unhides buy listing                                                                                          |
| `GET`    | `/api/hidden?resource=saved-searches`         | Required | Lists user's `SavedSearch[]` with `new_matches` & `price_drops`                                              |
| `POST`   | `/api/hidden?resource=saved-searches`         | Required | Creates saved search `{ name, filters }`                                                                     |
| `POST`   | `/api/hidden?resource=saved-searches&id=<id>` | Required | Updates `last_checked_at = NOW()`                                                                            |
| `DELETE` | `/api/hidden?resource=saved-searches&id=<id>` | Required | Deletes saved search                                                                                         |
| `GET`    | `/api/filters`                                | Public   | Distinct `cities`, `typologies`, `property_types`, `neighborhoods` (by city), `sources` for buy              |
| `GET`    | `/api/rental-filters`                         | Public   | Distinct `cities`, `typologies`, `neighborhoods` (by city) for rent                                          |
| `GET`    | `/api/stats`                                  | Public   | Portfolio counts (`total_active`, `rented`, `lifetime_rent`, `avg_price`, `avg_price_per_m2`, `price_drops`) |

---

## 4. Neon Postgres Schema Reference

All tables live in the `public` schema except Neon Auth (`neon_auth."user"`). Migrations are managed in the companion `rental-yield-hunter` repository.

### 4.1 Core Property Tables

- **`listings`** (Buy properties)
  - Identity & Portal: `id` (PK text), `source` (`'imovirtual' | 'era' | 'casasapo' | 'manual'`), `url`, `title`, `description`
  - Pricing: `price`, `initial_price`, `price_drop_amount`, `price_drop_pct` (numeric), `price_change_count`, `area`, `price_per_m2`
  - Attributes: `location`, `city`, `neighborhood`, `property_type`, `typology`, `floor`, `has_garage`
  - Tenancy & Lifecycle: `is_rented` (bool), `lifetime_rent` (bool), `active` (bool), `inactive_since`, `first_seen`, `last_seen`, `is_deleted` (bool, nullable — use `COALESCE(is_deleted, false)`)
- **`listing_price_history`**: `id`, `listing_id` (FK), `price`, `previous_price`, `captured_at`
- **`raw_data`**: `listing_id`, `raw_json` (JSONB containing `images: [{ large, medium }]` or JSON-LD `mainEntity.image`)
- **`rental_listings`** (Rent properties): `id`, `source`, `url`, `title`, `description`, `price`, `initial_price`, `price_drop_amount`, `price_drop_pct`, `price_change_count`, `area`, `rent_price_per_m2`, `location`, `city`, `neighborhood`, `typology`, `floor`, `active`, `inactive_since`, `first_seen`, `last_seen`, `is_deleted`
- **`rental_listing_price_history`**: `id`, `listing_id`, `price`, `previous_price`, `captured_at`
- **`rental_raw_data`**: `listing_id`, `raw_json` (JSONB with `images`)

### 4.2 Analytics & Enrichment Tables

- **`rental_estimates`**: `listing_id` (PK/FK), `estimated_rent`, `avg_rent_per_m2`, `sample_count`, `confidence`, `match_level`, `rental_yield`
- **`rent_contract_details`**: `listing_id` (PK/FK), `current_rent`, `contract_expiry_date` (date), `confidence`, `raw_rent_text`, `raw_expiry_text`, `current_yield`, `reversion_yield`, `rent_upside_pct`, `months_to_expiry`, `updated_at`
- **`listing_clusters`**: `listing_id` (PK/FK), `cluster_id`, `cluster_size`, `cluster_min_price`, `cluster_max_price`, `price_spread`, `price_spread_pct`, `is_cheapest`, `sources` (`text[]`)

### 4.3 User, Snapshot, Alert & Audit Tables

- **`neon_auth."user"`**: Managed by Neon Auth; `id` (text), `email`, `name`, `image`, `role` (`'admin'` or `null`/user)
- **`user_favorites`**: `(user_id, listing_id)` composite unique/PK (stores IDs for both `listings` and `rental_listings`)
- **`user_hidden`**: `(user_id, listing_id)` composite unique/PK
- **`saved_searches`**: `id` (serial PK), `user_id`, `name`, `filters` (JSONB), `last_checked_at` (timestamptz), `created_at` (timestamptz)
- **`alert_notifications`**: Populated by the Python pipeline when saved searches match new deals or price drops
- **`listing_snapshots`**: `listing_id` (PK), `blob_url` (private Vercel Blob URL), `created_at`
- **`audit_log`**: `id`, `action` (e.g. `'delete'`), `listing_id`, `user_id`, `user_email`, `created_at`
