import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'buy' },
  {
    path: 'buy',
    canMatch: [authGuard],
    data: { mode: 'buy' },
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'rent',
    canMatch: [authGuard],
    data: { mode: 'rent' },
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'listing/:id',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/detail/detail.component').then((m) => m.DetailComponent),
  },
  {
    path: 'listing/:id/snapshot',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/snapshot/snapshot-viewer.component').then(
        (m) => m.SnapshotViewerComponent,
      ),
  },
  {
    path: 'rental/:id',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/rental-detail/rental-detail.component').then(
        (m) => m.RentalDetailComponent,
      ),
  },
  {
    path: 'rental/:id/snapshot',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/snapshot/snapshot-viewer.component').then(
        (m) => m.SnapshotViewerComponent,
      ),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  { path: '**', redirectTo: 'login' },
];
