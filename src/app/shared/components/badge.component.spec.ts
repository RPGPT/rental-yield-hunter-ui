import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BadgeComponent } from './badge.component';

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<BadgeComponent>;

  function render(label: string, color: 'green' | 'red' | 'amber' | 'grey' | 'blue'): HTMLElement {
    fixture = TestBed.createComponent(BadgeComponent);
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('color', color);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BadgeComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('renders the label text', () => {
    const el = render('Active', 'green');
    expect(el.querySelector('.badge')!.textContent!.trim()).toBe('Active');
  });

  it('applies badge--green CSS class for green color', () => {
    const el = render('Test', 'green');
    expect(el.querySelector('.badge--green')).toBeTruthy();
  });

  it('applies badge--red CSS class for red color', () => {
    const el = render('Test', 'red');
    expect(el.querySelector('.badge--red')).toBeTruthy();
  });

  it('applies badge--amber CSS class for amber color', () => {
    const el = render('Warn', 'amber');
    expect(el.querySelector('.badge--amber')).toBeTruthy();
  });

  it('applies badge--grey CSS class for grey color', () => {
    const el = render('Off', 'grey');
    expect(el.querySelector('.badge--grey')).toBeTruthy();
  });

  it('applies badge--blue CSS class for blue color', () => {
    const el = render('Info', 'blue');
    expect(el.querySelector('.badge--blue')).toBeTruthy();
  });
});
