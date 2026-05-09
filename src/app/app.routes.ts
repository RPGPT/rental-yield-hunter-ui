import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent, canMatch: [authGuard] },
  {
    path: 'listing/:id',
    canMatch: [authGuard],
    loadComponent: () =>
      import('./features/detail/detail.component').then((m) => m.DetailComponent),
  },
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  { path: '**', redirectTo: '' },
];
