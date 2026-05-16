# Agents Guide — rental-yield-hunter-ui

Context for AI coding agents working in this repository.

---

## Project Overview

A full-stack Angular application for tracking property listings and analysing rental yield opportunities. Users can browse buy and rent listings scraped from external sources, monitor price history, snapshot listing pages, and identify investment opportunities.

---

## Tech Stack

| Layer       | Technology                                                              |
| ----------- | ----------------------------------------------------------------------- |
| Frontend    | Angular 21, Angular Material, Chart.js / ng2-charts                     |
| Backend     | Node.js HTTP server (`server.ts`), Vercel serverless functions (`api/`) |
| Database    | NeonDB (PostgreSQL serverless) via `@neondatabase/serverless`           |
| Auth        | NeonDB Auth (`NEON_AUTH_URL`) + Angular route guards                    |
| Storage     | Vercel Blob (`@vercel/blob`) for snapshots                              |
| Scraping    | Playwright + `@sparticuz/chromium-min`                                  |
| Testing     | Vitest + ng-mocks + jsdom                                               |
| Package mgr | pnpm (v10)                                                              |
| Deployment  | Vercel                                                                  |

---

## Repository Layout

```
src/
  app/
    core/
      guards/         # Auth guard (authGuard)
      interceptors/   # HTTP interceptors
      models/         # TypeScript interfaces (Listing, RentalListing, FilterState, Stats, …)
      services/       # ApiService, AuthService, FilterStateService, RentalFilterStateService
    features/
      dashboard/      # Buy / rent listings grid (mode driven by route data)
      detail/         # Buy listing detail + price history chart
      rental-detail/  # Rental listing detail + price history chart
      snapshot/       # Embedded snapshot viewer
      login/          # Login page
    shared/           # Reusable components / pipes / directives
api/
  listings/           # GET /api/listings, GET /api/listings/:id, description, snapshot, snapshot-download
  rental-listings/    # GET /api/rental-listings, GET /api/rental-listings/:id
  favorites/          # PATCH /api/favorites
  filters.ts          # GET /api/filters
  rental-filters.ts   # GET /api/rental-filters
  stats.ts            # GET /api/stats
  lib/
    auth.ts           # Session validation helper
    errors.ts         # Shared error helpers
server.ts             # Local dev API server (mirrors Vercel routing)
```

---

## Key Domain Concepts

- **Listing** — a property for sale. Has `price`, `area`, `price_per_m2`, `typology`, `is_rented`, `lifetime_rent`, `active` flags, and `price_history`.
- **RentalListing** — a property for rent. Has `price`, `area`, `rent_price_per_m2`, and `price_history`.
- **Snapshot** — a saved HTML/MHTML capture of a listing's source page, stored in Vercel Blob and served via `/api/listings/snapshot` and `/api/snapshots/:id`.
- **Rental yield** — inferred by comparing buy-listing prices against rental-listing prices in the same area.

---

## Routes

| Path                    | Component / Guard              |
| ----------------------- | ------------------------------ |
| `/`                     | → `/buy`                       |
| `/buy`                  | DashboardComponent (buy mode)  |
| `/rent`                 | DashboardComponent (rent mode) |
| `/listing/:id`          | DetailComponent (lazy)         |
| `/listing/:id/snapshot` | SnapshotViewerComponent (lazy) |
| `/rental/:id`           | RentalDetailComponent (lazy)   |
| `/rental/:id/snapshot`  | SnapshotViewerComponent (lazy) |
| `/login`                | LoginComponent (lazy)          |
| `**`                    | → `/login`                     |

All routes except `/login` are protected by `authGuard`.

---

## API Endpoints (local dev on port 3000)

| Method | Path                              | Description                            |
| ------ | --------------------------------- | -------------------------------------- |
| GET    | `/api/listings`                   | Paginated buy listings with filters    |
| GET    | `/api/listings/:id`               | Buy listing detail + price history     |
| GET    | `/api/listings/description`       | AI-generated description for a listing |
| GET    | `/api/listings/snapshot`          | Trigger snapshot capture               |
| GET    | `/api/listings/snapshot-download` | Download snapshot file                 |
| GET    | `/api/rental-listings`            | Paginated rental listings with filters |
| GET    | `/api/rental-listings/:id`        | Rental listing detail + price history  |
| PATCH  | `/api/favorites`                  | Toggle favourite on a listing          |
| GET    | `/api/filters`                    | Available filter options for buy       |
| GET    | `/api/rental-filters`             | Available filter options for rent      |
| GET    | `/api/stats`                      | Aggregate stats (totals, averages, …)  |
| GET    | `/api/snapshots/:id`              | Serve saved snapshot HTML/MHTML        |

---

## Development Workflow

```bash
# Install dependencies
pnpm install

# Start dev (Angular + API server concurrently)
pnpm start          # Angular on :4200, API on :3000

# Run tests
pnpm test           # Vitest single run
pnpm test:watch     # Vitest watch mode

# Build for production
pnpm build
```

Required environment variables (copy `.env.example` → `.env`):

| Variable        | Purpose                           |
| --------------- | --------------------------------- |
| `DATABASE_URL`  | NeonDB connection string          |
| `NEON_AUTH_URL` | NeonDB Auth endpoint for sessions |

---

## Coding Conventions

- **Angular standalone components** throughout (no NgModules).
- Services use **RxJS** for async data; prefer `Observable` over `Promise`.
- FilterState is managed centrally via `FilterStateService` / `RentalFilterStateService`.
- API handlers follow a Vercel-compatible signature: `(req, res) => Promise<void>`.
- Tests live alongside source files (`*.spec.ts`) and use Vitest + ng-mocks.
- Formatting enforced by Prettier on commit (husky + lint-staged).
