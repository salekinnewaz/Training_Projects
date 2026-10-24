/**
 * EmployeeDashboardPageComponent — smoke spec (HD-007).
 *
 * Mirrors the forbidden-page pattern: TestBed + mocks for
 * AuthService / TicketService / Router. Covers the four render
 * states (loading → empty / list / error) by stubbing
 * `TicketService.listMine` to return three different shapes.
 *
 *   empty  → `<empty-state>` rendered, no table
 *   list   → 2 rows in the shared `<ticket-table>` rendered
 *   error  → `.error-message` shows SESSION_EXPIRED text AND
 *            router.navigate was called with ['/login'] +
 *            queryParams: { return_to: '/dashboard' }
 *
 * HD-020 adds the stat strip: five cards fed by the user's own
 * counters (`statsMine()`), plus the two degraded paths — a stats
 * failure omits the strip but keeps the list, and a list failure
 * shows the error state even when stats arrived.
 *
 * The page wraps itself in `<app-chrome>` (which contains
 * `<header-chrome>` and `<atom-link>` elements that need a
 * real Router + a `user$` Observable on the AuthService stub).
 * The fix: provide a real Router via `provideRouter([])` and
 * spy on `Router.navigate` for assertions, and provide a
 * `user$` BehaviorSubject on the AuthService stub.
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ApiError } from '../../services/api-error';
import { AuthService } from '../../services/auth.service';
import { TicketService } from '../../services/ticket.service';
import { EmployeeDashboardPageComponent } from './employee-dashboard-page.component';

describe('EmployeeDashboardPageComponent', () => {
  let ticketService: {
    listMine: jasmine.Spy;
    statsMine: jasmine.Spy;
  };
  let router: Router;
  let routerNavigateSpy: jasmine.Spy;

  /** A minimal TicketStats payload — the shape the stat strip
   * consumes. `dailyCreated` is the 60-element series (30-day
   * window × 2, so the month-over-month delta has two halves). */
  const fakeStats = {
    counts: {
      total: 3,
      open: 2,
      inProgress: 1,
      resolved: 0,
      closed: 0,
    },
    dailyCreated: new Array(60).fill(0),
  };

  beforeEach(async () => {
    ticketService = {
      listMine: jasmine.createSpy('listMine'),
      statsMine: jasmine.createSpy('statsMine'),
    };
    // Default: stats resolve successfully. Individual tests
    // override this to exercise the degraded path.
    ticketService.statsMine.and.resolveTo(fakeStats);

    await TestBed.configureTestingModule({
      imports: [EmployeeDashboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: TicketService, useValue: ticketService },
        {
          provide: AuthService,
          useValue: {
            user$: new BehaviorSubject<unknown>(null),
            userSnapshot: () => null,
            roleHomePath: () => '/login',
            refreshUser: () => Promise.resolve(),
            logout: () => Promise.resolve(),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    routerNavigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('renders empty-state when listMine() returns []', async () => {
    ticketService.listMine.and.resolveTo([]);

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('empty-state')).not.toBeNull();
    expect(compiled.querySelectorAll('ticket-row').length).toBe(0);
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('renders two table rows when listMine() returns two tickets', async () => {
    ticketService.listMine.and.resolveTo([
      {
        id: 1,
        number: 'T-000001',
        title: 'A',
        status: 'Open',
        priority: 'High',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 2,
        number: 'T-000002',
        title: 'B',
        status: 'Closed',
        priority: 'Low',
        updatedAt: new Date().toISOString(),
      },
    ]);

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('[data-testid="ticket-table"] tbody tr').length).toBe(2);
    expect(compiled.querySelector('empty-state')).toBeNull();
  });

  it('opens the ticket when a table row is clicked', async () => {
    ticketService.listMine.and.resolveTo([
      {
        id: 42,
        number: 'HD-042',
        title: 'VPN disconnects nightly',
        status: 'Open',
        priority: 'High',
        updatedAt: new Date().toISOString(),
      },
    ]);

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const row = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="ticket-table"] tbody tr',
    ) as HTMLElement;
    expect(row).not.toBeNull();

    row.click();
    fixture.detectChanges();

    expect(routerNavigateSpy).toHaveBeenCalledWith(['/tickets', 42]);
  });

  it('renders a stat strip with the caller\'s own ticket counts (HD-020)', async () => {
    // HD-020 supersedes the original "no summary stats" rule. The
    // counters come from GET /api/tickets/stats/mine, which the
    // backend filters to the caller's own tickets in SQL — so Eli
    // sees her own numbers and never team-wide queue state.
    ticketService.listMine.and.resolveTo([
      {
        id: 1,
        number: 'T-000001',
        title: 'A',
        status: 'Open',
        priority: 'High',
        updatedAt: new Date().toISOString(),
      },
    ]);

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(ticketService.statsMine).toHaveBeenCalled();

    const strip = compiled.querySelector('[data-testid="stat-strip"]');
    expect(strip).not.toBeNull();

    // The strip is one molecule host; the cards live inside it.
    const host = strip?.querySelector('stat-strip');
    expect(host).not.toBeNull();

    // Five cards: one Total summary + four status cards.
    const cards = host?.querySelectorAll('article.card') ?? [];
    expect(cards.length).toBe(5);

    // Labels are in order and the values come from the payload.
    const labels = Array.from(cards).map((c) =>
      c.querySelector('.label')?.textContent?.trim(),
    );
    expect(labels).toEqual([
      'Total Tickets',
      'Open',
      'In Progress',
      'Resolved',
      'Closed',
    ]);

    const values = Array.from(cards).map((c) =>
      c.querySelector('.value')?.textContent?.trim(),
    );
    expect(values).toEqual(['3', '2', '1', '0', '0']);

    // The four status cards carry a progress bar whose fill is the
    // status's share of the total.
    const bars = host?.querySelectorAll('.bar-fill') ?? [];
    expect(bars.length).toBe(4);
    const fills = Array.from(bars).map((b) =>
      parseFloat((b as HTMLElement).style.width),
    );
    // open 2/3, inProgress 1/3, resolved 0, closed 0.
    expect(fills[0]).toBeCloseTo(66.67, 1);
    expect(fills[1]).toBeCloseTo(33.33, 1);
    expect(fills[2]).toBe(0);
    expect(fills[3]).toBe(0);

    // Each status card also carries a sparkline.
    expect(host?.querySelectorAll('atom-sparkline').length).toBe(4);
  });

  it('shows the delta pill and caption on the total card (HD-021)', async () => {
    ticketService.listMine.and.resolveTo([
      {
        id: 1,
        number: 'T-000001',
        title: 'A',
        status: 'Open',
        priority: 'High',
        updatedAt: new Date().toISOString(),
      },
    ]);
    ticketService.statsMine.and.resolveTo({
      ...fakeStats,
      previousPeriod: 2,
    });

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const totalCard = compiled.querySelector('[data-testid="stat-total-card"]');
    expect(totalCard).not.toBeNull();

    // previousPeriod = 2, recent 30 days = 0 created -> -100%.
    const delta = totalCard?.querySelector('.delta');
    expect(delta).not.toBeNull();
    expect(delta?.textContent).toContain('−100%');
    expect(delta?.classList).toContain('is-down');

    expect(totalCard?.querySelector('.caption')?.textContent?.trim()).toBe(
      'vs last month',
    );
  });

  it('hides the delta pill when there is no previous period to compare', async () => {
    // previousPeriod is absent (older backend) or zero — showing a
    // misleading "+100%" is worse than showing nothing.
    ticketService.listMine.and.resolveTo([
      {
        id: 1,
        number: 'T-000001',
        title: 'A',
        status: 'Open',
        priority: 'High',
        updatedAt: new Date().toISOString(),
      },
    ]);

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const totalCard = compiled.querySelector('[data-testid="stat-total-card"]');
    expect(totalCard?.querySelector('.delta')).toBeNull();
    // The caption still renders.
    expect(totalCard?.querySelector('.caption')).not.toBeNull();
  });

  it('shows a positive delta pill with an up arrow', async () => {
    // The mirror of the negative case: recent 30 days = 4 created
    // against a previous window of 2 -> +100%, painted green.
    ticketService.listMine.and.resolveTo([
      {
        id: 1,
        number: 'T-000001',
        title: 'A',
        status: 'Open',
        priority: 'High',
        updatedAt: new Date().toISOString(),
      },
    ]);
    ticketService.statsMine.and.resolveTo({
      ...fakeStats,
      dailyCreated: [
        ...new Array(30).fill(0),
        ...new Array(29).fill(0),
        4,
      ],
      previousPeriod: 2,
    });

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const delta = compiled.querySelector('.delta');
    expect(delta).not.toBeNull();
    expect(delta?.textContent).toContain('100%');
    expect(delta?.classList).toContain('is-up');
    expect(delta?.classList).not.toContain('is-down');

    // The pill carries a solid up-arrow glyph, matching the
    // reference's filled arrow.
    const arrow = delta?.querySelector('svg path');
    expect(arrow).not.toBeNull();
    expect(arrow?.getAttribute('fill')).toBe('currentColor');
    // The up arrow's head sits ABOVE its stem: the path starts at
    // the apex (y 1.8) and the stem runs down to y 14.4.
    expect(arrow?.getAttribute('d')).toContain('M8 1.8');
  });

  it('renders empty progress bars when the caller has no tickets', async () => {
    // total = 0 must not divide by zero; every bar renders empty
    // and the strip still shows all five cards.
    ticketService.listMine.and.resolveTo([]);
    ticketService.statsMine.and.resolveTo({
      counts: { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 },
      dailyCreated: new Array(60).fill(0),
    });

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const host = compiled.querySelector('stat-strip');
    expect(host?.querySelectorAll('article.card').length).toBe(5);

    const fills = Array.from(
      host?.querySelectorAll('.bar-fill') ?? [],
    ) as HTMLElement[];
    expect(fills.length).toBe(4);
    for (const fill of fills) {
      expect(parseFloat(fill.style.width)).toBe(0);
    }
  });

  it('omits the stat strip but still renders the list when statsMine() fails', async () => {
    // The strip is supplementary — a stats-endpoint failure must
    // not blank the ticket list below it.
    ticketService.statsMine.and.rejectWith(
      new ApiError(500, 'internal_server_error', 'stats exploded'),
    );
    ticketService.listMine.and.resolveTo([
      {
        id: 1,
        number: 'T-000001',
        title: 'A',
        status: 'Open',
        priority: 'High',
        updatedAt: new Date().toISOString(),
      },
    ]);

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-testid="stat-strip"]')).toBeNull();
    // The list still renders.
    expect(compiled.querySelectorAll('[data-testid="ticket-table"] tbody tr').length).toBe(1);
    expect(compiled.querySelector('.error-message')).toBeNull();
  });

  it('still renders the list when listMine() fails but statsMine() succeeds', async () => {
    // The inverse degradation: stats arrive, the list does not.
    // The list's error state wins because the list is the page's
    // primary content.
    ticketService.listMine.and.rejectWith(
      new ApiError(500, 'internal_server_error', 'list exploded'),
    );

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.error-message')).not.toBeNull();
  });

  it('shows SESSION_EXPIRED error and navigates to /login when listMine() throws a 401 ApiError', async () => {
    ticketService.listMine.and.rejectWith(
      new ApiError(401, 'unauthenticated', 'Authentication required.'),
    );

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    // Drain the setTimeout(..., 0) so the redirect actually fires.
    await new Promise((resolve) => setTimeout(resolve, 5));
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const errorEl = compiled.querySelector('.error-message');
    expect(errorEl?.textContent).toContain('Your session expired');

    expect(routerNavigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { return_to: '/dashboard' },
    });
  });
});
