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
  styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
  title = input<string>('No results found');
  message = input<string>("Try adjusting your filters to find what you're looking for.");
}
