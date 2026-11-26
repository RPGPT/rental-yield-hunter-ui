# Frontend Engineering Guide

Architecture, state management, UI conventions, styling tokens, and testing patterns for the Angular 21 application in `src/`.

---

## 1. Core Angular 21 Architecture

### 1.1 Zoneless + Signals + Standalone

Configured in `src/app/app.config.ts`:

- **`provideZonelessChangeDetection()`**: Angular does **not** rely on `zone.js` monkey-patching in runtime change detection (`zone.js` exists in `devDependencies` only for legacy test tooling compatibility). Every component uses `ChangeDetectionStrategy.OnPush`.
- **Signals First**:
  - Component inputs use `input()` / `input.required()` (`@angular/core`), never `@Input()`.
  - Local reactive state uses `signal()` and `computed()`.
  - Reactive side effects (such as syncing filter state to URL params or triggering API fetches) use `effect()` inside constructors.
  - Services expose `HttpClient` streams as RxJS `Observable`s (`ApiService`), while stateful stores (`AuthService`, `FilterStateService`, `RentalFilterStateService`) expose Signals.
- **Forms**:
  - Simple controls and dialogs (`LoginComponent`, `FiltersPanelComponent`, `MarkAsRentedDialogComponent`) use `FormsModule` (`[(ngModel)]`) or debounced RxJS `Subject`s (`400ms` debounce on numeric filter inputs).
  - `CreateManualListing` uses Angular's **Signal Forms** (`form`, `required`, `min`, `FormField` from `@angular/forms/signals`).

---

## 2. Routing & Navigation

Defined in `src/app/app.routes.ts` (`withComponentInputBinding()` enabled):

| Route                   | Component                 | Loading | Guard       | Notes                                        |
| ----------------------- | ------------------------- | ------- | ----------- | -------------------------------------------- |
| `/`                     | —                         | —       | —           | Redirects to `/buy`                          |
| `/buy`                  | `DashboardComponent`      | Lazy    | `authGuard` | `data: { mode: 'buy' }`                      |
| `/rent`                 | `DashboardComponent`      | Lazy    | `authGuard` | `data: { mode: 'rent' }`                     |
| `/listing/:id`          | `DetailComponent`         | Lazy    | `authGuard` | Buy listing detail, gallery, chart, siblings |
| `/listing/:id/snapshot` | `SnapshotViewerComponent` | Lazy    | `authGuard` | Iframe viewer (`source` omitted)             |
| `/rental/:id`           | `RentalDetailComponent`   | Lazy    | `authGuard` | Rental listing detail, gallery, chart        |
| `/rental/:id/snapshot`  | `SnapshotViewerComponent` | Lazy    | `authGuard` | Iframe viewer (`source=rental`)              |
| `/login`                | `LoginComponent`          | Lazy    | Public      | Email/password sign-in/up + Google OAuth     |
| `**`                    | —                         | —       | —           | Redirects to `/login`                        |

---

## 3. Authentication & HTTP Interceptors

1. **Bootstrap (`APP_INITIALIZER` -> `AuthService.initSession()`)**:
   - When `environment.devBypassAuth` is `true` (default in `src/environments/environment.ts`), stores `{ id: 'dev-user', role: 'admin' }` and `auth_token = 'dev-token'` in `localStorage` immediately.
   - In production (`environment.prod.ts`, `devBypassAuth: false`), calls `authClient.getSession({ query: { disableCookieCache: true } })` via `@neondatabase/neon-js/auth` with a **3-second race timeout** so a slow auth endpoint never hangs initial app boot.
2. **Token Attachment (`authInterceptor`)**:
   - Clones outgoing requests starting with `/api/` and attaches `Authorization: Bearer <token>` from `localStorage`.
3. **Silent Session Refresh & Error Handling (`errorInterceptor`)**:
   - On `401` from `/api/*` (excluding `/auth/` and `/favorites`):
     - Deduplicates concurrent refresh calls via `AuthService.refreshSession()`.
     - Retries the original request with the refreshed Bearer token.
     - If refresh yields `null` or the retry also returns `401`, calls `auth.clearSession()`, navigates to `/login`, and shows a `"Session expired"` `MatSnackBar`.
   - On `404`: Shows `"Listing not found."` snackbar and navigates to `/`.
   - On `0` / `5xx`: Displays user-friendly connection/server error snackbars.

---

## 4. Filter State <-> URL Synchronisation

Buy and Rent filter states live in singleton root services (`FilterStateService` and `RentalFilterStateService`) so filters persist seamlessly when navigating from `/buy` -> `/listing/:id` -> back to `/buy`:

1. **Hydration**: On `DashboardComponent` construction, `route.snapshot.queryParams` is passed to `initFromParams(params)` (using shared parsers in `src/app/core/services/filter-params.util.ts`). Note that `initFromParams` merges present URL params onto the singleton service without resetting omitted signals (except `isHidden` and `deleted`), while `SavedSearchesComponent.apply()` always calls `.reset()` on the target state before `initFromParams()` (even across `/buy` <-> `/rent` switches).
2. **URL Sync**: A signal `effect()` watches `toQueryParams()` and calls `router.navigate([], { queryParams, replaceUrl: true, queryParamsHandling: 'replace' })`. Default values (`sort='price'`, `order='asc'`, `limit=50`, `active=true`, `is_hidden=false`) are omitted from the URL to keep links clean.
3. **Data Fetch & Stale Cancellation**: Another `effect((onCleanup) => ...)` watches `filterState.state()` (which includes `offset`), calling `api.getListings(state)` or `api.getRentalListings(state)` and registering `onCleanup(() => sub.unsubscribe())` so rapid filter/page changes immediately cancel stale in-flight HTTP requests.
4. **Pagination Reset**: Every filter mutation in `FiltersPanelComponent` resets `offset.set(0)` so users are never stranded on an out-of-range page.
5. **Price-Change Cycle Auto-Sort**: Clicking the price-change icon (`cyclePriceChange()`) cycles `null` -> `'reduced'` (auto-setting `sort = 'price_drop_pct'`, `order = 'desc'`) -> `'increased'` -> `null` (resetting `sort = 'price'`, `order = 'asc'` if still on `price_drop_pct`). In Rent mode, `/api/rental-listings` falls back to `sort = 'price'` since `price_drop_pct` is only in Buy's `allowedSorts`.

### Subtle Encoding Differences (URL vs. API)

Be careful with two parameters whose URL representation differs from the API query string (`toQueryParams()` vs. `buildQueryParams()` in `src/app/shared/utils/query-params.util.ts`):

- **`rental_yield_min`**: UI input is in **percent** (`6` = 6%), stored in signal and sent to API as **decimal** (`0.06`).
- **`is_hidden` (Buy only)**:
  - Signal `false` (default: hide hidden rows) -> omitted from browser URL (`/buy`), sent to API as `is_hidden=false`.
  - Signal `null` (show all rows including hidden) -> browser URL `?is_hidden=all`, omitted from API params.
- **`active`**:
  - Signal `true` (default: active only) -> omitted from browser URL, sent to API as `active=true`.
  - Signal `null` (both active & inactive) -> browser URL `?active=all`, omitted from API params.

---

## 5. Notable UI Component Patterns

- **Optimistic Table Overrides (`ListingsTableComponent`)**:
  - Toggling favourite or hidden status updates `favoriteOverrides` / `hiddenOverrides` signals immediately without refetching the entire page, reverting on HTTP error.
  - Unfavouriting while `isFavorite() === true`, hiding while `isHidden() !== true`, or restoring a deleted listing in Trash view adds the row ID to `hiddenFromFilter` so it disappears smoothly from `visibleListings()`.
- **Reusable Gallery & Description Modules**:
  - `ImageGalleryComponent` (`src/app/shared/components/image-gallery/`) encapsulates the double-buffered crossfade (`slotA`, `slotB`, `requestAnimationFrame`), thumbnail strip, counter, and `ArrowLeft`/`ArrowRight` keyboard navigation for both `DetailComponent` and `RentalDetailComponent`.
  - `DescriptionCardComponent` (`src/app/shared/components/description-card/`) renders sanitized portal HTML, loading state, or plain-text fallback.
  - Pure domain formatting, yield math, tooltips, and portal URL helpers live in `src/app/shared/utils/listing.util.ts`.
- **Reactive Detail Route Transitions**:
  - Both `DetailComponent` and `RentalDetailComponent` subscribe to `route.paramMap` (with `Subscription` cleanup on ID changes) so clicking `cluster_siblings` links (`/listing/:sibId`) reloads the component cleanly in place.
- **Caching in `ApiService`**:
  - `getFilterOptions()` and `getRentalFilterOptions()` are cached for the session lifetime with `shareReplay({ bufferSize: 1, refCount: true })`.
  - `getStats()` uses a 30-second TTL cache (`CACHE_DURATION = 30_000`).

---

## 6. Styling, Theming & Bundle Budgets

- **Preprocessor Paths**: `angular.json` configures `stylePreprocessorOptions.includePaths: ["src/styles"]`, allowing any component SCSS file to import shared tokens directly:
  ```scss
  @use 'colors' as *;
  @use 'sizes' as *;
  ```
- **Palette & Dark Mode**:
  - Warm terracotta palette defined in `src/styles/_colors.scss` (`$color-primary: #b57460`, `$color-bg: #f7f2ed`, `$color-dark-bg: #1a1210`) paired with Angular Material 3 `mat.$rose-palette` / `mat.$orange-palette` in `src/styles/_theme.scss`.
  - `App` (`src/app/app.ts`) toggles `.dark-theme` on `document.documentElement` and persists `'dark' | 'light'` in `localStorage.getItem('theme')`.
  - TypeScript chart colours live in `src/styles/chart-colors.ts` (`CHART_COLORS`, using `#1565C0` blue for Chart.js line/fill datasets).
- **Component Style Budget**:
  - `angular.json` enforces **5 kB warning / 8 kB error** per component stylesheet (`anyComponentStyle`). Keep shared subviews (such as `ImageGalleryComponent` and `DescriptionCardComponent`) in dedicated components so detail stylesheets remain well below the 5 kB warning threshold.

---

## 7. Testing Guide (Vitest)

Configured in `vitest.config.ts` with **two isolated projects** under one test runner (`pnpm test`), covering both unit specs and **real-data integration flows** against Neon Postgres (auto-skipped via `describe.skipIf` if `DATABASE_URL` is absent):

1. **`angular` project (`src/**/\*.spec.ts`)\*\*:
   - Runs in `jsdom` via `@analogjs/vite-plugin-angular` and `src/test-setup.ts`.
   - Unit tests use `TestBed` and `ng-mocks`; call `fixture.detectChanges()` (or `TestBed.flushEffects()`) after updating signals.
   - **Real-Data UI Flows (`src/app/flows/app-flows.real-data.spec.ts`)**: Mounts real routes, components, `FilterStateService` / `RentalFilterStateService`, `ApiService`, and HTTP interceptors over an in-process `HttpBackend` bridge wired directly to the `api/` handlers + Neon Postgres using an ephemeral user token cleaned up in `afterAll`.
2. **`api` project (`api/**/\*.spec.ts`)\*\*:
   - Runs in `node` environment.
   - Unit tests mock `@neondatabase/serverless` and assert responses with `MockRes` (`api/_test/mock-res.ts`).
   - **Real-Data API Flows (`api/_test/real-data-flows.spec.ts`)**: Exercises all 7 major buy, rent, cluster, stats, favourite/hidden, saved-search, and admin manual-listing/trash flows directly against Neon Postgres with `afterAll` cleanup.
