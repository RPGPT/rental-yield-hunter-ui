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
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { of, Subscription } from 'rxjs';
import { ListingDetail } from '../../core/models/listing.model';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { EurPipe } from '../../shared/pipes/eur.pipe';
import { RelativeDatePipe } from '../../shared/pipes/relative-date.pipe';
import { BadgeComponent } from '../../shared/components/badge.component';
import { ImageGalleryComponent } from '../../shared/components/image-gallery/image-gallery.component';
import { DescriptionCardComponent } from '../../shared/components/description-card/description-card.component';
import { PriceChartComponent } from './price-chart/price-chart.component';
import { MarkAsRentedDialogComponent, MarkAsRentedResult } from './mark-as-rented-dialog.component';
import {
  confidenceColor,
  contractExpiringSoon,
  displayYield,
  estRentTooltip,
  hasPriceDecreased,
  hasPriceIncreased,
  isPortalHydrationSupported,
  mapsUrl,
  sourceLabel,
  yieldTooltip,
} from '../../shared/utils/listing.util';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DatePipe,
    CurrencyPipe,
    DecimalPipe,
    EurPipe,
    RelativeDatePipe,
    BadgeComponent,
    ImageGalleryComponent,
    DescriptionCardComponent,
    PriceChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.scss',
})
export class DetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  private listingId = '';
  private activeLoadSub?: Subscription;

  @ViewChild('priceChartCard', { read: ElementRef }) priceChartCard?: ElementRef;

  listing = signal<ListingDetail | null>(null);
  loading = signal(true);
  isFavorite = signal(false);
  favLoading = signal(false);
  isHidden = signal(false);
  hiddenLoading = signal(false);
  snapshotLoading = signal(false);
  snapshotExists = signal(false);
  richDescription = signal<SafeHtml | null>(null);
  descriptionLoading = signal(false);
  statusLoading = signal(false);

  ngOnInit(): void {
    const paramMap$ = this.route.paramMap ?? of(this.route.snapshot.paramMap);
    paramMap$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id && id !== this.listingId) {
        this.listingId = id;
        this.loadListing(id);
      }
    });
  }

  private loadListing(id: string): void {
    this.activeLoadSub?.unsubscribe();
    const group = new Subscription();
    this.activeLoadSub = group;
    this.destroyRef.onDestroy(() => group.unsubscribe());

    this.loading.set(true);
    this.richDescription.set(null);
    this.descriptionLoading.set(false);
    this.snapshotExists.set(false);

    group.add(
      this.api.getListing(id).subscribe({
        next: (data) => {
          this.listing.set(data);
          this.isFavorite.set(data.is_favorite);
          this.isHidden.set(data.is_hidden);
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
      this.api.checkSnapshot(id).subscribe({
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
          this.api.triggerSnapshot(this.listingId).subscribe({
            next: () => undefined,
            error: (e) => console.warn(`[snapshot] failed ${this.listingId}:`, e),
          });
        }
      },
      error: () => this.favLoading.set(false),
    });
  }

  toggleHidden(): void {
    if (!this.auth.isAuthenticated()) {
      this.snackBar
        .open('Sign in to hide listings', 'Sign In', { duration: 4000 })
        .onAction()
        .subscribe(() => void this.router.navigate(['/login']));
      return;
    }

    const newValue = !this.isHidden();
    this.hiddenLoading.set(true);
    this.api.setHidden(this.listingId, newValue).subscribe({
      next: () => {
        this.isHidden.set(newValue);
        this.hiddenLoading.set(false);
      },
      error: () => this.hiddenLoading.set(false),
    });
  }

  saveSnapshot(): void {
    if (this.snapshotLoading()) return;
    if (this.snapshotExists()) {
      void this.router.navigate(['/listing', this.listingId, 'snapshot']);
      return;
    }
    this.snapshotLoading.set(true);
    this.api.triggerSnapshot(this.listingId).subscribe({
      next: () => {
        this.snapshotLoading.set(false);
        this.snapshotExists.set(true);
        void this.router.navigate(['/listing', this.listingId, 'snapshot']);
      },
      error: () => this.snapshotLoading.set(false),
    });
  }

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  openMarkAsRentedDialog(): void {
    const ref = this.dialog.open<MarkAsRentedDialogComponent, void, MarkAsRentedResult | null>(
      MarkAsRentedDialogComponent,
    );
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      this.statusLoading.set(true);
      this.api
        .updateListingStatus(this.listingId, {
          is_rented: true,
          lifetime_rent: result.lifetimeRent,
          rent_per_month: result.rentPerMonth,
          contract_expiry_date: result.contractExpiryDate,
        })
        .subscribe({
          next: () => {
            const l = this.listing();
            if (l) {
              this.listing.set({
                ...l,
                is_rented: true,
                lifetime_rent: result.lifetimeRent,
                rent_current_rent: result.rentPerMonth,
                rent_contract_expiry: result.contractExpiryDate,
              });
            }
            this.statusLoading.set(false);
            this.snackBar.open('Marked as Rented', undefined, { duration: 3000 });
          },
          error: () => {
            this.statusLoading.set(false);
            this.snackBar.open('Failed to update', undefined, { duration: 3000 });
          },
        });
    });
  }

  markAsNotRented(): void {
    this.statusLoading.set(true);
    this.api
      .updateListingStatus(this.listingId, { is_rented: false, lifetime_rent: false })
      .subscribe({
        next: () => {
          const l = this.listing();
          if (l) {
            this.listing.set({
              ...l,
              is_rented: false,
              lifetime_rent: false,
              rent_current_rent: null,
              rent_contract_expiry: null,
            });
          }
          this.statusLoading.set(false);
          this.snackBar.open('Marked as Not Rented', undefined, { duration: 3000 });
        },
        error: () => {
          this.statusLoading.set(false);
          this.snackBar.open('Failed to update', undefined, { duration: 3000 });
        },
      });
  }

  deleteListing(): void {
    if (!window.confirm('Delete this listing? It will no longer appear in the app.')) return;
    this.statusLoading.set(true);
    this.api.deleteListing(this.listingId).subscribe({
      next: () => {
        this.statusLoading.set(false);
        this.snackBar.open('Listing deleted', undefined, { duration: 3000 });
        void this.router.navigate(['/buy']);
      },
      error: () => {
        this.statusLoading.set(false);
        this.snackBar.open('Failed to delete', undefined, { duration: 3000 });
      },
    });
  }

  // Shared domain helpers
  readonly sourceLabel = sourceLabel;
  readonly contractExpiringSoon = contractExpiringSoon;
  readonly mapsUrl = mapsUrl;
  readonly confidenceColor = confidenceColor;
  readonly displayYield = displayYield;
  readonly yieldTooltip = (l: ListingDetail) => yieldTooltip(l, true);
  readonly estRentTooltip = estRentTooltip;
}
