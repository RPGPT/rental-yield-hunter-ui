import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, from, of, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);
  const auth = inject(AuthService);

  const notifyError = (error: HttpErrorResponse): void => {
    let message = 'An unexpected error occurred.';

    if (error.status === 0) {
      message = 'Connection error. Please try again.';
    } else if (error.status === 404) {
      message = 'Listing not found.';
      router.navigate(['/']);
    } else if (error.status >= 500) {
      message = 'Server error. Please try again later.';
    }

    snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  };

  const expireSession = (error: HttpErrorResponse) => {
    auth.clearSession();
    router.navigate(['/login']);
    snackBar.open('Session expired. Please sign in again.', 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
    return throwError(() => error);
  };

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isProtectedApi401 =
        error.status === 401 &&
        req.url.startsWith('/api/') &&
        !req.url.includes('/auth/') &&
        !req.url.includes('/favorites');

      if (isProtectedApi401) {
        const currentToken = auth.getToken();
        const requestToken = req.headers.get('Authorization');
        const refresh$ =
          currentToken && requestToken !== `Bearer ${currentToken}`
            ? of(currentToken)
            : currentToken
              ? from(auth.refreshSession())
              : of(null);

        return refresh$.pipe(
          catchError((refreshError: unknown) => {
            notifyError(
              refreshError instanceof HttpErrorResponse
                ? refreshError
                : new HttpErrorResponse({ error: refreshError }),
            );
            return throwError(() => refreshError);
          }),
          switchMap((token) => {
            if (!token) return expireSession(error);

            return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
              catchError((retryError: HttpErrorResponse) => {
                if (retryError.status === 401) return expireSession(retryError);
                notifyError(retryError);
                return throwError(() => retryError);
              }),
            );
          }),
        );
      }

      notifyError(error);
      return throwError(() => error);
    }),
  );
};
