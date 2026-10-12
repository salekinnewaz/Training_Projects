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

  it('renders the "open" variant class and label "Open" for status Open', () => {
    const fixture = TestBed.createComponent(BadgeStatusComponent);
    fixture.componentRef.setInput('status', 'Open');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('open')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('Open');
  });

  it('renders the "in-progress" variant class and label "In Progress" for status In Progress', () => {
    const fixture = TestBed.createComponent(BadgeStatusComponent);
    fixture.componentRef.setInput('status', 'In Progress');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('in-progress')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('In Progress');
  });

  it('renders the "resolved" variant class and label "Resolved" for status Resolved', () => {
    const fixture = TestBed.createComponent(BadgeStatusComponent);
    fixture.componentRef.setInput('status', 'Resolved');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('resolved')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('Resolved');
  });

  it('renders the "closed" variant class and label "Closed" for status Closed', () => {
    const fixture = TestBed.createComponent(BadgeStatusComponent);
    fixture.componentRef.setInput('status', 'Closed');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('closed')).toBeTrue();
    expect(badge.textContent?.trim()).toBe('Closed');
  });
});