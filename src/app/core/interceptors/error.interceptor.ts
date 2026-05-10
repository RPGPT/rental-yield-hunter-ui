import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'An unexpected error occurred.';

      if (error.status === 0) {
        message = 'Connection error. Please try again.';
      } else if (
        error.status === 401 &&
        !req.url.includes('/auth/') &&
        !req.url.includes('/favorites')
      ) {
        auth.clearSession();
        message = 'Session expired. Please sign in again.';
        router.navigate(['/login']);
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

      return throwError(() => error);
    }),
  );
};
