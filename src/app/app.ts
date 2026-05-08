import { Component, ChangeDetectionStrategy, signal, effect } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  isDark = signal(localStorage.getItem('theme') === 'dark');

  constructor() {
    effect(() => {
      const dark = this.isDark();
      document.documentElement.classList.toggle('dark-theme', dark);
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    });
  }

  toggleTheme(): void {
    this.isDark.update((v) => !v);
  }
}
