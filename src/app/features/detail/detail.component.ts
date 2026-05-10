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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ListingDetail } from '../../core/models/listing.model';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
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
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private listingId = '';

  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('priceChartCard', { read: ElementRef }) priceChartCard?: ElementRef;

  listing = signal<ListingDetail | null>(null);
  loading = signal(true);
  isFavorite = signal(false);
  favLoading = signal(false);
  snapshotLoading = signal(false);
  snapshotExists = signal(false);
  currentImage = signal<string>('');
  incomingImage = signal<string>('');
  imageAnim = signal<'next' | 'prev' | ''>('');
  richDescription = signal<SafeHtml | null>(null);
  descriptionLoading = signal(false);

  ngOnInit(): void {
    this.listingId = this.route.snapshot.paramMap.get('id')!;
    this.api.getListing(this.listingId).subscribe({
      next: (data) => {
        this.listing.set(data);
        this.isFavorite.set(data.is_favorite);
        if (data.images?.length) {
          this.currentImage.set(data.images[0].large);
          this.incomingImage.set(data.images[0].large);
        }
        this.loading.set(false);
        if (data.url?.includes('imovirtual.com')) {
          this.descriptionLoading.set(true);
          this.api.getListingDescription(data.url).subscribe({
            next: (res) => {
              if (res.description) {
                this.richDescription.set(this.sanitizer.bypassSecurityTrustHtml(res.description));
              }
              if (res.images?.length) {
                const fullListing = { ...this.listing()!, images: res.images };
                this.listing.set(fullListing);
                this.currentImage.set(res.images[0].large);
                this.incomingImage.set(res.images[0].large);
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

  currentImageIndex(images: { large: string }[]): number {
    return images.findIndex((img) => img.large === this.currentImage());
  }

  selectImage(url: string): void {
    this.currentImage.set(url);
    this.incomingImage.set(url);
  }

  navigateImage(dir: 1 | -1): void {
    const images = this.listing()?.images ?? [];
    if (images.length < 2 || this.imageAnim() !== '') return;
    const idx = images.findIndex((img) => img.large === this.currentImage());
    const nextIdx = (idx + dir + images.length) % images.length;
    const nextUrl = images[nextIdx].large;

    this.incomingImage.set(nextUrl);
    this.imageAnim.set(dir === 1 ? 'next' : 'prev');

    setTimeout(() => {
      this.currentImage.set(nextUrl);
      this.imageAnim.set('');
    }, 180);
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
}
