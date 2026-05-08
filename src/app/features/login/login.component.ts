import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);

  isSignUp = signal(false);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  email = '';
  password = '';
  name = '';

  async handleSubmit(): Promise<void> {
    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      if (this.isSignUp()) {
        await this.auth.signUpWithEmail(
          this.email,
          this.password,
          this.name || this.email.split('@')[0],
        );
      } else {
        await this.auth.signInWithEmail(this.email, this.password);
      }
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      await this.auth.signInWithGoogle();
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Google sign-in failed');
      this.loading.set(false);
    }
  }

  toggleMode(): void {
    this.isSignUp.update((v) => !v);
    this.errorMessage.set(null);
  }
}
