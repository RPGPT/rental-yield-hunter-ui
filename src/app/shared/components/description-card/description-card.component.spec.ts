import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DescriptionCardComponent } from './description-card.component';

describe('DescriptionCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders plain, loading, or rich HTML description states', () => {
    TestBed.configureTestingModule({
      imports: [DescriptionCardComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(DescriptionCardComponent);
    const sanitizer = TestBed.inject(DomSanitizer);

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading description');

    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('plainDescription', 'Plain text flat');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Plain text flat');

    fixture.componentRef.setInput(
      'richDescription',
      sanitizer.bypassSecurityTrustHtml('<strong>Rich flat</strong>'),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML).toContain('<strong>Rich flat</strong>');
  });
});
