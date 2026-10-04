/**
 * timeline-entry — molecule spec (HD-010).
 *
 * Single OnPush test verifying the spec requirement: given
 * `eventType: 'StatusChanged'`, `payload: { from: 'Open', to: 'In
 * Progress' }`, `actor: { displayName: 'Sam' }` → the rendered
 * description reads "Sam changed status from Open to In Progress".
 *
 * The full per-event-type matrix is exercised via the
 * ticket-detail-page component spec; this spec pins the one
 * case the spec calls out explicitly.
 */

import { TestBed } from '@angular/core/testing';

import { TimelineEntryComponent } from './timeline-entry.component';

describe('TimelineEntryComponent (HD-010)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineEntryComponent],
    }).compileComponents();
  });

  it("renders 'Sam changed status from Open to In Progress' for a StatusChanged row", () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);

    fixture.componentRef.setInput('eventType', 'StatusChanged');
    fixture.componentRef.setInput('actor', {
      id: 11,
      email: 'sam@example.com',
      displayName: 'Sam',
      role: 'Support Agent',
      isActive: true,
      lastActiveAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    fixture.componentRef.setInput('payload', {
      eventType: 'StatusChanged',
      from: 'Open',
      to: 'In Progress',
    });

    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Sam');
    expect(html).toContain('changed status from Open to In Progress');
  });
});