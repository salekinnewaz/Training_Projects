/**
 * tickets-list-page — page spec (HD-019).
 *
 * Pins the page's observable contract with TicketService stubbed
 * out (no HTTP): the four render states, the filter → sort →
 * paginate pipeline, the client-side `filtered()` computed, and
 * the role gate.
 *
 * The role gate is the important one — this page must never render
 * for User at all. The `canView()` branch pins that.
 *
 * Note on the Employee Dashboard's stat strip (HD-020): that page
 * now renders a `data-testid="stat-strip"` of its own, scoped to
 * the User's OWN tickets. The two strips are deliberately distinct —
 * this one shows team-wide counters (agent/admin only) and that
 * one shows per-user counters — so the role gate here still
 * matters and is still asserted below.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { TicketService, type TicketStats } from '../../services/ticket.service';
import { TicketsListPageComponent } from './tickets-list-page.component';
import type { Ticket } from '../../models/ticket';
import type { UserPublic } from '../../models/user';

function makeUser(role: UserPublic['role'] = 'Support Agent'): UserPublic {
  return {
    id: 7,
    email: 'eli@company.com',
    displayName: 'Eli Tanaka',
    role,
    isActive: true,
    lastActiveAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 1,
    number: 'HD-1',
    title: 'VPN down',
    description: 'Cannot connect to VPN from home.',
    category: 'IT',
    priority: 'High',
    status: 'Open',
    submitter: makeUser('User'),
    owner: makeUser('Support Agent'),
    attachment: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

const STATS: TicketStats = {
  counts: { total: 3, open: 1, inProgress: 1, resolved: 1, closed: 0 },
  dailyCreated: [0, 1, 0, 2, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
};

describe('TicketsListPageComponent', () => {
  let fixture: ComponentFixture<TicketsListPageComponent>;
  let authStub: { user$: BehaviorSubject<UserPublic | null>; userSnapshot: jasmine.Spy };
  let ticketStub: {
    listAll: jasmine.Spy;
    stats: jasmine.Spy;
    patch: jasmine.Spy;
  };
  let queryMap: Record<string, string>;

  async function setup(role: UserPublic['role'] = 'Support Agent'): Promise<void> {
    authStub = {
      user$: new BehaviorSubject<UserPublic | null>(makeUser(role)),
      userSnapshot: jasmine.createSpy('userSnapshot').and.returnValue(makeUser(role)),
    };
    ticketStub = {
      listAll: jasmine.createSpy('listAll').and.resolveTo([
        makeTicket({ id: 1, number: 'HD-1', title: 'VPN down', status: 'Open', priority: 'High' }),
        makeTicket({ id: 2, number: 'HD-2', title: 'Printer jam', status: 'In Progress', priority: 'Medium' }),
        makeTicket({ id: 3, number: 'HD-3', title: 'Password reset', status: 'Resolved', priority: 'Low' }),
      ]),
      stats: jasmine.createSpy('stats').and.resolveTo(STATS),
      patch: jasmine.createSpy('patch').and.resolveTo(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [TicketsListPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: TicketService, useValue: ticketStub },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => queryMap[k] ?? null } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketsListPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    queryMap = {};
    document.body.innerHTML = '';
  });

  it('fetches rows + stats on init', async () => {
    await setup();
    expect(ticketStub.listAll).toHaveBeenCalled();
    expect(ticketStub.stats).toHaveBeenCalled();
  });

  it('renders the stat strip once stats arrive', async () => {
    await setup();
    expect(fixture.nativeElement.querySelector('[data-testid="stat-strip"]')).not.toBeNull();
  });

  it('renders the ticket rows in the table', async () => {
    await setup();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('renders the shared filter bar', async () => {
    await setup();
    expect(fixture.nativeElement.querySelector('[data-testid="ticket-filter-bar"]')).not.toBeNull();
  });

  it('renders the pagination footer with a "Showing" summary', async () => {
    await setup();
    expect(fixture.nativeElement.querySelector('[data-testid="pagination-summary"]')).not.toBeNull();
  });

  // ── role gate ──────────────────────────────────────────────

  it('does NOT render the stat strip or table for the User role', async () => {
    await setup('User');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-testid="tickets-forbidden"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="stat-strip"]')).toBeNull();
    expect(host.querySelector('[data-testid="ticket-table"]')).toBeNull();
  });

  // ── render states ──────────────────────────────────────────

  it('renders the error card when the list fetch rejects', async () => {
    authStub = {
      user$: new BehaviorSubject<UserPublic | null>(makeUser()),
      userSnapshot: jasmine.createSpy('userSnapshot').and.returnValue(makeUser()),
    };
    ticketStub = {
      listAll: jasmine.createSpy('listAll').and.rejectWith(new Error('boom')),
      stats: jasmine.createSpy('stats').and.resolveTo(STATS),
      patch: jasmine.createSpy('patch'),
    };
    await TestBed.configureTestingModule({
      imports: [TicketsListPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: TicketService, useValue: ticketStub },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketsListPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="tickets-error"]')).not.toBeNull();
  });

  it('renders the shared table\'s empty row when the fetch returns zero rows', async () => {
    // Rebuild the stub so listAll returns an empty array from
    // the start (the helper-driven setup pre-seeds three rows).
    authStub = {
      user$: new BehaviorSubject<UserPublic | null>(makeUser()),
      userSnapshot: jasmine.createSpy('userSnapshot').and.returnValue(makeUser()),
    };
    ticketStub = {
      listAll: jasmine.createSpy('listAll').and.resolveTo([]),
      stats: jasmine.createSpy('stats').and.resolveTo(STATS),
      patch: jasmine.createSpy('patch'),
    };
    await TestBed.configureTestingModule({
      imports: [TicketsListPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: TicketService, useValue: ticketStub },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketsListPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const table = fixture.nativeElement.querySelector('[data-testid="ticket-table"]');
    expect(table).not.toBeNull();
    expect(table.querySelector('.empty-text')).not.toBeNull();
    expect(table.querySelector('.empty-text').textContent.trim()).toBe(
      'No tickets match your filters',
    );
  });

  // ── client-side filter pipeline ────────────────────────────

  it('narrows the table to the active status filter', async () => {
    await setup();
    (fixture.componentInstance as unknown as {
      applyFilters(s: Record<string, unknown>): void;
    }).applyFilters({
      search: '',
      customer: 'all',
      application: 'all',
      priority: 'all',
      assignee: 'all',
      sort: 'newest',
      status: 'Open',
    });
    fixture.detectChanges();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
  });

  it('narrows the table by search term against title and ID', async () => {
    await setup();
    (fixture.componentInstance as unknown as {
      applyFilters(s: Record<string, unknown>): void;
    }).applyFilters({
      search: 'printer',
      customer: 'all',
      application: 'all',
      priority: 'all',
      assignee: 'all',
      sort: 'newest',
      status: 'all',
    });
    fixture.detectChanges();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Printer jam');
  });

  it('seeds the search box from the ?q= query param', async () => {
    queryMap = { q: 'printer' };
    await setup();
    const input = fixture.nativeElement.querySelector(
      '[data-testid="ticket-filter-search"]',
    ) as HTMLInputElement;
    expect(input.value).toBe('printer');
  });
});