import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';

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
const MOCK_AUTH_USER = {
  id: 'u1',
  email: 'u@test.com',
  name: 'Test User',
  picture: null,
  role: null,
};
const MOCK_TOKEN = 'tok-123';

function setup() {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideRouter([])],
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

  it('starts unauthenticated when localStorage is empty', () => {
    const svc = setup();
    expect(svc.isAuthenticated()).toBe(false);
    expect(svc.currentUser()).toBeNull();
  });

  it('isAdmin returns false when not authenticated', () => {
    const svc = setup();
    expect(svc.isAdmin()).toBe(false);
  });

  it('isAdmin returns false when user has no role', () => {
    localStorage.setItem('auth_user', JSON.stringify(MOCK_AUTH_USER));
    const svc = setup();
    expect(svc.isAdmin()).toBe(false);
  });

  it('isAdmin returns true when user has admin role', () => {
    localStorage.setItem('auth_user', JSON.stringify({ ...MOCK_AUTH_USER, role: 'admin' }));
    const svc = setup();
    expect(svc.isAdmin()).toBe(true);
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

  it('clearSession removes user, token and sets currentUser to null', () => {
    localStorage.setItem('auth_user', JSON.stringify(MOCK_AUTH_USER));
    localStorage.setItem('auth_token', MOCK_TOKEN);
    const svc = setup();
    svc.clearSession();
    expect(svc.currentUser()).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });

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

  it('loadStoredUser returns null when localStorage has invalid JSON', () => {
    localStorage.setItem('auth_user', 'not-valid-json{{{');
    const svc = setup();
    expect(svc.currentUser()).toBeNull();
  });

  it('signUpWithEmail stores session and navigates to / on success', async () => {
    mockAuthClient.signUp.email.mockResolvedValue({ error: null });
    mockAuthClient.getSession.mockResolvedValue({
      data: { user: MOCK_USER, session: { token: MOCK_TOKEN } },
    });
    const svc = setup();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');
    await svc.signUpWithEmail('u@test.com', 'pass', 'Test');
    expect(svc.isAuthenticated()).toBe(true);
    expect(navSpy).toHaveBeenCalledWith(['/']);
  });

  it('signUpWithEmail throws when authClient returns an error', async () => {
    mockAuthClient.signUp.email.mockResolvedValue({ error: { message: 'Email taken' } });
    const svc = setup();
    await expect(svc.signUpWithEmail('u@test.com', 'pass', 'Test')).rejects.toThrow('Email taken');
  });

  it('signUpWithEmail throws "Sign-up failed" when error has no message', async () => {
    mockAuthClient.signUp.email.mockResolvedValue({ error: {} });
    const svc = setup();
    await expect(svc.signUpWithEmail('u@test.com', 'pass', 'Test')).rejects.toThrow(
      'Sign-up failed',
    );
  });

  it('signInWithEmail throws "Sign-in failed" when error has no message', async () => {
    mockAuthClient.signIn.email.mockResolvedValue({ error: {} });
    const svc = setup();
    await expect(svc.signInWithEmail('u@test.com', 'pass')).rejects.toThrow('Sign-in failed');
  });

  it('signInWithGoogle calls authClient.signIn.social with google provider', async () => {
    mockAuthClient.signIn.social.mockResolvedValue({});
    const svc = setup();
    await svc.signInWithGoogle();
    expect(mockAuthClient.signIn.social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/',
    });
  });

  it('signInWithEmail does not update session when getSession returns no data', async () => {
    mockAuthClient.signIn.email.mockResolvedValue({ error: null });
    mockAuthClient.getSession.mockResolvedValue({ data: null });
    const svc = setup();
    await svc.signInWithEmail('u@test.com', 'pass');
    // session not stored since refreshSession got no user
    expect(svc.isAuthenticated()).toBe(false);
  });

  it('storeSession maps image and role when provided', async () => {
    mockAuthClient.getSession.mockResolvedValue({
      data: {
        user: {
          id: 'u2',
          email: 'u2@test.com',
          name: null,
          image: 'http://img.jpg',
          role: 'admin',
        },
        session: { token: 'tok-2' },
      },
    });
    const svc = setup();
    await svc.initSession();
    expect(svc.currentUser()?.picture).toBe('http://img.jpg');
    expect(svc.currentUser()?.role).toBe('admin');
  });

  it('initSession returns immediately if already initialized', async () => {
    mockAuthClient.getSession.mockResolvedValue({ data: null });
    const svc = setup();
    await svc.initSession();
    const callCountAfterFirst = mockAuthClient.getSession.mock.calls.length;
    await svc.initSession(); // second call should return immediately
    expect(mockAuthClient.getSession.mock.calls.length).toBe(callCountAfterFirst); // no extra calls
  });

  it('initSession returns same promise when called concurrently', async () => {
    let resolve!: () => void;
    mockAuthClient.getSession.mockReturnValue(
      new Promise<{ data: null }>((res) => {
        resolve = () => res({ data: null });
      }),
    );
    const svc = setup();
    const p1 = svc.initSession();
    const p2 = svc.initSession(); // concurrent
    expect(p1).toBe(p2);
    resolve();
    await p1;
  });

  it('initSession uses devBypassAuth path when devBypassAuth is true', async () => {
    const envModule = await import('../../../environments/environment');
    (envModule.environment as Record<string, unknown>)['devBypassAuth'] = true;
    try {
      const svc = setup();
      await svc.initSession();
      expect(svc.currentUser()?.email).toBe('dev@local');
      expect(svc.isAuthenticated()).toBe(true);
      expect(svc.isAdmin()).toBe(true);
    } finally {
      (envModule.environment as Record<string, unknown>)['devBypassAuth'] = false;
    }
  });
});
