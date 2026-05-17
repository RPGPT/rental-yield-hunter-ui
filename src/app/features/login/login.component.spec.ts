import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MockProvider } from 'ng-mocks';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';

describe('LoginComponent', () => {
  let signInWithEmail: ReturnType<typeof vi.fn>;
  let signUpWithEmail: ReturnType<typeof vi.fn>;
  let signInWithGoogle: ReturnType<typeof vi.fn>;

  function setup() {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            signInWithEmail,
            signUpWithEmail,
            signInWithGoogle,
          },
        },
      ],
    });
    return TestBed.runInInjectionContext(() => new LoginComponent());
  }

  beforeEach(() => {
    signInWithEmail = vi.fn().mockResolvedValue(undefined);
    signUpWithEmail = vi.fn().mockResolvedValue(undefined);
    signInWithGoogle = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('starts in sign-in mode', () => {
    const component = setup();
    expect(component.isSignUp()).toBe(false);
  });

  it('toggleMode() switches to sign-up mode', () => {
    const component = setup();
    component.toggleMode();
    expect(component.isSignUp()).toBe(true);
  });

  it('toggleMode() clears errorMessage', () => {
    const component = setup();
    component.errorMessage.set('some error');
    component.toggleMode();
    expect(component.errorMessage()).toBeNull();
  });

  it('toggleMode() twice returns to sign-in mode', () => {
    const component = setup();
    component.toggleMode();
    component.toggleMode();
    expect(component.isSignUp()).toBe(false);
  });

  it('handleSubmit() calls signInWithEmail in sign-in mode', async () => {
    const component = setup();
    component.email = 'u@test.com';
    component.password = 'pass';
    await component.handleSubmit();
    expect(signInWithEmail).toHaveBeenCalledWith('u@test.com', 'pass');
  });

  it('handleSubmit() calls signUpWithEmail in sign-up mode with given name', async () => {
    const component = setup();
    component.isSignUp.set(true);
    component.email = 'u@test.com';
    component.password = 'pass';
    component.name = 'Test User';
    await component.handleSubmit();
    expect(signUpWithEmail).toHaveBeenCalledWith('u@test.com', 'pass', 'Test User');
  });

  it('handleSubmit() uses email prefix as name when name is empty', async () => {
    const component = setup();
    component.isSignUp.set(true);
    component.email = 'myuser@test.com';
    component.password = 'pass';
    component.name = '';
    await component.handleSubmit();
    expect(signUpWithEmail).toHaveBeenCalledWith('myuser@test.com', 'pass', 'myuser');
  });

  it('handleSubmit() clears errorMessage before calling auth', async () => {
    const component = setup();
    component.errorMessage.set('old error');
    await component.handleSubmit();
    expect(component.errorMessage()).toBeNull();
  });

  it('handleSubmit() sets loading to false after success', async () => {
    const component = setup();
    await component.handleSubmit();
    expect(component.loading()).toBe(false);
  });

  it('handleSubmit() sets errorMessage on Error thrown by auth', async () => {
    signInWithEmail.mockRejectedValue(new Error('Invalid credentials'));
    const component = setup();
    component.email = 'u@test.com';
    component.password = 'wrong';
    await component.handleSubmit();
    expect(component.errorMessage()).toBe('Invalid credentials');
    expect(component.loading()).toBe(false);
  });

  it('handleSubmit() sets "Authentication failed" for non-Error thrown', async () => {
    signInWithEmail.mockRejectedValue('plain string error');
    const component = setup();
    await component.handleSubmit();
    expect(component.errorMessage()).toBe('Authentication failed');
  });

  it('signInWithGoogle() calls auth.signInWithGoogle', async () => {
    const component = setup();
    await component.signInWithGoogle();
    expect(signInWithGoogle).toHaveBeenCalled();
  });

  it('signInWithGoogle() clears errorMessage before calling', async () => {
    const component = setup();
    component.errorMessage.set('old error');
    await component.signInWithGoogle();
    expect(component.errorMessage()).toBeNull();
  });

  it('signInWithGoogle() sets errorMessage on Error', async () => {
    signInWithGoogle.mockRejectedValue(new Error('OAuth failed'));
    const component = setup();
    await component.signInWithGoogle();
    expect(component.errorMessage()).toBe('OAuth failed');
    expect(component.loading()).toBe(false);
  });

  it('signInWithGoogle() sets "Google sign-in failed" for non-Error', async () => {
    signInWithGoogle.mockRejectedValue('network problem');
    const component = setup();
    await component.signInWithGoogle();
    expect(component.errorMessage()).toBe('Google sign-in failed');
  });
});
