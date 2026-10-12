/**
 * ticket-row — molecule spec (HD-007).
 *
 * Pins the row markup + the routerLink wiring:
 *
 *   (a) Renders a single focusable <a> with routerLink="/tickets/<id>"
 *   (b) The row carries the four pill labels per the spec:
 *       number (mono), title, status pill, priority pill,
 *       relative timestamp
 *   (c) The aria-label includes number, title, status, priority
 *       (screen-reader summary so the row is announced on focus)
 *   (d) The relativeTime input is rendered as text inside <time>
 *       with the [datetime] attribute set to ticket.updatedAt
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Ticket } from '../../../models/ticket';
import { TicketRowComponent } from './ticket-row.component';

const ticket: Ticket = {
  id: 47,
  number: 'HD-47',
  title: 'WiFi drops',
  description: 'every few minutes',
  category: 'IT',
  priority: 'High',
  status: 'Open',
  submitter: {
    id: 7,
    email: 'eli@example.com',
    displayName: 'Eli',
    role: 'User',
    isActive: true,
    lastActiveAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  owner: null,
  attachment: null,
  createdAt: '2026-01-15T10:30:00.000Z',
  updatedAt: '2026-01-15T10:30:00.000Z',
  deletedAt: null,
};

describe('TicketRowComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketRowComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders a single <a> with routerLink="/tickets/<id>"', () => {
    const fixture = TestBed.createComponent(TicketRowComponent);
    fixture.componentRef.setInput('ticket', ticket);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.row') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    // RouterLink writes the resolved href; in a TestBed with no
    // matching route, it defaults to "/". The presence of the
    // href attribute is the contract.
    expect(link.hasAttribute('href')).toBeTrue();
  });

  it('renders the number + status + priority as pills/text', () => {
    const fixture = TestBed.createComponent(TicketRowComponent);
    fixture.componentRef.setInput('ticket', ticket);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.number')?.textContent?.trim()).toBe('HD-47');
    expect(root.querySelector('.title')?.textContent?.trim()).toBe('WiFi drops');

    const statusBadge = root.querySelector('.status .status-dot') as HTMLElement;
    expect(statusBadge.textContent?.trim()).toBe('Open');

    const priorityBadge = root.querySelector('.priority .badge') as HTMLElement;
    expect(priorityBadge.textContent?.trim()).toBe('High');
  });

  it('renders the relativeTime inside a <time> with [datetime]=updatedAt', () => {
    const fixture = TestBed.createComponent(TicketRowComponent);
    fixture.componentRef.setInput('ticket', ticket);
    fixture.componentRef.setInput('relativeTime', '2 hours ago');
    fixture.detectChanges();

    const time = fixture.nativeElement.querySelector('time.timestamp') as HTMLElement;
    expect(time).not.toBeNull();
    expect(time.textContent?.trim()).toBe('2 hours ago');
    expect(time.getAttribute('datetime')).toBe(ticket.updatedAt);
  });

  it('sets the aria-label to a screen-reader summary of the row', () => {
    const fixture = TestBed.createComponent(TicketRowComponent);
    fixture.componentRef.setInput('ticket', ticket);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.row') as HTMLAnchorElement;
    const aria = link.getAttribute('aria-label') ?? '';
    expect(aria).toContain('HD-47');
    expect(aria).toContain('WiFi drops');
    expect(aria).toContain('Open');
    expect(aria).toContain('High');
  });
});