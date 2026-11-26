# Agents Guide — rental-yield-hunter-ui

> **Primary Agent Context:** See [`AGENTS.md`](../../AGENTS.md) at the repository root for complete rules, architectural invariants, and links to [`docs/`](../../docs/). Keep this file aligned with `AGENTS.md`.

---

## Quick Reference

- **Stack**: Angular 21 (zoneless, standalone, signals, `OnPush`), Angular Material 21, Chart.js (`ng2-charts`), Vercel Serverless Functions (`api/`), Neon Serverless Postgres, Neon Auth, Vercel Blob, Playwright + `@sparticuz/chromium-min`, Vitest + `ng-mocks`, `pnpm` 10.
- **Portals**: `imovirtual` (Imovirtual), `era` (ERA), `casasapo` (Casa Sapo), plus `manual` (admin-created listings).
- **Commands**:
  - `pnpm start` — Concurrent local dev (`tsx watch server.ts` on `:3000` + `ng serve` on `:4200`).
  - `pnpm test` — Vitest single run (`angular` jsdom + `api` node projects).
  - `pnpm build` — Production build + bundle/style budget verification.

---

## Non-Negotiable Constraints

1. **Vercel Hobby 12-Function Limit (12/12 Full)**: Do **not** create new endpoint `.ts` files under `api/`. Place shared logic in `api/_lib/`, test utilities in `api/_test/`, and multiplex new resources onto existing handlers (e.g. `/api/hidden?resource=saved-searches` -> `api/_lib/saved-searches.ts`).
2. **ESM Imports in `api/`**: Relative runtime imports in `api/` must use explicit `.js` extensions (e.g. `../_lib/auth.js`).
3. **Local Server Parity**: Update `server.ts` whenever adding methods or query routing to `api/`.
4. **Zoneless Signals**: `provideZonelessChangeDetection()` is active — drive all UI state via Angular signals (`signal`, `computed`, `input`) or observables/pipes.
5. **SCSS Budget**: Component styles fail production build above `8kB` (`5kB` warning).
6. **Database**: Migrations live in the companion `rental-yield-hunter` repo. Exclude soft-deleted rows with `COALESCE(l.is_deleted, false) = false` except in Trash view (`deleted=true`).

---

## Detailed Documentation

- [`AGENTS.md`](../../AGENTS.md) — Root agent instructions and file map
- [`docs/architecture.md`](../../docs/architecture.md) — Domain model, yield/reversion math, apartment clustering, snapshots
- [`docs/api-and-database.md`](../../docs/api-and-database.md) — Endpoints, auth tiers, and Neon Postgres schema
- [`docs/frontend-guide.md`](../../docs/frontend-guide.md) — Angular 21 patterns, state/URL sync, interceptors, and testing
