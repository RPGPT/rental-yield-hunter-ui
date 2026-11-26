import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-description-card',
  standalone: true,
  imports: [MatCardModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (richDescription(); as html) {
      <mat-card>
        <mat-card-header>
          <mat-card-title>Description</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="description-text" [innerHTML]="html"></div>
        </mat-card-content>
      </mat-card>
    } @else if (loading()) {
      <mat-card>
        <mat-card-content class="description-loading">
          <mat-spinner diameter="24"></mat-spinner>
          <span>Loading description…</span>
        </mat-card-content>
      </mat-card>
    } @else if (plainDescription()) {
      <mat-card>
        <mat-card-header>
          <mat-card-title>Description</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="description-text">{{ plainDescription() }}</p>
        </mat-card-content>
      </mat-card>
    }
  `,
  styleUrl: './description-card.component.scss',
})
export class DescriptionCardComponent {
  richDescription = input<SafeHtml | null>(null);
  plainDescription = input<string | null>(null);
  loading = input<boolean>(false);
}
