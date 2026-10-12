/**
 * timeline-entry — molecule spec (HD-010).
 *
 * Pins the description-derivation matrix + the actor / timestamp
 * rendering. Each event type has its own description template; the
 * molecule must:
 *
 *   - Render the actor display name as "System" when actor is null
 *   - Look up names for Assigned / Reassigned via the lookup table
 *     (falls back to "someone" / "Unassigned" when missing)
 *   - Use literal strings for Created / Reopened / ConfirmedClosed
 *   - Append the "commented" suffix for CommentAdded
 *
 * The full per-event-type matrix is exercised here so the
 * exhaustive `describe` switch in timeline-entry.component.ts
 * can't regress silently.
 */

import { TestBed } from '@angular/core/testing';

import type { ActivityEventPayload } from '../../../models/activity-log';
import type { UserPublic } from '../../../models/user';
import { TimelineEntryComponent } from './timeline-entry.component';

function makeActor(): UserPublic {
  return {
    id: 11,
    email: 'sam@example.com',
    displayName: 'Sam',
    role: 'Support Agent',
    isActive: true,
    lastActiveAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('TimelineEntryComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineEntryComponent],
    }).compileComponents();
  });

  it('renders "System" as the actor name when actor is null', () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'Created');
    fixture.componentRef.setInput('actor', null);
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    fixture.componentRef.setInput('payload', null);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('System');
    expect(html).toContain('created this ticket');
  });

  it('renders "{actor} created this ticket" for Created', () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'Created');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    fixture.componentRef.setInput('payload', null);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Sam');
    expect(html).toContain('created this ticket');
  });

  it('renders "{actor} assigned the ticket to {name}" for Assigned with a lookup hit', () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'Assigned');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    const payload: ActivityEventPayload = { eventType: 'Assigned', assigneeId: 22 };
    fixture.componentRef.setInput('payload', payload);
    fixture.componentRef.setInput('lookup', { 22: 'Riley' });
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('assigned the ticket to Riley');
  });

  it('falls back to "someone" for Assigned when the lookup misses', () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'Assigned');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    const payload: ActivityEventPayload = { eventType: 'Assigned', assigneeId: 999 };
    fixture.componentRef.setInput('payload', payload);
    fixture.componentRef.setInput('lookup', {});
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('assigned the ticket to someone');
  });

  it('renders "from Unassigned to {name}" for Reassigned when fromUserId is null', () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'Reassigned');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    const payload: ActivityEventPayload = {
      eventType: 'Reassigned',
      fromUserId: null,
      toUserId: 22,
    };
    fixture.componentRef.setInput('payload', payload);
    fixture.componentRef.setInput('lookup', { 22: 'Riley' });
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('reassigned the ticket from Unassigned to Riley');
  });

  it('renders "from {from} to {to}" for Reassigned when both users are in the lookup', () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'Reassigned');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    const payload: ActivityEventPayload = {
      eventType: 'Reassigned',
      fromUserId: 11,
      toUserId: 22,
    };
    fixture.componentRef.setInput('payload', payload);
    fixture.componentRef.setInput('lookup', { 11: 'Sam', 22: 'Riley' });
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('reassigned the ticket from Sam to Riley');
  });

  it("renders 'changed status from {from} to {to}' for StatusChanged", () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'StatusChanged');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    const payload: ActivityEventPayload = {
      eventType: 'StatusChanged',
      from: 'Open',
      to: 'In Progress',
    };
    fixture.componentRef.setInput('payload', payload);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('changed status from Open to In Progress');
  });

  it("renders 'changed priority from {from} to {to}' for PriorityChanged", () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'PriorityChanged');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    const payload: ActivityEventPayload = {
      eventType: 'PriorityChanged',
      from: 'Low',
      to: 'High',
    };
    fixture.componentRef.setInput('payload', payload);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('changed priority from Low to High');
  });

  it("renders 'reopened this ticket' for Reopened", () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'Reopened');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    const payload: ActivityEventPayload = { eventType: 'Reopened', reopenedBy: 11 };
    fixture.componentRef.setInput('payload', payload);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('reopened this ticket');
  });

  it("renders 'closed this ticket' for ConfirmedClosed", () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'ConfirmedClosed');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    const payload: ActivityEventPayload = { eventType: 'ConfirmedClosed', closedBy: 11 };
    fixture.componentRef.setInput('payload', payload);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('closed this ticket');
  });

  it("renders 'commented' for CommentAdded", () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'CommentAdded');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    const payload: ActivityEventPayload = { eventType: 'CommentAdded', commentId: 99 };
    fixture.componentRef.setInput('payload', payload);
    fixture.detectChanges();

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('commented');
  });

  it('renders the relative timestamp inside <time class="entry-time">', () => {
    const fixture = TestBed.createComponent(TimelineEntryComponent);
    fixture.componentRef.setInput('eventType', 'Created');
    fixture.componentRef.setInput('actor', makeActor());
    fixture.componentRef.setInput('createdAt', new Date().toISOString());
    fixture.componentRef.setInput('payload', null);
    fixture.detectChanges();

    const time = fixture.nativeElement.querySelector('time.entry-time') as HTMLElement;
    expect(time).not.toBeNull();
    expect(time.textContent?.trim()).toMatch(/just now|seconds ago|minute|hour/);
  });
});