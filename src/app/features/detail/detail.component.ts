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
  snapshotLoading = signal(false);
  snapshotSaved = signal(false); // true after a successful save this session
  selectedImage = signal<string>('');

  ngOnInit(): void {
    this.listingId = this.route.snapshot.paramMap.get('id')!;
    this.api.getListing(this.listingId).subscribe({
      next: (data) => {
        this.listing.set(data);
        this.isFavorite.set(data.is_favorite);
        if (data.images?.length) {
          this.selectedImage.set(data.images[0].large);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectImage(url: string): void {
    this.selectedImage.set(url);
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

  // One click: POST → server returns existing or creates new → auto-download
  saveSnapshot(): void {
    if (this.snapshotLoading()) return;
    this.snapshotLoading.set(true);
    this.api.triggerSnapshot(this.listingId).subscribe({
      next: ({ url }) => {
        this.snapshotLoading.set(false);
        this.snapshotSaved.set(true);
        if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.download = '';
          a.click();
        }
      },
      error: () => this.snapshotLoading.set(false),
    });
  }
}
