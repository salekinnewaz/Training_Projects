/**
 * badge-status — atom spec (HD-007).
 *
 * Pins the variant-class mapping for each TicketStatus value
 * plus the literal-label requirement (WCAG 1.4.1 — color is never
 * the only signal):
 *
 *   Open        → "open"
 *   In Progress → "in-progress"
 *   Resolved    → "resolved"
 *   Closed      → "closed"
 *
 * Per DESIGN.md §"Status Pill" the badge is also paired with a
 * leading icon glyph so color is never the sole signal. Each
 * variant test additionally asserts the rendered SVG glyph plus
 * the text label.
 *
 * The badge is display-only — no interactive states, no inputs
 * beyond the required status signal.
 */

import { TestBed } from '@angular/core/testing';

import { BadgeStatusComponent } from './badge-status.component';

describe('BadgeStatusComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeStatusComponent],
    }).compileComponents();
  });

  it('renders the "open" variant class, label "Open" and a glyph for status Open', () => {
    const fixture = TestBed.createComponent(BadgeStatusComponent);
    fixture.componentRef.setInput('status', 'Open');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.status-dot') as HTMLElement;
    expect(badge.classList.contains('open')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('Open');
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('renders the "in-progress" variant class, label "In Progress" and a glyph for status In Progress', () => {
    const fixture = TestBed.createComponent(BadgeStatusComponent);
    fixture.componentRef.setInput('status', 'In Progress');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.status-dot') as HTMLElement;
    expect(badge.classList.contains('in-progress')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('In Progress');
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('renders the "resolved" variant class, label "Resolved" and a glyph for status Resolved', () => {
    const fixture = TestBed.createComponent(BadgeStatusComponent);
    fixture.componentRef.setInput('status', 'Resolved');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.status-dot') as HTMLElement;
    expect(badge.classList.contains('resolved')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('Resolved');
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('renders the "closed" variant class, label "Closed" and a glyph for status Closed', () => {
    const fixture = TestBed.createComponent(BadgeStatusComponent);
    fixture.componentRef.setInput('status', 'Closed');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.status-dot') as HTMLElement;
    expect(badge.classList.contains('closed')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('Closed');
    expect(badge.querySelector('svg')).not.toBeNull();
  });
});
