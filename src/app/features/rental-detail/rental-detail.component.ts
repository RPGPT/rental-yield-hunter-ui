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
import { RentalListingDetail } from '../../core/models/listing.model';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { EurPipe } from '../../shared/pipes/eur.pipe';
import { RelativeDatePipe } from '../../shared/pipes/relative-date.pipe';
import { BadgeComponent } from '../../shared/components/badge.component';
import { PriceChartComponent } from '../detail/price-chart/price-chart.component';

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
  private listingId = '';

  @ViewChild('priceChartCard', { read: ElementRef }) priceChartCard?: ElementRef;

  listing = signal<RentalListingDetail | null>(null);
  loading = signal(true);
  isFavorite = signal(false);
  favLoading = signal(false);
  snapshotLoading = signal(false);
  snapshotExists = signal(false);
  currentImage = signal<string>('');
  slotA = signal<string>('');
  slotB = signal<string>('');
  activeSlot = signal<'a' | 'b'>('a');
  richDescription = signal<SafeHtml | null>(null);
  descriptionLoading = signal(false);

  ngOnInit(): void {
    this.listingId = this.route.snapshot.paramMap.get('id')!;
    this.api.getRentalListing(this.listingId).subscribe({
      next: (data) => {
        this.listing.set(data);
        this.isFavorite.set(data.is_favorite);
        if (data.images?.length) {
          const url = data.images[0].large;
          this.currentImage.set(url);
          this.slotA.set(url);
          this.slotB.set(url);
          this.activeSlot.set('a');
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
    this.api.checkSnapshot(this.listingId, 'rental').subscribe({
      next: ({ exists }) => this.snapshotExists.set(exists),
      error: () => {},
    });
  }

  priceWentUp(): boolean {
    const listing = this.listing();
    if (!listing) return false;
    return listing.price_history.some((h) => h.price < listing.price!);
  }

  priceWentDown(): boolean {
    const listing = this.listing();
    if (!listing) return false;
    return listing.price_history.some((h) => h.price > listing.price!);
  }

  scrollToPriceChart(): void {
    this.priceChartCard?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  currentImageIndex(images: { large: string }[]): number {
    return images.findIndex((img) => img.large === this.currentImage());
  }

  selectImage(url: string): void {
    const next = this.activeSlot() === 'a' ? 'b' : 'a';
    if (next === 'b') this.slotB.set(url);
    else this.slotA.set(url);
    this.currentImage.set(url);
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
          this.api.triggerSnapshot(this.listingId, 'rental').subscribe({
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
}
