import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { createAuthClient } from '@neondatabase/neon-js/auth';
import { AuthUser } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly authClient = createAuthClient(environment.neonAuthUrl);

  /** Currently authenticated user, or null if not signed in. */
  readonly currentUser = signal<AuthUser | null>(this.loadStoredUser());

  private loadStoredUser(): AuthUser | null {
    try {
      return JSON.parse(localStorage.getItem('auth_user') ?? 'null');
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  /** Called on app init to restore the session from the Neon Auth server. */
  async initSession(): Promise<void> {
    if (environment.devBypassAuth) {
      this.storeSession(
        { id: 'dev-user', email: 'dev@local', name: 'Dev User', image: null },
        'dev-token',
      );
      return;
    }
    try {
      const { data } = await this.authClient.getSession();
      if (data?.user && data?.session) {
        this.storeSession(data.user, (data.session as { token: string }).token);
      } else {
        this.clearSession();
      }
    } catch (err) {
      console.error('[auth] initSession failed', err);
      this.clearSession();
    }
  }

  /** Sign in with email and password. Throws on failure. */
  async signInWithEmail(email: string, password: string): Promise<void> {
    const { error } = await this.authClient.signIn.email({ email, password });
    if (error) throw new Error(error.message ?? 'Sign-in failed');
    await this.refreshSession();
    this.router.navigate(['/']);
  }

  /** Sign up with email, password, and display name. Throws on failure. */
  async signUpWithEmail(email: string, password: string, name: string): Promise<void> {
    const { error } = await this.authClient.signUp.email({ email, password, name });
    if (error) throw new Error(error.message ?? 'Sign-up failed');
    await this.refreshSession();
    this.router.navigate(['/']);
  }

  /** Redirect to Google OAuth via Neon Auth. Navigates away from the current page. */
  async signInWithGoogle(): Promise<void> {
    await this.authClient.signIn.social({ provider: 'google', callbackURL: '/' });
  }

  clearSession(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this.currentUser.set(null);
  }

  async logout(): Promise<void> {
    await this.authClient.signOut();
    this.clearSession();
    this.router.navigate(['/login']);
  }

  private async refreshSession(): Promise<void> {
    const { data } = await this.authClient.getSession();
    if (data?.user && data?.session) {
      this.storeSession(data.user, (data.session as { token: string }).token);
    }
  }

  private storeSession(
    user: { id: string; email: string; name?: string | null; image?: string | null },
    token: string,
  ): void {
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      picture: user.image ?? null,
    };
    localStorage.setItem('auth_user', JSON.stringify(authUser));
    localStorage.setItem('auth_token', token);
    this.currentUser.set(authUser);
  }
}
