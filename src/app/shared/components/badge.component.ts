import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="'badge--' + color()">{{ label() }}</span>
  `,
  styles: [`
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      color: #fff;
      white-space: nowrap;
    }
    .badge--green  { background-color: #2E7D32; }
    .badge--red    { background-color: #C62828; }
    .badge--amber  { background-color: #FF8F00; }
    .badge--grey   { background-color: #9E9E9E; }
    .badge--blue   { background-color: #1565C0; }
  `],
})
export class BadgeComponent {
  label = input.required<string>();
  color = input.required<'green' | 'red' | 'amber' | 'grey' | 'blue'>();
}

