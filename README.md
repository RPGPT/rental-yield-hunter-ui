# Rental Yield Hunter UI

A full-stack real estate analytics web application for tracking Portuguese buy and rental property listings, estimating market rents and gross yields, uncovering multi-agency price arbitrage, analysing tenanted lease-reversion upside, and archiving full-page snapshots for offline review.

Listings, price histories, market rent estimates, contract extractions, and physical apartment clusters are populated in Neon Postgres by the companion **`rental-yield-hunter`** scraping pipeline across **Imovirtual** (`imovirtual`), **ERA** (`era`), and **Casa Sapo** (`casasapo`), alongside manual listings created by admins directly in the UI.

---

## Features

- **Dual Buy & Rent Modes (`/buy`, `/rent`)** — Filterable, sortable, paginated Angular Material tables with bidirectional URL query parameter synchronisation.
- **Market Rent & Gross Yield Estimates** — Displays non-linear size-curved (`area^0.30`) market rent estimates, confidence badges (`high` / `medium` / `low`), comparable sample counts, and match levels (`neighborhood`, `city`, `neighborhood_broad`, `city_broad`).
- **Tenanted Contract & Reversion Upside** — Surfaces extracted lease rent, confidence, raw ad excerpts, expiry countdowns (`Expiring soon` within 180 days), current contract yield, market reversion yield, and percentage rent upside.
- **Multi-Agency & Cross-Portal Deduplication** — Groups ads representing the same physical apartment (`listing_clusters`), highlights cheapest listings and price spreads (`-€X · N ads`), filters to cheapest-per-apartment (`deduplicate=true`), and links sibling ads on the detail page.
- **Price History & Single-Cut Drop Signals** — Tracks `initial_price`, `price_drop_amount`, `price_drop_pct`, and historical captures (`listing_price_history`), reconstructing initial price points so even single-cut reductions plot cleanly on Chart.js line charts.
- **Live Portal Description & Gallery Hydration** — Lazily fetches rich descriptions and high-resolution galleries directly from Imovirtual, ERA, and Casa Sapo when viewing a listing.
- **Saved Searches & Deal Alerts** — Save named filter presets in either Buy or Rent mode with unread `new_matches` and `price_drops` badge counters since last check; backed by automated backend deal notifications (`alert_notifications`).
- **Favourites & Offline Page Snapshots** — Star listings and capture self-contained HTML snapshots (inlined CSS/fonts + embedded base64 gallery lightbox), stored in private Vercel Blob in production or `snapshots/` locally, viewable inside an in-app iframe viewer.
- **Per-User Hidden Listings** — Hide uninteresting buy listings from the default feed (`user_hidden`) and toggle visibility at any time.
- **Admin Moderation & Manual Entry** — Admins can add manual listings (`source = 'manual'`), mark listings as Rented / Lifetime Rent / Not Rented with contract terms, soft-delete listings (logged to `audit_log`), and restore deleted items from the Trash view.
- **Authentication & Theme** — Email/password and Google OAuth sign-in via Neon Auth with automatic silent session refresh on `401`, plus persistent dark/light terracotta Material 3 theming.

### Roles & Permissions

| Capability                                                             | Signed-In User | Admin (`role = 'admin'`) |
| ---------------------------------------------------------------------- | :------------: | :----------------------: |
| Browse, filter, sort Buy (`/buy`) & Rent (`/rent`) listings            |       ✅       |            ✅            |
| Favourite listings, trigger/view snapshots, save searches & hide items |       ✅       |            ✅            |
| Create manual listings (`+` button on dashboard)                       |       —        |            ✅            |
| Mark listing Rented / Lifetime Rent / Not Rented (detail `⋮` menu)     |       —        |            ✅            |
| Soft-delete listings & restore from Trash filter (`delete_outline`)    |       —        |            ✅            |

---

## Tech Stack

| Layer            | Technology                                                                       |
| ---------------- | -------------------------------------------------------------------------------- |
| Frontend         | Angular 21 (zoneless change detection, standalone components, signals, `OnPush`) |
| UI & Charts      | Angular Material 21 (Material 3 custom theme), Chart.js 4 + `ng2-charts`         |
| API              | Vercel Serverless Functions (`api/`, TypeScript ESM) + Node HTTP dev server      |
| Database         | Neon Serverless Postgres (`@neondatabase/serverless`)                            |
| Authentication   | Neon Auth (`@neondatabase/neon-js/auth` + JWKS/DB role verification)             |
| Snapshot Capture | `playwright-core` + `@sparticuz/chromium-min` (prod) / `single-file-cli` (dev)   |
| Snapshot Storage | Private Vercel Blob (`@vercel/blob`) in prod / local `snapshots/` in dev         |
| Testing          | Vitest 4 (`angular` jsdom project + `api` node project), `ng-mocks`              |
| Tooling          | pnpm 10, Husky + `lint-staged` + Prettier                                        |

---

## Project Structure

```text
src/
  app/
    core/
      guards/                  # authGuard (CanMatchFn)
      interceptors/            # authInterceptor (Bearer token), errorInterceptor (401 refresh + snackbars)
      models/                  # Listing, RentalListing, FilterState, SavedSearch, Stats, AuthUser
      services/                # ApiService, AuthService, FilterStateService, RentalFilterStateService
    features/
      dashboard/               # Buy/Rent container, filters-panel, listings-table, saved-searches, stats-bar
      detail/                  # Buy listing detail, gallery, price-chart, mark-as-rented dialog, sibling ads
      rental-detail/           # Rental listing detail, gallery, price-chart
      snapshot/                # Iframe viewer for archived listing snapshots
      create-manual-listing/   # Admin dialog using Angular Signal Forms (@angular/forms/signals)
      login/                   # Email/password + Google OAuth login/signup
    shared/                    # ImageGalleryComponent, DescriptionCardComponent, BadgeComponent, pipes, listing & query utils
    flows/                     # Full-stack Angular + real Neon data integration flow tests
  environments/                # environment.ts (devBypassAuth: true) & environment.prod.ts
  styles/                      # Warm terracotta Material 3 theme, colour & size tokens, chart colours

api/                           # Vercel Serverless Functions (12/12 Hobby plan function slots used)
  _lib/                        # Modular backend core (auth, listings-query, rental-listings-query, portals, price-history, saved-searches, audit, errors)
  _test/                       # API test helpers (mock-res.ts) + real-data Neon flow suite (real-data-flows.spec.ts)
  _types.ts                    # VercelRequest / VercelResponse types
  listings/                    # index.ts, [id].ts, description.ts, snapshot.ts, snapshot-download.ts
  rental-listings/             # index.ts, [id].ts
  favorites/index.ts           # Per-user favourites CRUD
  hidden/index.ts              # Per-user hidden CRUD + multiplexed ?resource=saved-searches
  filters.ts                   # Distinct buy filter dropdown options
  rental-filters.ts            # Distinct rent filter dropdown options
  stats.ts                     # Portfolio aggregate metrics

server.ts                      # Local HTTP dev server (:3000) mirroring Vercel function routing
docs/                          # Detailed architecture, API/DB schema, and frontend guides
AGENTS.md                      # Context & constraints for AI coding agents
```

---

## Local Development

### Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (`corepack enable` or `npm i -g pnpm`)
- Access to the **Neon Postgres** database

### Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create `.env` from `.env.example`:

   ```bash
   cp .env.example .env
   ```

3. Configure environment variables in `.env` (see table below).

   > **Dev Auth Bypass:** By default, `src/environments/environment.ts` sets `devBypassAuth: true`, which automatically signs in locally as an admin `Dev User` (`dev-token`) without hitting Neon Auth. Set `devBypassAuth: false` if you want to test the real Neon Auth login flow locally.

### Run

```bash
pnpm start
```

Starts both servers concurrently:

- **Angular dev server**: `http://localhost:4200` (proxies `/api` to `:3000` via `proxy.conf.json`)
- **API dev server**: `http://localhost:3000` (`tsx watch server.ts`)

### Test, Format & Build

```bash
pnpm test          # Run both Angular (jsdom) and API (node) Vitest suites once
pnpm test:watch    # Run Vitest in interactive watch mode
pnpm build         # Production build to dist/rental-yield-hunter-ui/browser
```

Formatting is enforced automatically on `git commit` via Husky + `lint-staged` + Prettier.

---

## Environment Variables

| Variable                | Required   | Description                                                               |
| ----------------------- | ---------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`          | Yes        | Neon Postgres connection string                                           |
| `NEON_AUTH_URL`         | Yes (prod) | Neon Auth base URL (used for JWKS verification and `/get-session` lookup) |
| `NEON_AUTH_JWKS_URL`    | Optional   | Neon Auth JWKS reference URL                                              |
| `BLOB_READ_WRITE_TOKEN` | Yes (prod) | Vercel Blob read/write token for private HTML snapshot storage            |
| `CHROMIUM_DOWNLOAD_URL` | Optional   | Override `@sparticuz/chromium-min` tar pack URL (defaults to v148.0.0)    |

---

## Key Workflows

### Hidden Listings (Buy Mode)

Click the eye icon on any buy listing row or detail page to hide it (`user_hidden`). Use the eye toggle in the filters panel to switch between:

- **Default (`/buy`)**: Hides listings marked hidden by the current user (`is_hidden=false`).
- **Show all (`/buy?is_hidden=all`)**: Includes hidden listings alongside visible ones.

### Page Snapshots

Snapshots are triggered automatically when favouriting a listing or manually via the **Save page snapshot** icon on the detail page:

- **Production (`VERCEL=1`)**: Headless Chromium (`playwright-core` + `@sparticuz/chromium-min`, 300s function timeout) renders the listing page, strips external scripts, inlines stylesheets/fonts as `data:` URIs, injects an offline base64 image gallery lightbox, uploads the self-contained HTML to private Vercel Blob, records the URL in `listing_snapshots`, and serves it inline via `/api/listings/snapshot-download?id=<id>` inside the `/listing/:id/snapshot` (or `/rental/:id/snapshot`) viewer.
- **Local Dev**: Runs `single-file-cli` to capture a self-contained HTML file into `snapshots/<id>.html`, served both directly at `http://localhost:3000/api/snapshots/<id>` and through `/api/listings/snapshot-download?id=<id>` inside the in-app `/snapshot` viewer.

### Deployment

Pushing to `main` triggers automatic deployment on Vercel (`vercel.json`):

- Static Angular SPA served from `dist/rental-yield-hunter-ui/browser` with SPA fallback rewrites (`/((?!api/).*)` → `/index.html`).
- Serverless API functions deployed from `api/` (**Note:** the repo uses all **12 of 12** serverless functions permitted on the Vercel Hobby plan — see [`AGENTS.md`](./AGENTS.md) and [`docs/api-and-database.md`](./docs/api-and-database.md) before adding endpoints).

---

## Documentation & Agent Context

- [`AGENTS.md`](./AGENTS.md) — Quick-start context, architectural invariants, and guardrails for AI coding assistants.
- [`docs/architecture.md`](./docs/architecture.md) — Domain model, yield/reversion/clustering logic, snapshot & live-hydration flows.
- [`docs/api-and-database.md`](./docs/api-and-database.md) — Full HTTP endpoint specification, auth verification tiers, Vercel function multiplexing, and Neon Postgres schema.
- [`docs/frontend-guide.md`](./docs/frontend-guide.md) — Angular 21 zoneless signals patterns, state-to-URL sync, interceptors, styling budgets, and Vitest testing guide.
