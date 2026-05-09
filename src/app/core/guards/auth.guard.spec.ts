import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Component } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

@Component({ standalone: true, template: '' })
class StubComponent {}

function makeAuthService(authenticated: boolean) {
  return { isAuthenticated: () => authenticated };
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

  it('allows authenticated users through', () => {
    setup(true);
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects unauthenticated users to /login', () => {
    setup(false);
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
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

  it('allows unauthenticated users to access /login', () => {
    setup(false);
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects authenticated users from /login to /', () => {
    setup(true);
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });
});
