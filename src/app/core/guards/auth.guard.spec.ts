import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';
import { RouteStubComponent } from '../../../testing/stubs/route-stub.component';

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
          { path: '', component: RouteStubComponent, canMatch: [authGuard] },
          { path: 'login', component: RouteStubComponent },
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
