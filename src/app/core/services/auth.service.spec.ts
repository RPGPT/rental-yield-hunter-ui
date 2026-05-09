import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { AuthService } from './auth.service';

// Stub route target
@Component({ standalone: true, template: '' })
class StubComponent {}

// Mock the authClient returned by createAuthClient
const mockAuthClient = {
  getSession: vi.fn(),
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: vi.fn() },
  signOut: vi.fn(),
};

vi.mock('@neondatabase/neon-js/auth', () => ({
  createAuthClient: () => mockAuthClient,
}));

vi.mock('../../../environments/environment', () => ({
  environment: {
    production: false,
    apiUrl: '/api',
    neonAuthUrl: 'https://fake.neonauth.test',
    devBypassAuth: false,
  },
}));

const MOCK_USER = { id: 'u1', email: 'u@test.com', name: 'Test User', image: null };
const MOCK_AUTH_USER = { id: 'u1', email: 'u@test.com', name: 'Test User', picture: null };
const MOCK_TOKEN = 'tok-123';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([
        { path: '', component: StubComponent },
        { path: 'login', component: StubComponent },
      ]),
    ],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  // ── isAuthenticated / currentUser ────────────────────────────────────────

  it('starts unauthenticated when localStorage is empty', () => {
    const svc = setup();
    expect(svc.isAuthenticated()).toBe(false);
    expect(svc.currentUser()).toBeNull();
  });

  it('restores user from localStorage on creation', () => {
    localStorage.setItem('auth_user', JSON.stringify(MOCK_AUTH_USER));
    localStorage.setItem('auth_token', MOCK_TOKEN);
    const svc = setup();
    expect(svc.isAuthenticated()).toBe(true);
    expect(svc.currentUser()).toEqual(MOCK_AUTH_USER);
  });

  it('getToken returns stored token', () => {
    localStorage.setItem('auth_token', MOCK_TOKEN);
    const svc = setup();
    expect(svc.getToken()).toBe(MOCK_TOKEN);
  });

  it('getToken returns null when no token stored', () => {
    const svc = setup();
    expect(svc.getToken()).toBeNull();
  });

  // ── clearSession ─────────────────────────────────────────────────────────

  it('clearSession removes user, token and sets currentUser to null', () => {
    localStorage.setItem('auth_user', JSON.stringify(MOCK_AUTH_USER));
    localStorage.setItem('auth_token', MOCK_TOKEN);
    const svc = setup();
    svc.clearSession();
    expect(svc.currentUser()).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });

  // ── initSession ──────────────────────────────────────────────────────────

  it('initSession stores user and token when getSession returns valid data', async () => {
    mockAuthClient.getSession.mockResolvedValue({
      data: { user: MOCK_USER, session: { token: MOCK_TOKEN } },
    });
    const svc = setup();
    await svc.initSession();
    expect(svc.isAuthenticated()).toBe(true);
    expect(svc.currentUser()).toEqual(MOCK_AUTH_USER);
    expect(localStorage.getItem('auth_token')).toBe(MOCK_TOKEN);
  });

  it('initSession clears session when getSession returns no user', async () => {
    mockAuthClient.getSession.mockResolvedValue({ data: null });
    localStorage.setItem('auth_user', JSON.stringify(MOCK_AUTH_USER));
    const svc = setup();
    await svc.initSession();
    expect(svc.isAuthenticated()).toBe(false);
    expect(svc.currentUser()).toBeNull();
  });

  it('initSession clears session and does not throw when getSession throws', async () => {
    mockAuthClient.getSession.mockRejectedValue(new Error('network error'));
    localStorage.setItem('auth_user', JSON.stringify(MOCK_AUTH_USER));
    const svc = setup();
    await expect(svc.initSession()).resolves.toBeUndefined();
    expect(svc.isAuthenticated()).toBe(false);
  });

  // ── signInWithEmail ───────────────────────────────────────────────────────

  it('signInWithEmail stores session and navigates to / on success', async () => {
    mockAuthClient.signIn.email.mockResolvedValue({ error: null });
    mockAuthClient.getSession.mockResolvedValue({
      data: { user: MOCK_USER, session: { token: MOCK_TOKEN } },
    });
    const svc = setup();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');
    await svc.signInWithEmail('u@test.com', 'pass');
    expect(svc.isAuthenticated()).toBe(true);
    expect(navSpy).toHaveBeenCalledWith(['/']);
  });

  it('signInWithEmail throws when authClient returns an error', async () => {
    mockAuthClient.signIn.email.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    const svc = setup();
    await expect(svc.signInWithEmail('u@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });

  // ── logout ────────────────────────────────────────────────────────────────

  it('logout clears session and navigates to /login', async () => {
    mockAuthClient.signOut.mockResolvedValue({});
    localStorage.setItem('auth_user', JSON.stringify(MOCK_AUTH_USER));
    localStorage.setItem('auth_token', MOCK_TOKEN);
    const svc = setup();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');
    await svc.logout();
    expect(svc.isAuthenticated()).toBe(false);
    expect(navSpy).toHaveBeenCalledWith(['/login']);
  });
});
