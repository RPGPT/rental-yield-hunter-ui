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
  private listingId = '';

  listing = signal<ListingDetail | null>(null);
  loading = signal(true);
  isFavorite = signal(false);
  favLoading = signal(false);
  snapshotExists = signal(false);
  snapshotLoading = signal(false);
  private snapshotUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.listingId = this.route.snapshot.paramMap.get('id')!;
    this.api.getListing(this.listingId).subscribe({
      next: (data) => {
        this.listing.set(data);
        this.isFavorite.set(data.is_favorite);
        this.loading.set(false);
        // Always check snapshot status for all listings
        this.loadSnapshotStatus();
      },
      error: () => this.loading.set(false),
    });
  }

  toggleFavorite(): void {
    const newValue = !this.isFavorite();
    this.favLoading.set(true);
    this.api.setFavorite(this.listingId, newValue).subscribe({
      next: () => {
        this.isFavorite.set(newValue);
        this.favLoading.set(false);
      },
      error: () => this.favLoading.set(false),
    });
  }

  // Single save action: download if exists, create if not
  saveSnapshot(): void {
    if (this.snapshotLoading()) return;
    if (this.snapshotExists()) {
      const url = this.snapshotUrl();
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      a.click();
    } else {
      this.triggerSnapshot();
    }
  }

  private loadSnapshotStatus(): void {
    this.api.getSnapshotStatus(this.listingId).subscribe({
      next: ({ exists, url }) => {
        this.snapshotExists.set(exists);
        if (url) this.snapshotUrl.set(url);
      },
    });
  }

  private triggerSnapshot(): void {
    this.snapshotLoading.set(true);
    this.api.triggerSnapshot(this.listingId).subscribe({
      next: ({ exists, url }) => {
        this.snapshotExists.set(exists);
        if (url) this.snapshotUrl.set(url);
        this.snapshotLoading.set(false);
      },
      error: () => this.snapshotLoading.set(false),
    });
  }
}
