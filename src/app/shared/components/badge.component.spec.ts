import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BadgeComponent } from './badge.component';

describe('BadgeComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('can be instantiated', () => {
    const component = TestBed.runInInjectionContext(() => new BadgeComponent());
    expect(component).toBeTruthy();
  });

  it('exposes a label input signal', () => {
    const component = TestBed.runInInjectionContext(() => new BadgeComponent());
    expect(typeof component.label).toBe('function');
  });

  it('exposes a color input signal', () => {
    const component = TestBed.runInInjectionContext(() => new BadgeComponent());
    expect(typeof component.color).toBe('function');
  });
});
