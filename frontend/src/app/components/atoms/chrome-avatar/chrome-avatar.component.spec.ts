/**
 * chrome-avatar — atom spec (HD-004).
 *
 * Pins the initials-derivation contract + the size/aria-hidden
 * rendering:
 *
 *   "Eli Chen"         → "EC"
 *   "Eli"              → "E"
 *   "Eli Chen Patel"   → "EP"  (first word + last word, not all
 *                                the middle words)
 *   ""                 → "?"   (the spec's fallback for empty input)
 *   "  spaces  "       → trimmed
 *
 *   [size]="24"        → width: 24px; height: 24px
 *   default            → 32px
 *
 *   aria-hidden="true" so screen readers don't read the initials
 */

import { TestBed } from '@angular/core/testing';

import { ChromeAvatarComponent } from './chrome-avatar.component';

describe('ChromeAvatarComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChromeAvatarComponent],
    }).compileComponents();
  });

  it('computes "EC" for "Eli Chen"', () => {
    const fixture = TestBed.createComponent(ChromeAvatarComponent);
    fixture.componentRef.setInput('displayName', 'Eli Chen');
    expect(fixture.componentInstance.initials()).toBe('EC');
  });

  it('computes a single letter for a single-word name', () => {
    const fixture = TestBed.createComponent(ChromeAvatarComponent);
    fixture.componentRef.setInput('displayName', 'Eli');
    expect(fixture.componentInstance.initials()).toBe('E');
  });

  it('uses first + last word for a multi-word name (not the middle)', () => {
    const fixture = TestBed.createComponent(ChromeAvatarComponent);
    fixture.componentRef.setInput('displayName', 'Eli Chen Patel');
    expect(fixture.componentInstance.initials()).toBe('EP');
  });

  it('uppercases the initials', () => {
    const fixture = TestBed.createComponent(ChromeAvatarComponent);
    fixture.componentRef.setInput('displayName', 'eli chen');
    expect(fixture.componentInstance.initials()).toBe('EC');
  });

  it('falls back to "?" for empty input', () => {
    const fixture = TestBed.createComponent(ChromeAvatarComponent);
    fixture.componentRef.setInput('displayName', '');
    expect(fixture.componentInstance.initials()).toBe('?');
  });

  it('trims surrounding whitespace before deriving initials', () => {
    const fixture = TestBed.createComponent(ChromeAvatarComponent);
    fixture.componentRef.setInput('displayName', '  Eli  ');
    expect(fixture.componentInstance.initials()).toBe('E');
  });

  it('renders the initials inside the avatar span with aria-hidden="true"', () => {
    const fixture = TestBed.createComponent(ChromeAvatarComponent);
    fixture.componentRef.setInput('displayName', 'Eli Chen');
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('.avatar') as HTMLElement;
    expect(span).not.toBeNull();
    expect(span.textContent?.trim()).toBe('EC');
    expect(span.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults to 32px size', () => {
    const fixture = TestBed.createComponent(ChromeAvatarComponent);
    fixture.componentRef.setInput('displayName', 'Eli');
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('.avatar') as HTMLElement;
    expect(span.style.width).toBe('32px');
    expect(span.style.height).toBe('32px');
  });

  it('respects [size]="24" with a 24×24 box', () => {
    const fixture = TestBed.createComponent(ChromeAvatarComponent);
    fixture.componentRef.setInput('displayName', 'Eli');
    fixture.componentRef.setInput('size', 24);
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('.avatar') as HTMLElement;
    expect(span.style.width).toBe('24px');
    expect(span.style.height).toBe('24px');
  });
});