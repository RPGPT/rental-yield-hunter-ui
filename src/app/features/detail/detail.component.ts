import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  HostListener,
  inject,
  signal,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ListingDetail } from '../../core/models/listing.model';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { EurPipe } from '../../shared/pipes/eur.pipe';
import { RelativeDatePipe } from '../../shared/pipes/relative-date.pipe';
import { BadgeComponent } from '../../shared/components/badge.component';
import { PriceChartComponent } from './price-chart/price-chart.component';
import { MarkAsRentedDialogComponent, MarkAsRentedResult } from './mark-as-rented-dialog.component';

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
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private listingId = '';

  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('priceChartCard', { read: ElementRef }) priceChartCard?: ElementRef;

  listing = signal<ListingDetail | null>(null);
  loading = signal(true);
  isFavorite = signal(false);
  favLoading = signal(false);
  isHidden = signal(false);
  hiddenLoading = signal(false);
  snapshotLoading = signal(false);
  snapshotExists = signal(false);
  currentImage = signal<string>('');
  slotA = signal<string>('');
  slotB = signal<string>('');
  activeSlot = signal<'a' | 'b'>('a');
  richDescription = signal<SafeHtml | null>(null);
  descriptionLoading = signal(false);
  statusLoading = signal(false);

  ngOnInit(): void {
    this.listingId = this.route.snapshot.paramMap.get('id')!;
    this.api.getListing(this.listingId).subscribe({
      next: (data) => {
        this.listing.set(data);
        this.isFavorite.set(data.is_favorite);
        this.isHidden.set(data.is_hidden);
        if (data.images?.length) {
          const url = data.images[0].large;
          this.currentImage.set(url);
          this.slotA.set(url);
          this.slotB.set(url);
          this.activeSlot.set('a');
        }
        this.loading.set(false);
        if (data.url?.includes('imovirtual.com') || data.url?.includes('era.pt')) {
          this.descriptionLoading.set(true);
          this.api.getListingDescription(data.url).subscribe({
            next: (res) => {
              if (res.description) {
                this.richDescription.set(this.sanitizer.bypassSecurityTrustHtml(res.description));
              }
              if (res.images?.length) {
                const fullListing = { ...this.listing()!, images: res.images };
                this.listing.set(fullListing);
                const url = res.images[0].large;
                this.currentImage.set(url);
                this.slotA.set(url);
                this.slotB.set(url);
                this.activeSlot.set('a');
              }
              this.descriptionLoading.set(false);
            },
            error: () => this.descriptionLoading.set(false),
          });
        }
      },
      error: () => this.loading.set(false),
    });
    this.api.checkSnapshot(this.listingId).subscribe({
      next: ({ exists }) => this.snapshotExists.set(exists),
      error: () => {},
    });
  }

  priceWentUp(): boolean {
    const listing = this.listing();
    if (!listing) return false;
    return listing.price_history.some((h) => h.price < listing.price);
  }

  priceWentDown(): boolean {
    const listing = this.listing();
    if (!listing) return false;
    return listing.price_history.some((h) => h.price > listing.price);
  }

  scrollToPriceChart(): void {
    this.priceChartCard?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  mapsUrl(listing: {
    location: string | null;
    neighborhood: string | null;
    city: string | null;
  }): string | null {
    const q = listing.location ?? [listing.neighborhood, listing.city].filter(Boolean).join(', ');
    if (!q) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  currentImageIndex(images: { large: string }[]): number {
    return images.findIndex((img) => img.large === this.currentImage());
  }

  selectImage(url: string): void {
    const next = this.activeSlot() === 'a' ? 'b' : 'a';
    // Load new URL into the inactive slot (opacity:0, no paint yet)
    if (next === 'b') this.slotB.set(url);
    else this.slotA.set(url);
    this.currentImage.set(url);
    // Flip on the next frame so the browser paints opacity:0 first,
    // giving the CSS transition something to animate from
    requestAnimationFrame(() => {
      this.activeSlot.set(next);
    });
  }

  navigateImage(dir: 1 | -1): void {
    const images = this.listing()?.images ?? [];
    if (images.length < 2) return;
    const idx = images.findIndex((img) => img.large === this.currentImage());
    const nextIdx = (idx + dir + images.length) % images.length;
    this.selectImage(images[nextIdx].large);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === 'ArrowRight') this.navigateImage(1);
    else if (event.key === 'ArrowLeft') this.navigateImage(-1);
  }

  toggleFavorite(): void {
    if (!this.auth.isAuthenticated()) {
      this.snackBar
        .open('Sign in to save favourites', 'Sign In', { duration: 4000 })
        .onAction()
        .subscribe(() => this.router.navigate(['/login']));
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
            next: (r) => console.log(`[snapshot] ${this.listingId}`, r.url),
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
        .subscribe(() => this.router.navigate(['/login']));
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

  confidenceColor(confidence: string | null): 'green' | 'amber' | 'grey' {
    if (confidence === 'high') return 'green';
    if (confidence === 'medium') return 'amber';
    return 'grey';
  }

  private formatEur(value: number | null): string {
    if (value == null) return '—';
    return value.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + '€';
  }

  displayYield(l: ListingDetail): number | null {
    if (l.is_rented && !l.lifetime_rent && !!l.rent_current_rent) {
      return (l.rent_current_rent * 12) / l.price;
    }
    return l.rental_yield;
  }

  yieldTooltip(l: ListingDetail): string {
    if (l.is_rented && !l.lifetime_rent && !!l.rent_current_rent) {
      const contractYield = (((l.rent_current_rent * 12) / l.price) * 100).toFixed(2);
      const base = `Contract yield: ${this.formatEur(l.rent_current_rent)}/mo × 12 ÷ ${this.formatEur(l.price)} = ${contractYield}%`;
      return l.rental_yield != null
        ? `${base}\nEst. yield: ${(l.rental_yield * 100).toFixed(2)}%`
        : base;
    }
    return '';
  }

  estRentTooltip(l: ListingDetail): string {
    if (l.is_rented && !l.lifetime_rent && !!l.rent_current_rent) {
      return l.estimated_rent != null
        ? `Market est.: ${this.formatEur(l.estimated_rent)}/mo`
        : 'No market estimate available';
    }
    if (l.estimated_rent == null) return '';
    return l.sample_count != null
      ? `${l.confidence} confidence · based on ${l.sample_count} comparables (${l.match_level})`
      : `${l.confidence} confidence`;
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
}
