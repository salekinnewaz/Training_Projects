/**
 * badge-priority — atom spec (HD-007).
 *
 * Pins the variant-class mapping for each TicketPriority value
 * plus the literal-label requirement (WCAG 1.4.1 — color is never
 * the only signal) AND the leading icon glyph (DESIGN.md §
 * "Priority Pill" — always paired with an arrow/glyph and text).
 *
 *   Low    → "low" + ▼ (down triangle) glyph
 *   Medium → "medium" + ■ (square) glyph
 *   High   → "high" + ▲ (up triangle) glyph
 *
 * The badge is display-only — no interactive states, no inputs
 * beyond the required priority signal.
 */

import { TestBed } from '@angular/core/testing';

import { BadgePriorityComponent } from './badge-priority.component';

describe('BadgePriorityComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgePriorityComponent],
    }).compileComponents();
  });

  it('renders the "low" variant class, down-triangle glyph, and label "Low"', () => {
    const fixture = TestBed.createComponent(BadgePriorityComponent);
    fixture.componentRef.setInput('priority', 'Low');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('low')).toBeTrue();
    expect(badge.querySelector('svg.priority-glyph')).not.toBeNull();
    expect(badge.textContent?.trim()).toBe('Low');
  });

  it('renders the "medium" variant class, square glyph, and label "Medium"', () => {
    const fixture = TestBed.createComponent(BadgePriorityComponent);
    fixture.componentRef.setInput('priority', 'Medium');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('medium')).toBeTrue();
    expect(badge.querySelector('svg.priority-glyph')).not.toBeNull();
    expect(badge.textContent?.trim()).toBe('Medium');
  });

  it('renders the "high" variant class, up-triangle glyph, and label "High"', () => {
    const fixture = TestBed.createComponent(BadgePriorityComponent);
    fixture.componentRef.setInput('priority', 'High');
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;
    expect(badge.classList.contains('high')).toBeTrue();
    expect(badge.querySelector('svg.priority-glyph')).not.toBeNull();
    expect(badge.textContent?.trim()).toBe('High');
  });

  it('exposes the variant signal for downstream assertions', () => {
    const fixture = TestBed.createComponent(BadgePriorityComponent);
    fixture.componentRef.setInput('priority', 'High');
    expect(fixture.componentInstance.variant()).toBe('high');
    expect(fixture.componentInstance.variantClass()).toBe('high');
    expect(fixture.componentInstance.label()).toBe('High');
  });
});
