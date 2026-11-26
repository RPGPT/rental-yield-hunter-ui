# AGENTS.md — Rental Yield Hunter UI

Authoritative context and engineering rules for AI coding agents working in `rental-yield-hunter-ui`. Read this first, then consult `docs/` for deep dives:

- [`docs/architecture.md`](./docs/architecture.md) — Domain logic (yield estimates, contract reversion, apartment clusters, 1-cut price history, snapshots, live portal scraping).
- [`docs/api-and-database.md`](./docs/api-and-database.md) — Every API route, query parameter, auth tier, Vercel 12-function multiplexing pattern, and the Neon Postgres table/column schema.
- [`docs/frontend-guide.md`](./docs/frontend-guide.md) — Angular 21 zoneless signals patterns, filter state <-> URL sync, interceptors, Material 3 SCSS tokens, bundle budgets, and Vitest testing.

---

## 1. System Summary

- **Purpose**: Web UI + serverless API for analysing Portuguese real estate **Buy** (`/buy`) and **Rent** (`/rent`) listings scraped by the companion Python repo (`rental-yield-hunter`) from **Imovirtual** (`imovirtual`), **ERA** (`era`), and **Casa Sapo** (`casasapo`), plus manual admin entries (`manual`).
- **Frontend**: Angular 21 (`provideZonelessChangeDetection()`), standalone components, Signals, `ChangeDetectionStrategy.OnPush`, Angular Material 21, Chart.js (`ng2-charts`).
- **Backend**: TypeScript Vercel Serverless Functions (`api/`) + local Node HTTP mirror (`server.ts` on `:3000`, proxied from Angular `:4200` via `proxy.conf.json`).
- **Data & Auth**: Neon Serverless Postgres (`@neondatabase/serverless` raw SQL — **migrations live in `rental-yield-hunter`, not here**), Neon Auth (`@neondatabase/neon-js/auth`), private Vercel Blob (`@vercel/blob`) for HTML snapshots.

---

## 2. Critical Constraints & Gotchas (Do Not Violate)

1. **Vercel Hobby 12-Function Hard Limit (12/12 Used)**:
   - Vercel counts every non-test `.ts` file under `api/` (outside underscore-prefixed folders/files) as a separate Serverless Function. Hobby tier caps deployments at **12 functions**, and all **12 slots are currently occupied**:
     1. `api/filters.ts`
     2. `api/rental-filters.ts`
     3. `api/stats.ts`
     4. `api/favorites/index.ts`
     5. `api/hidden/index.ts` (also multiplexes `?resource=saved-searches`)
     6. `api/listings/index.ts`
     7. `api/listings/[id].ts`
     8. `api/listings/description.ts`
     9. `api/listings/snapshot.ts`
     10. `api/listings/snapshot-download.ts`
     11. `api/rental-listings/index.ts`
     12. `api/rental-listings/[id].ts`
   - **Rule**: **NEVER** add a new top-level or nested route file in `api/`. Put shared backend modules in `api/_lib/`, test helpers in `api/_test/`, and multiplex new endpoints onto an existing handler via HTTP method or `?resource=<name>` (follow the `handleSavedSearches` pattern in `api/hidden/index.ts` + `api/_lib/saved-searches.ts`).

2. **Explicit `.js` Extensions in `api/` Relative Imports**:
   - Vercel compiles `api/` as Node ESM (`"type": "module"` in `package.json`). Relative imports to runtime modules inside `api/` **must** use `.js` extensions (e.g. `import { getUserFromRequest } from '../_lib/auth.js'`), otherwise serverless functions crash at runtime with `ERR_MODULE_NOT_FOUND`. Type-only imports (`import type ... from '../_types'`) are stripped at build time.

3. **Keep `server.ts` in Sync with `api/`**:
   - Local development (`pnpm start`) runs `server.ts`, which manually routes URLs to `api/` handlers and parses JSON bodies for `POST`/`PATCH`/`PUT`. Whenever you add a new HTTP method or route behaviour to an `api/` handler, verify `server.ts` dispatches it properly (for example, `server.ts` currently restricts `/api/listings` to `GET`/`POST` and `/api/rental-listings` to `GET`).

4. **Database Schema Ownership & Soft Deletes**:
   - Schema migrations are owned by the external `rental-yield-hunter` repository. Do **not** run DDL migrations in API handlers.
   - Always filter out soft-deleted rows using `COALESCE(l.is_deleted, false) = false` unless explicitly querying the Trash view (`deleted === 'true'`).

5. **Two Backend Auth Tiers (`api/_lib/auth.ts`)**:
   - **Strict Auth (`getUserFromRequest`)**: Cryptographically verifies JWT via Neon Auth JWKS, looks up authoritative `role` in `neon_auth."user"` (since JWT `role` claims can be generic like `"authenticated"`), and falls back to `${NEON_AUTH_URL}/get-session`. Use this for admin/mutation endpoints (`POST /api/listings`, `PATCH`/`DELETE /api/listings/:id`).
   - **Fast Read/User-State Decode (`getFastUserFromRequest`)**: Synchronous base64url JWT `sub`/`id` + `exp` decode shared across `listings/index.ts`, `rental-listings/*`, `favorites/index.ts`, and `hidden/index.ts` to avoid network/DB auth overhead on high-frequency queries.
   - Both support `Authorization: Bearer dev-token` when `NODE_ENV !== 'production'` (returns `dev-user` with `role: 'admin'`), matching `environment.ts` (`devBypassAuth: true`).

6. **Angular 21 Zoneless & Bundle Budgets**:
   - The app uses **`provideZonelessChangeDetection()`**. State changes **must** flow through Angular `signal()` / `computed()` / signal `input()` or `AsyncPipe` — mutating plain class fields inside async callbacks will **not** trigger re-renders.
   - `angular.json` enforces strict production style budgets: **5 kB warning / 8 kB error** per component SCSS (`anyComponentStyle`), and **1.5 MB warning / 2 MB error** initial JS bundle. Keep shared UI pieces modular (e.g. `ImageGalleryComponent`, `DescriptionCardComponent`) so detail component styles stay well below 5 kB. Always verify with `pnpm build`.

7. **TypeScript Strictness**:
   - `noPropertyAccessFromIndexSignature: true` is enabled in `tsconfig.json`. Access untyped `Record<string, unknown>` / router `Params` / `process.env` keys with bracket notation (`params['price_min']`, `process.env['DATABASE_URL']`).

---

## 3. Known Asymmetries & Already-Implemented Backend Capabilities

Before writing new SQL or UI plumbing, check what already exists:

- **Backend filters/sorts already implemented in `GET /api/listings` (not yet in UI controls)**:
  - Query filters `property_type` (CSV) and `has_garage` (`'true' | 'false'`), plus `property_types` returned by `GET /api/filters`.
  - Sort columns `price_spread`, `rent_upside_pct`, and `reversion_yield` (usable today via URL e.g. `/buy?sort=reversion_yield&order=desc`).
- **Admin UI vs. API auth**: `POST /api/listings` enforces `user.role === 'admin'` on the server; `PATCH` and `DELETE` on `/api/listings/:id` and `GET /api/listings?deleted=true` require an authenticated user on the server while their UI triggers are hidden behind `auth.isAdmin()`.
- **Unmounted component**: `StatsBarComponent` (`src/app/features/dashboard/stats-bar/`) and `GET /api/stats` are implemented and unit-tested, but `StatsBarComponent` is not currently rendered in `dashboard.component.html`.

---

## 4. Commands & Verification

Always use `pnpm` (`packageManager: pnpm@10.11.0`):

```bash
pnpm start          # Runs API (:3000) + Angular (:4200) concurrently
pnpm test           # Runs Vitest unit + real-data Neon flow suites ('angular' jsdom + 'api' node)
pnpm build          # Production Angular build (validates templates + bundle/SCSS budgets)
pnpm exec prettier --check .   # Check formatting (Husky pre-commit runs prettier via lint-staged)
```

Before committing any code change, run `pnpm test && pnpm build`.

---

## 5. Quick Feature & File Map

| Area                        | Key Files                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Routes & App Bootstrap      | `src/app/app.routes.ts` (all feature routes lazy-loaded), `src/app/app.config.ts`, `src/app/app.ts`                                |
| Auth & 401 Silent Refresh   | `src/app/core/services/auth.service.ts`, `src/app/core/interceptors/error.interceptor.ts`, `api/_lib/auth.ts`                      |
| Buy/Rent Filter State       | `src/app/core/services/filter-state.service.ts`, `rental-filter-state.service.ts`, `filter-params.util.ts`, `query-params.util.ts` |
| Shared Domain & UI Modules  | `src/app/shared/utils/listing.util.ts`, `shared/components/image-gallery/`, `shared/components/description-card/`                  |
| Backend Domain Modules      | `api/_lib/listings-query.ts`, `rental-listings-query.ts`, `portals.ts`, `price-history.ts`, `saved-searches.ts`, `audit.ts`        |
| Dashboard & Table           | `src/app/features/dashboard/dashboard.component.ts`, `filters-panel/`, `listings-table/`, `saved-searches/`                        |
| Detail & Portal Hydration   | `src/app/features/detail/detail.component.ts`, `rental-detail/`, `api/listings/[id].ts`, `description.ts`                          |
| Manual Listing & Admin      | `src/app/features/create-manual-listing/`, `detail/mark-as-rented-dialog.component.ts`                                             |
| Snapshots                   | `src/app/features/snapshot/snapshot-viewer.component.ts`, `api/listings/snapshot.ts`, `snapshot-download.ts`                       |
| Real-Data Integration Flows | `api/_test/real-data-flows.spec.ts`, `src/app/flows/app-flows.real-data.spec.ts`                                                   |
