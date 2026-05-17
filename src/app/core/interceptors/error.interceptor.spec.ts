import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let snackBar: MatSnackBar;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    snackBar = TestBed.inject(MatSnackBar);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('passes through successful responses', () => {
    let result: unknown;
    http.get('/test').subscribe({ next: (v) => (result = v) });
    httpMock.expectOne('/test').flush({ ok: true });
    expect(result).toEqual({ ok: true });
  });

  it('shows connection error message on status 0', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    http.get('/test').subscribe({ error: () => {} });
    httpMock.expectOne('/test').flush(null, { status: 0, statusText: 'Unknown' });
    expect(openSpy).toHaveBeenCalledWith(
      'Connection error. Please try again.',
      'Close',
      expect.any(Object),
    );
  });

  it('shows "Listing not found" and navigates to / on 404', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    const navSpy = vi.spyOn(router, 'navigate');
    http.get('/test').subscribe({ error: () => {} });
    httpMock.expectOne('/test').flush(null, { status: 404, statusText: 'Not Found' });
    expect(openSpy).toHaveBeenCalledWith('Listing not found.', 'Close', expect.any(Object));
    expect(navSpy).toHaveBeenCalledWith(['/']);
  });

  it('shows server error message on status 500', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    http.get('/test').subscribe({ error: () => {} });
    httpMock.expectOne('/test').flush(null, { status: 500, statusText: 'Error' });
    expect(openSpy).toHaveBeenCalledWith(
      'Server error. Please try again later.',
      'Close',
      expect.any(Object),
    );
  });

  it('shows server error message on status 503 (>= 500)', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    http.get('/test').subscribe({ error: () => {} });
    httpMock.expectOne('/test').flush(null, { status: 503, statusText: 'Unavailable' });
    expect(openSpy).toHaveBeenCalledWith(
      'Server error. Please try again later.',
      'Close',
      expect.any(Object),
    );
  });

  it('shows generic message for other error statuses (e.g. 422)', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    http.get('/test').subscribe({ error: () => {} });
    httpMock.expectOne('/test').flush(null, { status: 422, statusText: 'Unprocessable' });
    expect(openSpy).toHaveBeenCalledWith(
      'An unexpected error occurred.',
      'Close',
      expect.any(Object),
    );
  });

  it('re-throws the error so subscribers can handle it', () => {
    let caughtError: unknown;
    http.get('/test').subscribe({ error: (e) => (caughtError = e) });
    httpMock.expectOne('/test').flush(null, { status: 400, statusText: 'Bad Request' });
    expect(caughtError).toBeTruthy();
  });

  it('shows "Session expired" and navigates to /login on 401 for non-auth non-favorites URL', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    const navSpy = vi.spyOn(router, 'navigate');
    http.get('/api/listings').subscribe({ error: () => {} });
    httpMock.expectOne('/api/listings').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(openSpy).toHaveBeenCalledWith(
      'Session expired. Please sign in again.',
      'Close',
      expect.any(Object),
    );
    expect(navSpy).toHaveBeenCalledWith(['/login']);
  });

  it('does NOT show session-expired message for 401 on /auth/ URL', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    const navSpy = vi.spyOn(router, 'navigate');
    http.get('/auth/login').subscribe({ error: () => {} });
    httpMock.expectOne('/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    // Should show generic message, not navigate to /login
    expect(navSpy).not.toHaveBeenCalledWith(['/login']);
    expect(openSpy).toHaveBeenCalledWith(
      'An unexpected error occurred.',
      'Close',
      expect.any(Object),
    );
  });

  it('does NOT show session-expired message for 401 on /favorites URL', () => {
    const openSpy = vi.spyOn(snackBar, 'open');
    const navSpy = vi.spyOn(router, 'navigate');
    http.get('/api/favorites').subscribe({ error: () => {} });
    httpMock.expectOne('/api/favorites').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(navSpy).not.toHaveBeenCalledWith(['/login']);
    expect(openSpy).toHaveBeenCalledWith(
      'An unexpected error occurred.',
      'Close',
      expect.any(Object),
    );
  });
});
