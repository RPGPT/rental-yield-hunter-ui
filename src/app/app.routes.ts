import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'buy' },
  { path: 'buy', component: DashboardComponent, canMatch: [authGuard], data: { mode: 'buy' } },
  { path: 'rent', component: DashboardComponent, canMatch: [authGuard], data: { mode: 'rent' } },
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
