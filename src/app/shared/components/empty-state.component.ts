import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <mat-icon class="empty-state__icon">search_off</mat-icon>
      <h3 class="empty-state__title">{{ title() }}</h3>
      <p class="empty-state__message">{{ message() }}</p>
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant, #666);
    }
    .empty-state__icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      opacity: 0.5;
      margin-bottom: 16px;
    }
    .empty-state__title {
      margin: 0 0 8px;
      font-size: 20px;
      font-weight: 500;
    }
    .empty-state__message {
      margin: 0;
      font-size: 14px;
      max-width: 400px;
    }
  `],
})
export class EmptyStateComponent {
  title = input<string>('No results found');
  message = input<string>('Try adjusting your filters to find what you\'re looking for.');
}

