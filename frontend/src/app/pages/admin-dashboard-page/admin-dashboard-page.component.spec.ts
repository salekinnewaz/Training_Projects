/**
 * AdminDashboardPageComponent — HD-013 / WDS-2026.
 *
 * Verifies the Admin Dashboard's Tickets tab, which now renders
 * the SHARED ticket table — the same `<ticket-filter-bar>` and
 * `<ticket-table>` the User's and the Agent's dashboards render.
 *
 * Coverage:
 *   - The tab switcher (Tickets / Users), its ARIA wiring, and the
 *     reactive heading.
 *   - The Tickets tab renders the shared filter bar with its
 *     search input, its four dropdowns, its sort control and the
 *     purple "More filters" button.
 *   - The shared table renders the ten reference columns and the
 *     pagination footer ("Showing 1–10 of N tickets").
 *   - Loading state, error state, Retry, and the 401 no-error rule.
 *   - URL hash #users renders the HD-014 <app-users-tab-page>.
 *
 * The Kanban board that used to live here is gone — the WDS-2026
 * reference layout replaced it with the shared table. Its coverage
 * now lives in the shared components' own specs.
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { BehaviorSubject, type Observable } from 'rxjs';

import { AdminDashboardPageComponent } from './admin-dashboard-page.component';
import { TicketService, type TicketStats } from '../../services/ticket.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ApiError } from '../../services/api-error';
import type { Ticket } from '../../models/ticket';
import type { UserPublic } from '../../models/user';

const baseUser: UserPublic = {
  id: 1,
  email: 'admin@example.com',
  displayName: 'Avery',
  role: 'Admin',
  isActive: true,
  lastActiveAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function makeTicket(
  id: number,
  status: Ticket['status'] = 'Open',
  title = `Ticket ${id}`,
  daysAgo = 1,
): Ticket {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    id,
    number: `HD-${String(id).padStart(3, '0')}`,
    title,
    description: `Description for ticket ${id}`,
    category: null,
    priority: 'Medium',
    status,
    submitter: baseUser,
    owner: null,
    attachment: null,
    createdAt: d.toISOString(),
    updatedAt: d.toISOString(),
    deletedAt: null,
  };
}

describe('AdminDashboardPageComponent (HD-013 / WDS-2026)', () => {
  let fixture: ComponentFixture<AdminDashboardPageComponent>;
  let component: AdminDashboardPageComponent;
  let ticketService: { listAll: jasmine.Spy; stats: jasmine.Spy };

  beforeEach(async () => {
    ticketService = {
      listAll: jasmine.createSpy('listAll'),
      stats: jasmine.createSpy('stats'),
    };
    // The stat strip is OPTIONAL — it is fed by an independent
    // read (GET /api/tickets/stats). The default here is a
    // rejection so the strip is absent unless a test opts in, which
    // keeps the pre-existing table assertions unaffected.
    ticketService.stats.and.rejectWith(new Error('no stats stubbed'));

    await TestBed.configureTestingModule({
      imports: [AdminDashboardPageComponent],
      providers: [
        provideRouter([
          { path: 'admin', children: [] },
          { path: 'users', children: [] },
          { path: 'tickets/:id', children: [] },
        ]),
        provideHttpClient(),
        { provide: TicketService, useValue: ticketService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardPageComponent);
    component = fixture.componentInstance;
  });

  /** Resolve + settle, the standard "data has arrived" dance. */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the shared ticket table in success state', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1), makeTicket(2)]);
    await settle();

    expect(component.renderState()).toBe('success');
    const table = fixture.nativeElement.querySelector('[data-testid="ticket-table"]');
    expect(table).toBeTruthy();
  });

  it('renders the shared filter bar with the reference\'s five controls', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    const bar = fixture.nativeElement.querySelector('[data-testid="ticket-filter-bar"]');
    expect(bar).toBeTruthy();

    // The search input carries the reference's placeholder verbatim.
    const search = bar.querySelector('[data-testid="ticket-filter-search"]');
    expect(search.getAttribute('placeholder')).toBe(
      'Search tickets by ID, title, or keyword...',
    );

    // customer / application / priority / assignee / sort.
    const selects = bar.querySelectorAll('select');
    expect(selects.length).toBe(5);

    // The purple "More filters" button is present.
    const more = bar.querySelector('[data-testid="ticket-filter-more"]');
    expect(more).toBeTruthy();
    expect(more.textContent.trim()).toBe('More filters');
  });

  it('shows the reference\'s default dropdown labels', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('ticket-filter-bar .pill-label'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(labels).toEqual([
      'All customers',
      'All applications',
      'All priorities',
      'All assignees',
      'Newest first',
    ]);
  });

  it('renders the reference\'s table columns', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="ticket-table"] thead th'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    // The checkbox, category and actions headers are icon-only and
    // carry sr-only text — the visible labels are the six the
    // reference prints.
    expect(headers).toContain('ID');
    expect(headers).toContain('Title');
    expect(headers).toContain('Status');
    expect(headers).toContain('Priority');
    expect(headers).toContain('Customer');
    expect(headers).toContain('Assignee');
    expect(headers).toContain('Updated');
  });

  it('renders the pagination footer with the reference\'s copy', async () => {
    ticketService.listAll.and.resolveTo([
      makeTicket(1), makeTicket(2), makeTicket(3),
    ]);
    await settle();

    const summary = fixture.nativeElement.querySelector(
      '[data-testid="ticket-table-summary"]',
    );
    expect(summary.textContent.trim()).toBe('Showing 1–3 of 3 tickets');

    // The page-size picker offers "10 / page" and the numbered
    // pagination renders.
    const size = fixture.nativeElement.querySelector(
      '[data-testid="ticket-table-page-size"]',
    );
    expect(size).toBeTruthy();
    const options = Array.from(size.querySelectorAll('option')).map((o) =>
      (o as HTMLOptionElement).textContent?.trim(),
    );
    expect(options).toEqual(['10 / page', '25 / page', '50 / page']);
  });

  it('renders the row\'s ticket number, title and description', async () => {
    ticketService.listAll.and.resolveTo([
      makeTicket(7, 'Open', 'VPN disconnects nightly'),
    ]);
    await settle();

    const row = fixture.nativeElement.querySelector(
      '[data-testid="ticket-table"] tbody tr',
    );
    expect(row.querySelector('.number').textContent.trim()).toBe('HD-007');
    expect(row.querySelector('.title').textContent.trim()).toBe('VPN disconnects nightly');
    expect(row.querySelector('.desc').textContent.trim()).toBe(
      'Description for ticket 7',
    );
  });

  it('renders the status and priority pills inside a row', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1, 'In Progress')]);
    await settle();

    const row = fixture.nativeElement.querySelector(
      '[data-testid="ticket-table"] tbody tr',
    );
    expect(row.querySelector('badge-status')).toBeTruthy();
    expect(row.querySelector('badge-status').textContent.trim()).toBe('In Progress');
    expect(row.querySelector('badge-priority').textContent.trim()).toBe('Medium');
  });

  it('renders the category icon for every row', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    const row = fixture.nativeElement.querySelector(
      '[data-testid="ticket-table"] tbody tr',
    );
    expect(row.querySelector('ticket-category-icon')).toBeTruthy();
  });

  it('shows "Unassigned" when the ticket has no owner', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    const row = fixture.nativeElement.querySelector(
      '[data-testid="ticket-table"] tbody tr',
    );
    expect(row.querySelector('.person-empty').textContent.trim()).toBe('Unassigned');
  });

  it('renders a loading skeleton before the data arrives', async () => {
    let resolveFn!: (t: Ticket[]) => void;
    ticketService.listAll.and.returnValue(
      new Promise<Ticket[]>((r) => { resolveFn = r; }),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.renderState()).toBe('loading');
    expect(
      fixture.nativeElement.querySelector('[data-testid="admin-table-skeleton"]'),
    ).toBeTruthy();

    resolveFn([makeTicket(1)]);
  });

  it('shows inline error + Retry button on server error', async () => {
    ticketService.listAll.and.rejectWith(
      new ApiError(500, 'internal_server_error', 'boom'),
    );
    await settle();

    expect(component.renderState()).toBe('error');
    const errorCard = fixture.nativeElement.querySelector('.admin-error-card');
    expect(errorCard).toBeTruthy();
    expect(errorCard.querySelector('.error-message').textContent.trim()).toBe(
      "Couldn't load the queue. Refresh to try again.",
    );
    expect(errorCard.querySelector('atom-button')).toBeTruthy();
  });

  it('does not show the error card on a 401 (auth interceptor redirects)', async () => {
    ticketService.listAll.and.rejectWith(
      new ApiError(401, 'unauthenticated', 'expired'),
    );
    await settle();

    expect(component.renderState()).not.toBe('error');
  });

  it('Retry button refetches the dashboard', async () => {
    let callCount = 0;
    ticketService.listAll.and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new ApiError(500, 'internal_server_error', 'boom'));
      }
      return Promise.resolve([makeTicket(1)]);
    });
    await settle();
    expect(component.renderState()).toBe('error');

    component.onRefresh();
    await settle();

    expect(component.renderState()).toBe('success');
    expect(ticketService.listAll).toHaveBeenCalledTimes(2);
  });

  it('reactive heading reflects the active tab on initial load (Tickets)', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Tickets');
  });

  it('renders the tablist with role="tablist" and two role="tab" anchors', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.tabs[role="tablist"]')).toBeTruthy();
    expect(compiled.querySelectorAll('.tab[role="tab"]').length).toBe(2);
  });

  it('marks the active tab with aria-selected="true" and the inactive with aria-selected="false"', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    const tabs = fixture.nativeElement.querySelectorAll('.tab[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    const ticketsTab = Array.from(tabs).find((t) => t.textContent?.trim() === 'Tickets')!;
    const usersTab = Array.from(tabs).find((t) => t.textContent?.trim() === 'Users')!;
    expect(ticketsTab.getAttribute('aria-selected')).toBe('true');
    expect(usersTab.getAttribute('aria-selected')).toBe('false');
  });

  it('renders the redesigned page subtitle below the heading', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    const subtitle = fixture.nativeElement.querySelector('.page-subtitle');
    expect(subtitle?.textContent?.trim()).toBe(
      'Monitor and manage all support tickets across different stages.',
    );
  });

  it('window:focus refetches when in success state', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    expect(component.renderState()).toBe('success');
    expect(ticketService.listAll).toHaveBeenCalledTimes(1);

    component.onWindowFocus();
    await settle();

    expect(ticketService.listAll).toHaveBeenCalledTimes(2);
  });

  it('window:focus does NOT refetch when in loading state', async () => {
    let resolveFn!: (t: Ticket[]) => void;
    ticketService.listAll.and.returnValue(
      new Promise<Ticket[]>((r) => { resolveFn = r; }),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.renderState()).toBe('loading');
    component.onWindowFocus();
    expect(ticketService.listAll).toHaveBeenCalledTimes(1);

    resolveFn([makeTicket(1)]);
  });

  it('filters the rows by the shared filter state', async () => {
    ticketService.listAll.and.resolveTo([
      makeTicket(1, 'Open', 'Alpha'),
      makeTicket(2, 'Closed', 'Beta'),
    ]);
    await settle();

    component.applyFilters({
      search: '',
      customer: 'all',
      application: 'all',
      priority: 'all',
      assignee: 'all',
      sort: 'newest',
      status: 'Open',
    });

    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].title).toBe('Alpha');
  });

  it('resets to page 1 when a filter changes', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    component.page.set(3);
    component.applyFilters({
      search: 'x',
      customer: 'all',
      application: 'all',
      priority: 'all',
      assignee: 'all',
      sort: 'newest',
      status: 'all',
    });

    expect(component.page()).toBe(1);
  });

  it('changes the page size and returns to page 1', async () => {
    ticketService.listAll.and.resolveTo([makeTicket(1)]);
    await settle();

    component.page.set(2);
    component.onPageSizeChange(25);

    expect(component.pageSize()).toBe(25);
    expect(component.page()).toBe(1);
  });


  // ── Stat strip (WDS-2026) ─────────────────────────────────────
  //
  // The Admin renders the SAME <stat-strip> molecule as the User's
  // dashboard and the Agent's ticket list. The counts are team-wide
  // (GET /api/tickets/stats) because the Admin's scope is every
  // ticket in the system.

  describe('the stat strip', () => {
    /**
     * A team-wide stats envelope shaped like the backend's.
     *
     * The 60-day series is two halves: days 0-29 are the OLDER
     * window (whose sum the backend sends as `previousPeriod`) and
     * days 30-59 are the RECENT one (whose sum the frontend
     * computes for the delta). The default here is 1 per day, so
     * both halves sum to 30 and the delta is 0%. Tests that want a
     * specific delta set the halves accordingly — `previousPeriod`
     * must agree with the first half of the array, exactly as the
     * backend's previousPeriodTotal() computes it.
     */
    function makeStats(overrides: Partial<TicketStats> = {}): TicketStats {
      return {
        counts: {
          total: 30,
          open: 26,
          inProgress: 1,
          resolved: 1,
          closed: 2,
        },
        dailyCreated: new Array(60).fill(1),
        previousPeriod: 30,
        ...overrides,
      };
    }

    it('renders the shared stat strip with the team-wide counts', async () => {
      ticketService.listAll.and.resolveTo([makeTicket(1)]);
      ticketService.stats.and.resolveTo(makeStats());
      await settle();

      const strip = fixture.nativeElement.querySelector('[data-testid="stat-strip"]');
      expect(strip).toBeTruthy();
      // The molecule itself is mounted (not a copy of the markup).
      expect(strip.querySelector('stat-strip')).toBeTruthy();

      // The summary card and the four status cards.
      expect(strip.querySelector('[data-testid="stat-total-card"]')).toBeTruthy();
      for (const accent of ['open', 'inProgress', 'resolved', 'closed']) {
        expect(
          strip.querySelector(`[data-testid="stat-card-${accent}"]`),
        ).toBeTruthy();
      }

      // The Total card carries the reference's label and the team-wide
      // total (30 in the fixture — NOT the User's own count).
      const total = strip.querySelector('[data-testid="stat-total-card"] .value');
      expect(total?.textContent?.trim()).toBe('30');

      // Each status card's number matches the team-wide count.
      const open = strip.querySelector('[data-testid="stat-card-open"] .value');
      expect(open?.textContent?.trim()).toBe('26');
    });

    it('reads the team-wide stats endpoint, not the User-scoped one', async () => {
      ticketService.listAll.and.resolveTo([makeTicket(1)]);
      ticketService.stats.and.resolveTo(makeStats());
      await settle();

      expect(ticketService.stats).toHaveBeenCalledTimes(1);
      // The User-scoped endpoint must NOT be used — the Admin sees
      // every ticket, not just their own.
      expect(
        (ticketService as unknown as { statsMine?: jasmine.Spy }).statsMine,
      ).toBeUndefined();
    });

    it('shows the period-over-period delta on the summary card', async () => {
      ticketService.listAll.and.resolveTo([makeTicket(1)]);
      // The older window (days 0-29) is 1 per day = 30; the recent
      // window (days 30-59) is 2 per day = 60. The delta is
      // (60 - 30) / 30 = +100%.
      const series = [
        ...new Array(30).fill(1),
        ...new Array(30).fill(2),
      ];
      ticketService.stats.and.resolveTo(
        makeStats({ dailyCreated: series, previousPeriod: 30 }),
      );
      await settle();

      const delta = fixture.nativeElement.querySelector(
        '[data-testid="stat-total-card"] .delta',
      );
      expect(delta).toBeTruthy();
      expect(delta.textContent?.trim()).toContain('100%');
      // The caption sits under the pill.
      const caption = fixture.nativeElement.querySelector(
        '[data-testid="stat-total-card"] .caption',
      );
      expect(caption?.textContent?.trim()).toBe('vs last month');
    });

    it('hides the delta pill when there is no previous period to compare', async () => {
      ticketService.listAll.and.resolveTo([makeTicket(1)]);
      ticketService.stats.and.resolveTo(
        makeStats({ previousPeriod: 0 }),
      );
      await settle();

      const delta = fixture.nativeElement.querySelector(
        '[data-testid="stat-total-card"] .delta',
      );
      expect(delta).toBeNull();
    });

    it('omits the strip when the stats call fails, but keeps the table', async () => {
      ticketService.listAll.and.resolveTo([makeTicket(1)]);
      ticketService.stats.and.rejectWith(new Error('stats down'));
      await settle();

      // The strip is optional — a stats failure degrades it away.
      expect(
        fixture.nativeElement.querySelector('[data-testid="stat-strip"]'),
      ).toBeNull();
      // But the table — the real content — still renders.
      expect(component.renderState()).toBe('success');
      expect(fixture.nativeElement.querySelector('[data-testid="ticket-table"]'))
        .toBeTruthy();
    });

    it('keeps the stats when the rows call fails', async () => {
      ticketService.listAll.and.rejectWith(new Error('rows down'));
      ticketService.stats.and.resolveTo(makeStats());
      await settle();

      // The rows failed, so the page shows the error state — but the
      // stats were fetched independently and are still available.
      expect(component.renderState()).toBe('error');
      expect(component.stats()).not.toBeNull();
    });
  });
});

describe('AdminDashboardPageComponent URL hash routing (HD-013 + HD-014)', () => {
  let localTicketService: {
    listAll: jasmine.Spy;
    stats: jasmine.Spy;
  };
  let localUserService: { listAll: jasmine.Spy };
  let localAuthService: {
    userSnapshot: jasmine.Spy;
    user$: Observable<UserPublic | null>;
    refreshUser: jasmine.Spy;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    localTicketService = {
      listAll: jasmine.createSpy('listAll'),
      stats: jasmine.createSpy('stats'),
    };
    localTicketService.listAll.and.resolveTo([]);
    // The stat strip is optional; a rejected stats read degrades it
    // away without touching the tab-routing assertions below.
    localTicketService.stats.and.rejectWith(new Error('no stats stubbed'));
    localUserService = { listAll: jasmine.createSpy('listAll') };
    // Stub listAll() so the embedded UsersTabPageComponent renders
    // its success state synchronously without a real HTTP call.
    localUserService.listAll.and.resolveTo([]);
    // The UsersTabPageComponent wraps content in <app-chrome>, which
    // boots via header-chrome. header-chrome calls
    // `auth.refreshUser()` and reads `auth.user$` via `toSignal()`,
    // so the AuthService stub needs both.
    localAuthService = {
      userSnapshot: jasmine
        .createSpy('userSnapshot')
        .and.returnValue(baseUser),
      user$: new BehaviorSubject<UserPublic | null>(baseUser).asObservable(),
      refreshUser: jasmine
        .createSpy('refreshUser')
        .and.resolveTo(),
    };
    await TestBed.configureTestingModule({
      imports: [AdminDashboardPageComponent],
      providers: [
        provideRouter([
          { path: 'admin', children: [] },
          { path: 'users', children: [] },
        ]),
        provideHttpClient(),
        { provide: TicketService, useValue: localTicketService },
        { provide: UserService, useValue: localUserService },
        { provide: AuthService, useValue: localAuthService },
      ],
    }).compileComponents();
  });

  it('renders the Users tab active + UsersTabPageComponent body when URL hash is #users on initial load', async () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);

    const originalHash = window.location.hash;
    window.location.hash = '#users';
    try {
      const newFixture = TestBed.createComponent(AdminDashboardPageComponent);
      const newComponent = newFixture.componentInstance;
      newFixture.detectChanges();
      await newFixture.whenStable();
      newFixture.detectChanges();

      // URL hash contract: /admin#users stays on /admin, not /users.
      // The component does NOT navigate to /users anymore.
      expect(navigateSpy).not.toHaveBeenCalledWith('/users');

      // The Users tab is active in the template.
      expect(newComponent.activeTab()).toBe('users');

      // The body renders the HD-014 <app-users-tab-page> in-place.
      // The table (the previous tab's content) is not rendered when
      // the Users tab is active.
      const compiled = newFixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="ticket-table"]')).toBeNull();
      // The UsersTabPageComponent renders <section class="users-page">.
      expect(compiled.querySelector('app-users-tab-page .users-page'))
        .toBeTruthy();
      // The UsersTabPageComponent called listAll() exactly once on init.
      expect(localUserService.listAll).toHaveBeenCalledTimes(1);

      // Heading reflects the active tab.
      const h1 = compiled.querySelector('h1');
      expect(h1?.textContent?.trim()).toBe('Users');
    } finally {
      window.location.hash = originalHash;
    }
  });

});
