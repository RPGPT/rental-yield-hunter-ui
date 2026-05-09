import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Redirects unauthenticated users to /login. */
export const authGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initSession();
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

/** Redirects already-authenticated users away from /login to /. */
export const guestGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.initSession();
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
