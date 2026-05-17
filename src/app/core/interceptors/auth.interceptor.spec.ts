import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MockProvider } from 'ng-mocks';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let getToken: ReturnType<typeof vi.fn>;

  function setup(token: string | null = 'test-token') {
    getToken = vi.fn().mockReturnValue(token);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        MockProvider(AuthService, { getToken }),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('adds Authorization header to /api/ requests when token exists', () => {
    setup('my-token');
    http.get('/api/listings').subscribe();
    const req = httpMock.expectOne('/api/listings');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush([]);
  });

  it('does not add Authorization header when token is null', () => {
    setup(null);
    http.get('/api/listings').subscribe();
    const req = httpMock.expectOne('/api/listings');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('does not add Authorization header for non-/api/ requests even with token', () => {
    setup('my-token');
    http.get('/external/resource').subscribe();
    const req = httpMock.expectOne('/external/resource');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });
});
