import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { ListingDetail } from '../../core/models/listing.model';
import { ApiService } from '../../core/services/api.service';
import { EurPipe } from '../../shared/pipes/eur.pipe';
import { RelativeDatePipe } from '../../shared/pipes/relative-date.pipe';
import { BadgeComponent } from '../../shared/components/badge.component';
import { PriceChartComponent } from './price-chart/price-chart.component';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DatePipe,
    EurPipe,
    RelativeDatePipe,
    BadgeComponent,
    PriceChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.scss',
})
export class DetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  listing = signal<ListingDetail | null>(null);
  loading = signal(true);
  snapshotExists = signal(false);
  private snapshotUrl = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getListing(id).subscribe({
      next: (data) => {
        this.listing.set(data);
        this.loading.set(false);
        if (data.is_favorite) {
          this.api.getSnapshotStatus(id).subscribe({
            next: ({ exists, url }) => {
              this.snapshotExists.set(exists);
              if (url) this.snapshotUrl.set(url);
            },
          });
        }
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openSnapshot(): void {
    const url = this.snapshotUrl();
    if (url) window.open(url, '_blank');
  }
}

