import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { of, Subscription } from 'rxjs';
import { RentalListingDetail } from '../../core/models/listing.model';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { EurPipe } from '../../shared/pipes/eur.pipe';
import { RelativeDatePipe } from '../../shared/pipes/relative-date.pipe';
import { BadgeComponent } from '../../shared/components/badge.component';
import { ImageGalleryComponent } from '../../shared/components/image-gallery/image-gallery.component';
import { DescriptionCardComponent } from '../../shared/components/description-card/description-card.component';
import { PriceChartComponent } from '../detail/price-chart/price-chart.component';
import {
  hasPriceDecreased,
  hasPriceIncreased,
  isPortalHydrationSupported,
  mapsUrl,
  sourceLabel,
} from '../../shared/utils/listing.util';

@Component({
  selector: 'app-rental-detail',
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
    ImageGalleryComponent,
    DescriptionCardComponent,
    PriceChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rental-detail.component.html',
  styleUrl: './rental-detail.component.scss',
})
export class RentalDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  private listingId = '';
  private activeLoadSub?: Subscription;

  @ViewChild('priceChartCard', { read: ElementRef }) priceChartCard?: ElementRef;

  listing = signal<RentalListingDetail | null>(null);
  loading = signal(true);
  isFavorite = signal(false);
  favLoading = signal(false);
  snapshotLoading = signal(false);
  snapshotExists = signal(false);
  richDescription = signal<SafeHtml | null>(null);
  descriptionLoading = signal(false);

  ngOnInit(): void {
    const paramMap$ = this.route.paramMap ?? of(this.route.snapshot.paramMap);
    paramMap$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id && id !== this.listingId) {
        this.listingId = id;
        this.loadRentalListing(id);
      }
    });
  }

  private loadRentalListing(id: string): void {
    this.activeLoadSub?.unsubscribe();
    const group = new Subscription();
    this.activeLoadSub = group;
    this.destroyRef.onDestroy(() => group.unsubscribe());

    this.loading.set(true);
    this.richDescription.set(null);
    this.descriptionLoading.set(false);
    this.snapshotExists.set(false);

    group.add(
      this.api.getRentalListing(id).subscribe({
        next: (data) => {
          this.listing.set(data);
          this.isFavorite.set(data.is_favorite);
          this.loading.set(false);

          if (isPortalHydrationSupported(data.url)) {
            this.descriptionLoading.set(true);
            group.add(
              this.api.getListingDescription(data.url).subscribe({
                next: (res) => {
                  if (res.description) {
                    this.richDescription.set(
                      this.sanitizer.bypassSecurityTrustHtml(res.description),
                    );
                  }
                  if (res.images?.length) {
                    const cur = this.listing();
                    if (cur && cur.id === id) {
                      this.listing.set({ ...cur, images: res.images });
                    }
                  }
                  this.descriptionLoading.set(false);
                },
                error: () => this.descriptionLoading.set(false),
              }),
            );
          }
        },
        error: () => this.loading.set(false),
      }),
    );

    group.add(
      this.api.checkSnapshot(id, 'rental').subscribe({
        next: ({ exists }) => this.snapshotExists.set(exists),
        error: () => {},
      }),
    );
  }

  priceWentUp(): boolean {
    return hasPriceIncreased(this.listing());
  }

  priceWentDown(): boolean {
    return hasPriceDecreased(this.listing());
  }

  scrollToPriceChart(): void {
    this.priceChartCard?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleFavorite(): void {
    if (!this.auth.isAuthenticated()) {
      this.snackBar
        .open('Sign in to save favourites', 'Sign In', { duration: 4000 })
        .onAction()
        .subscribe(() => void this.router.navigate(['/login']));
      return;
    }

    const newValue = !this.isFavorite();
    this.favLoading.set(true);
    this.api.setFavorite(this.listingId, newValue).subscribe({
      next: () => {
        this.isFavorite.set(newValue);
        this.favLoading.set(false);
        if (newValue) {
          this.api.triggerSnapshot(this.listingId, 'rental').subscribe({
            next: () => undefined,
            error: (e) => console.warn(`[snapshot] failed ${this.listingId}:`, e),
          });
        }
      },
      error: () => this.favLoading.set(false),
    });
  }

  saveSnapshot(): void {
    if (this.snapshotLoading()) return;
    if (this.snapshotExists()) {
      void this.router.navigate(['/rental', this.listingId, 'snapshot']);
      return;
    }
    this.snapshotLoading.set(true);
    this.api.triggerSnapshot(this.listingId, 'rental').subscribe({
      next: () => {
        this.snapshotLoading.set(false);
        this.snapshotExists.set(true);
        void this.router.navigate(['/rental', this.listingId, 'snapshot']);
      },
      error: () => this.snapshotLoading.set(false),
    });
  }

  readonly mapsUrl = mapsUrl;
  readonly sourceLabel = sourceLabel;
}
