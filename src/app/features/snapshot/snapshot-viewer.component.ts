import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-snapshot-viewer',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './snapshot-viewer.component.html',
  styleUrl: './snapshot-viewer.component.scss',
})
export class SnapshotViewerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly api = inject(ApiService);

  listingId = '';
  listingTitle = signal<string | null>(null);
  iframeUrl = signal<SafeResourceUrl | null>(null);
  loading = signal(true);

  ngOnInit(): void {
    this.listingId = this.route.snapshot.paramMap.get('id')!;
    const url = `${environment.apiUrl}/listings/snapshot-download?id=${this.listingId}`;
    this.iframeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.api.getListing(this.listingId).subscribe({
      next: (listing) => this.listingTitle.set(listing.title),
      error: () => {},
    });
  }

  onIframeLoad(): void {
    this.loading.set(false);
  }

  goBack(): void {
    void this.router.navigate(['/listing', this.listingId]);
  }
}
