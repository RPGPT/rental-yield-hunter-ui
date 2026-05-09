import { describe, it, expect, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

@Component({ standalone: true, template: '' })
class StubComponent {}

function makeAuthService(authenticated: boolean) {
  return {
    isAuthenticated: () => authenticated,
    initSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe('authGuard', () => {
  let router: Router;

  function setup(authenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: '', component: StubComponent, canMatch: [authGuard] },
          { path: 'login', component: StubComponent },
        ]),
        { provide: AuthService, useValue: makeAuthService(authenticated) },
      ],
    });
    router = TestBed.inject(Router);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('allows authenticated users to access protected route', async () => {
    setup(true);
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects unauthenticated users to /login', async () => {
    setup(false);
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('calls initSession before checking auth', async () => {
    setup(true);
    const auth = TestBed.inject(AuthService);
    await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(auth.initSession).toHaveBeenCalledOnce();
  });
});

describe('guestGuard', () => {
  let router: Router;

  function setup(authenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: '', component: StubComponent },
          { path: 'login', component: StubComponent, canMatch: [guestGuard] },
        ]),
        { provide: AuthService, useValue: makeAuthService(authenticated) },
      ],
    });
    router = TestBed.inject(Router);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('allows unauthenticated users to access /login', async () => {
    setup(false);
    const result = await TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects authenticated users away from /login to /', async () => {
    setup(true);
    const result = await TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });

  it('calls initSession before checking auth', async () => {
    setup(false);
    const auth = TestBed.inject(AuthService);
    await TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    expect(auth.initSession).toHaveBeenCalledOnce();
  });
});
