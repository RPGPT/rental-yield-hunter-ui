import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  effect,
  input,
  signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { ListingImage } from '../../../core/models/listing.model';

@Component({
  selector: 'app-image-gallery',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-gallery.component.html',
  styleUrl: './image-gallery.component.scss',
})
export class ImageGalleryComponent {
  images = input<ListingImage[]>([]);
  alt = input<string>('Listing image');

  currentImage = signal<string>('');
  slotA = signal<string>('');
  slotB = signal<string>('');
  activeSlot = signal<'a' | 'b'>('a');

  constructor() {
    effect(() => {
      const imgs = this.images();
      if (imgs.length > 0) {
        const firstUrl = imgs[0].large;
        this.currentImage.set(firstUrl);
        this.slotA.set(firstUrl);
        this.slotB.set(firstUrl);
        this.activeSlot.set('a');
      } else {
        this.currentImage.set('');
        this.slotA.set('');
        this.slotB.set('');
        this.activeSlot.set('a');
      }
    });
  }

  currentImageIndex(): number {
    return this.images().findIndex((img) => img.large === this.currentImage());
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
    const imgs = this.images();
    if (imgs.length < 2) return;
    const idx = imgs.findIndex((img) => img.large === this.currentImage());
    const nextIdx = (idx + dir + imgs.length) % imgs.length;
    this.selectImage(imgs[nextIdx].large);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === 'ArrowRight') this.navigateImage(1);
    else if (event.key === 'ArrowLeft') this.navigateImage(-1);
  }
}
