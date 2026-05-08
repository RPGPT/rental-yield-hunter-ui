import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <span class="badge" [class]="'badge--' + color()">{{ label() }}</span> `,
  styleUrl: './badge.component.scss',
})
export class BadgeComponent {
  label = input.required<string>();
  color = input.required<'green' | 'red' | 'amber' | 'grey' | 'blue'>();
}
