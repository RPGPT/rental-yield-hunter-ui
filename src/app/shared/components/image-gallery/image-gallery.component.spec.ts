import { describe, it, expect, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ImageGalleryComponent } from './image-gallery.component';

const MOCK_IMAGES = [
  { large: 'https://img.example.com/1-large.jpg', medium: 'https://img.example.com/1-med.jpg' },
  { large: 'https://img.example.com/2-large.jpg', medium: 'https://img.example.com/2-med.jpg' },
];

describe('ImageGalleryComponent', () => {
  function setup(images = MOCK_IMAGES) {
    TestBed.configureTestingModule({
      imports: [ImageGalleryComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(ImageGalleryComponent);
    fixture.componentRef.setInput('images', images);
    TestBed.flushEffects();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('initializes first image into currentImage and slots', () => {
    const { component } = setup();
    expect(component.currentImage()).toBe(MOCK_IMAGES[0].large);
    expect(component.currentImageIndex()).toBe(0);
  });

  it('resets state cleanly when images input is empty', () => {
    const { component } = setup([]);
    expect(component.currentImage()).toBe('');
  });

  it('selectImage() updates double-buffered slots a and b', () => {
    const { component } = setup();
    component.selectImage(MOCK_IMAGES[1].large);
    expect(component.currentImage()).toBe(MOCK_IMAGES[1].large);
    expect(component.slotB()).toBe(MOCK_IMAGES[1].large);

    component.activeSlot.set('b');
    component.selectImage(MOCK_IMAGES[0].large);
    expect(component.slotA()).toBe(MOCK_IMAGES[0].large);
  });

  it('navigateImage() cycles forward, wraps backward, and ignores < 2 images', () => {
    const { fixture, component } = setup();
    component.navigateImage(1);
    expect(component.currentImage()).toBe(MOCK_IMAGES[1].large);

    component.navigateImage(1);
    expect(component.currentImage()).toBe(MOCK_IMAGES[0].large);

    component.navigateImage(-1);
    expect(component.currentImage()).toBe(MOCK_IMAGES[1].large);

    fixture.componentRef.setInput('images', [MOCK_IMAGES[0]]);
    TestBed.flushEffects();
    component.navigateImage(1);
    expect(component.currentImage()).toBe(MOCK_IMAGES[0].large);
  });

  it('handles ArrowLeft/ArrowRight keyboard events while ignoring form controls', () => {
    const { component } = setup();
    const spy = vi.spyOn(component, 'navigateImage');

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(spy).toHaveBeenCalledWith(1);

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(spy).toHaveBeenCalledWith(-1);

    spy.mockClear();
    const inputEvt = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(inputEvt, 'target', { get: () => ({ tagName: 'INPUT' }) });
    component.onKeyDown(inputEvt);
    expect(spy).not.toHaveBeenCalled();

    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(spy).not.toHaveBeenCalled();
  });
});
