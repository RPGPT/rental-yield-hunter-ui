import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Stats } from '../../../core/models/stats.model';
import { EurPipe } from '../../../shared/pipes/eur.pipe';

@Component({
  selector: 'app-stats-bar',
  standalone: true,
  imports: [DecimalPipe, MatCardModule, MatProgressSpinnerModule, EurPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats-bar.component.html',
  styleUrl: './stats-bar.component.scss',
})
export class StatsBarComponent {
  stats = input<Stats | null>(null);
  loading = input<boolean>(false);
}
