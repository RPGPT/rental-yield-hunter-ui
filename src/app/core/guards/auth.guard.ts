import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Redirects unauthenticated users to /login. Synchronous — trusts stored session. */
export const authGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const authed = auth.isAuthenticated();
  console.log('[authGuard] isAuthenticated=', authed);
  return authed ? true : router.createUrlTree(['/login']);
};
