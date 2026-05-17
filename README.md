# Rental Yield Hunter

A personal tool for tracking and analysing real estate listings for rental yield opportunities. Browse listings scraped from property portals, filter by every relevant attribute, monitor price history, and save snapshots of favourited listings for offline review.

## Features

- Filterable, sortable, paginated listings table
- Price history chart per listing
- Favourite listings with automatic page snapshot (saved to Vercel Blob in production, local file in dev)
- Hidden listings — hide a listing from the default view with the eye icon; toggle the filter to show all or only hidden listings
- Dark / light theme toggle
- Stats bar with portfolio-level aggregations
- Admin-only context menu on listing detail to mark listings as Rented or Lifetime Rent
- Fully deployed on Vercel with a serverless API and Neon Postgres database

## Stack

| Layer            | Technology                                                                |
| ---------------- | ------------------------------------------------------------------------- |
| Frontend         | Angular 21 (standalone components, signals, OnPush)                       |
| UI               | Angular Material 21                                                       |
| Charts           | Chart.js + ng2-charts                                                     |
| API              | Vercel Serverless Functions (TypeScript)                                  |
| Database         | Neon (serverless Postgres)                                                |
| Snapshot storage | Vercel Blob (production) / local filesystem (dev)                         |
| Snapshot capture | Playwright + @sparticuz/chromium-min (production) / single-file-cli (dev) |
| Hosting          | Vercel                                                                    |

## Architecture

```
src/
  app/
    core/
      models/          # TypeScript interfaces (Listing, FilterState, Stats)
      services/        # ApiService, FilterStateService
      interceptors/    # HTTP error interceptor
    features/
      dashboard/       # Listings table, filters panel, stats bar
      detail/          # Listing detail view with price chart
    shared/            # Reusable pipes, components, utils
  environments/        # environment.ts / environment.prod.ts
  styles/              # Material theme, variables, global SCSS

api/
  listings/
    index.ts           # GET /api/listings  (filtered, paginated)
    [id].ts            # GET /api/listings/:id  |  PATCH (rented / lifetime-rent — admin only)
    snapshot.ts        # GET/POST /api/listings/:id/snapshot
  favorites/
    index.ts           # GET/POST/DELETE /api/favorites
  hidden/
    index.ts           # GET/POST/DELETE /api/hidden
  stats.ts             # GET /api/stats
  filters.ts           # GET /api/filters  (distinct values for filter dropdowns)

server.ts              # Local dev HTTP server — mirrors Vercel function routing
```

The Angular app proxies all `/api` requests to `localhost:3000` in development (via `proxy.conf.json`). On Vercel the same `api/` handlers run as serverless functions.

## Local development

### Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- A [Neon](https://neon.tech) Postgres database

### Setup

```bash
pnpm install
```

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgres://...
```

### Run

```bash
pnpm start
```

This starts both the Angular dev server (`localhost:4200`) and the API dev server (`localhost:3000`) concurrently.

## Environment variables

| Variable                | Required        | Description                                                |
| ----------------------- | --------------- | ---------------------------------------------------------- |
| `DATABASE_URL`          | ✅              | Neon Postgres connection string                            |
| `BLOB_READ_WRITE_TOKEN` | ✅ (production) | Vercel Blob token for snapshot storage                     |
| `CHROMIUM_DOWNLOAD_URL` | ❌              | Override Chromium binary URL for `@sparticuz/chromium-min` |

## Deployment

The project deploys automatically to Vercel on every push to `main`.

Manual deploy:

```bash
pnpm run build
```

Vercel picks up the `api/` directory as serverless functions and serves the Angular build from `dist/rental-yield-hunter-ui/browser`.

To set up Vercel Blob for snapshots: Vercel dashboard → Storage → Create Blob store → copy `BLOB_READ_WRITE_TOKEN` to project environment variables.

## Hidden listings

The eye icon (👁) on each row in the listings table and on the listing detail page lets you hide a listing from your default view. Hidden state is user-specific and stored in the `user_hidden` table.

**Filter behaviour (buy listings only):**

| Filter state          | URL                  | What you see                  |
| --------------------- | -------------------- | ----------------------------- |
| Default (hide hidden) | `/buy`               | All non-hidden listings       |
| Show all              | `/buy?is_hidden=all` | All listings including hidden |

Click the eye icon in the filters panel to toggle between the two states. Hidden listings are shown with a red eye icon in the table.

## Snapshot feature

When a listing is favourited, a full-page snapshot is captured and stored:

- **Production**: Playwright renders the page via headless Chromium, captures it as MHTML, and uploads to Vercel Blob. The blob URL is returned and stored for direct access.
- **Dev**: `single-file-cli` saves a self-contained HTML file to `snapshots/` locally. Served at `/api/snapshots/:id`.

On the listing detail page, a **Open Saved Page** button appears if a snapshot exists.
