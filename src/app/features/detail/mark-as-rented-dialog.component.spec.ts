import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { MarkAsRentedDialogComponent } from './mark-as-rented-dialog.component';

describe('MarkAsRentedDialogComponent', () => {
  let dialogRefClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dialogRefClose = vi.fn();

    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: MatDialogRef,
          useValue: { close: dialogRefClose },
        },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('initialises with lifetimeRent=false, rentPerMonth=null, contractExpiryDate=null', () => {
    const component = TestBed.runInInjectionContext(() => new MarkAsRentedDialogComponent());
    expect(component.lifetimeRent).toBe(false);
    expect(component.rentPerMonth).toBeNull();
    expect(component.contractExpiryDate).toBeNull();
  });

  describe('confirm()', () => {
    it('closes dialog with lifetimeRent=false and provided contract values', () => {
      const component = TestBed.runInInjectionContext(() => new MarkAsRentedDialogComponent());
      component.rentPerMonth = 1200;
      component.contractExpiryDate = '2026-06-01';
      component.confirm();
      expect(dialogRefClose).toHaveBeenCalledWith({
        lifetimeRent: false,
        rentPerMonth: 1200,
        contractExpiryDate: '2026-06-01',
      });
    });

    it('nullifies contract fields when lifetimeRent is true', () => {
      const component = TestBed.runInInjectionContext(() => new MarkAsRentedDialogComponent());
      component.lifetimeRent = true;
      component.rentPerMonth = 900;
      component.contractExpiryDate = '2026-01-01';
      component.confirm();
      expect(dialogRefClose).toHaveBeenCalledWith({
        lifetimeRent: true,
        rentPerMonth: null,
        contractExpiryDate: null,
      });
    });

    it('passes null rentPerMonth when no value entered and lifetimeRent is false', () => {
      const component = TestBed.runInInjectionContext(() => new MarkAsRentedDialogComponent());
      component.confirm();
      expect(dialogRefClose).toHaveBeenCalledWith({
        lifetimeRent: false,
        rentPerMonth: null,
        contractExpiryDate: null,
      });
    });
  });
});
