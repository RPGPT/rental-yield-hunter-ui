import { describe, it, expect, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  function render(
    inputs: { title?: string; message?: string } = {},
  ): ComponentFixture<EmptyStateComponent> {
    TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(EmptyStateComponent);
    if (inputs.title !== undefined) fixture.componentRef.setInput('title', inputs.title);
    if (inputs.message !== undefined) fixture.componentRef.setInput('message', inputs.message);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders with default title and message', () => {
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state__title')?.textContent?.trim()).toBe('No results found');
    expect(el.querySelector('.empty-state__message')?.textContent?.trim()).toContain(
      'Try adjusting your filters',
    );
  });

  it('renders with custom title', () => {
    const fixture = render({ title: 'Nothing here' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state__title')?.textContent?.trim()).toBe('Nothing here');
  });

  it('renders with custom message', () => {
    const fixture = render({ message: 'Custom message' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty-state__message')?.textContent?.trim()).toBe('Custom message');
  });
});
