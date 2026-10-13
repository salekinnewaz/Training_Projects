/**
 * AdminDashboardPageComponent — HD-013.
 *
 * Verifies the Admin Dashboard tab:
 *   - 200 happy path: 4 cards rendered (Open / In Progress / Resolved /
 *     Closed) with the correct counts and rows.
 *   - Closed card is muted and rows do NOT navigate (no routerLink
 *     on the row markup).
 *   - Open / In Progress / Resolved rows navigate via routerLink to
 *     /tickets/:id.
 *   - Card footer "Showing N of M" renders only when total > rows.length.
 *   - Empty status: zero-row bucket renders "Nothing here." marker.
 *   - Loading state: 4 card skeletons render before the data arrives.
 *   - Server error (5xx): inline error message + Retry button.
 *   - 401 redirects (auth interceptor is the gate; we don't assert
 *     the navigation, just that the page doesn't render an error).
 *   - URL hash #users routes to /users (HD-014 placeholder).
 *   - formatRelative: produces "just now" / "Xm ago" / "Xh ago" /
 *     "Xd ago" / "Xmo ago" / "Xy ago".
 *   - linkHref: returns `/tickets/<id>`.
 *   - Window focus refetches when the page is in success state.
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { BehaviorSubject, type Observable } from 'rxjs';

import { AdminDashboardPageComponent } from './admin-dashboard-page.component';
import { TicketService } from '../../services/ticket.service';
import type { AdminDashboardSummary } from '../../services/ticket.service';
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
  status: Ticket['status'],
  title = `Ticket ${id}`,
  daysAgo = 1,
): Ticket {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    id,
    number: `HD-${String(id).padStart(3, '0')}`,
    title,
    description: 'desc',
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

function makeSummary(overrides: Partial<AdminDashboardSummary> = {}): AdminDashboardSummary {
  return {
    open: { rows: [makeTicket(1, 'Open'), makeTicket(2, 'Open')], total: 11 },
    inProgress: { rows: [makeTicket(3, 'In Progress')], total: 5 },
    resolved: { rows: [makeTicket(4, 'Resolved')], total: 4 },
    closed: { rows: [makeTicket(5, 'Closed')], total: 3 },
    ...overrides,
  };
}

describe('AdminDashboardPageComponent (HD-013)', () => {
  let fixture: ComponentFixture<AdminDashboardPageComponent>;
  let component: AdminDashboardPageComponent;
  let ticketService: { adminDashboard: jasmine.Spy };

  beforeEach(async () => {
    ticketService = { adminDashboard: jasmine.createSpy('adminDashboard') };

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

  it('renders 4 status badges in success state (Open / In Progress / Resolved / Closed)', async () => {
    ticketService.adminDashboard.and.resolveTo(makeSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('success');
    const badges = fixture.nativeElement.querySelectorAll('.card .pill-zone badge-status');
    expect(badges.length).toBe(4);
  });

  it('shows the right counts in each card top zone (count = bucket.total, not rows.length)', async () => {
    // Per wireframe admin-dashboard.md §"Card top zone" the count
    // badge is the bucket total (e.g. "11" for Open even though the
    // card body only renders 2 rows + the "Showing 2 of 11" footer).
    // Regressions to rows.length have been the silent failure mode
    // here — pinning to the totals keeps the wireframe-anchored
    // contract honest.
    ticketService.adminDashboard.and.resolveTo(makeSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.card-row .card');
    expect(cards.length).toBe(4);

    const counts = Array.from(cards).map(
      (card) => (card as HTMLElement).querySelector('.count')?.textContent?.trim(),
    );
    expect(counts).toEqual(['11', '5', '4', '3']);
  });

  it('renders Closed card with the muted class and no routerLink on Closed rows', async () => {
    ticketService.adminDashboard.and.resolveTo(makeSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const closedCard = fixture.nativeElement.querySelectorAll('.card-row .card')[3];
    expect(closedCard.classList.contains('muted')).toBe(true);

    // Closed card's body should NOT contain any `<a class="admin-card-row">` (no
    // clickable navigation); it uses muted <li> rows instead.
    const closedRows = closedCard.querySelectorAll('a.admin-card-row');
    expect(closedRows.length).toBe(0);
    const closedMutedRows = closedCard.querySelectorAll('.is-muted');
    expect(closedMutedRows.length).toBeGreaterThan(0);
  });

  it('renders Open rows with routerLink to /tickets/<id>', async () => {
    ticketService.adminDashboard.and.resolveTo(makeSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const openCard = fixture.nativeElement.querySelectorAll('.card-row .card')[0];
    const openRows = openCard.querySelectorAll('a.admin-card-row');
    expect(openRows.length).toBeGreaterThan(0);
    const href = openRows[0].getAttribute('href');
    // RouterTestingModule strips the leading slash in some versions;
    // accept either with or without leading slash.
    expect(href === '/tickets/1' || href === 'tickets/1').toBe(true);
  });

  it('renders "Showing N of M" footer when total exceeds rendered rows', async () => {
    // Open has 2 rows but total 11 → footer renders.
    ticketService.adminDashboard.and.resolveTo(makeSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.card-row .card');
    const openFooter = cards[0].querySelector('.admin-card-footer');
    expect(openFooter).toBeTruthy();
    expect(openFooter.textContent.trim()).toBe('Showing 2 of 11');
  });

  it('hides the "Showing N of M" footer when total === rows.length', async () => {
    ticketService.adminDashboard.and.resolveTo(
      makeSummary({
        open: { rows: [makeTicket(1, 'Open')], total: 1 },
        inProgress: { rows: [], total: 0 },
        resolved: { rows: [], total: 0 },
        closed: { rows: [], total: 0 },
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.card-row .card');
    // Open: 1 row, total 1 → no footer.
    const openFooter = cards[0].querySelector('.admin-card-footer');
    expect(openFooter).toBeNull();
    // In Progress: 0 rows, total 0 → no footer.
    const ipFooter = cards[1].querySelector('.admin-card-footer');
    expect(ipFooter).toBeNull();
  });

  it('renders the empty-state marker when a bucket has zero rows', async () => {
    ticketService.adminDashboard.and.resolveTo(
      makeSummary({
        open: { rows: [], total: 0 },
        inProgress: { rows: [], total: 0 },
        resolved: { rows: [], total: 0 },
        closed: { rows: [], total: 0 },
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const emptyMarkers = fixture.nativeElement.querySelectorAll('.empty-marker');
    expect(emptyMarkers.length).toBe(4);
    expect(emptyMarkers[0].textContent.trim()).toBe('Nothing here.');
  });

  it('renders 4 card skeletons during the loading state', async () => {
    // Never resolve — leave the component in loading state.
    let resolveFn!: (s: AdminDashboardSummary) => void;
    ticketService.adminDashboard.and.returnValue(
      new Promise<AdminDashboardSummary>((r) => { resolveFn = r; }),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.renderState()).toBe('loading');
    const skeletons = fixture.nativeElement.querySelectorAll('.card-row .card-skel');
    expect(skeletons.length).toBe(4);

    // Resolve to clean up the pending promise.
    resolveFn(makeSummary());
  });

  it('shows inline error + Retry button on server error', async () => {
    ticketService.adminDashboard.and.rejectWith(
      new ApiError(500, 'internal_server_error', 'boom'),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('error');
    const errorCard = fixture.nativeElement.querySelector('.admin-error-card');
    expect(errorCard).toBeTruthy();
    const errorMsg = errorCard.querySelector('.error-message');
    expect(errorMsg.textContent.trim()).toBe(
      "Couldn't load the queue. Refresh to try again.",
    );
    const retryBtn = errorCard.querySelector('atom-button');
    expect(retryBtn).toBeTruthy();
  });

  it('does not show the error card on a 401 (auth interceptor redirects)', async () => {
    ticketService.adminDashboard.and.rejectWith(
      new ApiError(401, 'unauthenticated', 'expired'),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).not.toBe('error');
  });

  it('Retry button refetches the dashboard', async () => {
    let callCount = 0;
    ticketService.adminDashboard.and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new ApiError(500, 'internal_server_error', 'boom'));
      }
      return Promise.resolve(makeSummary());
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.renderState()).toBe('error');

    component.onRefresh();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('success');
    expect(ticketService.adminDashboard).toHaveBeenCalledTimes(2);
  });

  it('reactive heading reflects the active tab on initial load (Dashboard)', async () => {
    ticketService.adminDashboard.and.resolveTo(makeSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Dashboard');
  });

  it('renders the tablist with role="tablist" and two role="tab" anchors', async () => {
    ticketService.adminDashboard.and.resolveTo(makeSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const tablist = compiled.querySelector('.tabs[role="tablist"]');
    expect(tablist).toBeTruthy();
    const tabs = compiled.querySelectorAll('.tab[role="tab"]');
    expect(tabs.length).toBe(2);
  });

  it('marks the active tab with aria-selected="true" and the inactive with aria-selected="false"', async () => {
    ticketService.adminDashboard.and.resolveTo(makeSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.tab[role="tab"]') as NodeListOf<HTMLAnchorElement>;
    const dashboardTab = Array.from(tabs).find((t) => t.textContent?.trim() === 'Dashboard')!;
    const usersTab = Array.from(tabs).find((t) => t.textContent?.trim() === 'Users')!;
    expect(dashboardTab.getAttribute('aria-selected')).toBe('true');
    expect(usersTab.getAttribute('aria-selected')).toBe('false');
  });

  describe('formatRelative', () => {
    it('produces "just now" for < 60 seconds', () => {
      const iso = new Date(Date.now() - 5_000).toISOString();
      expect(component.formatRelative(iso)).toBe('just now');
    });
    it('produces "Xm ago" for minutes', () => {
      const iso = new Date(Date.now() - 5 * 60_000).toISOString();
      expect(component.formatRelative(iso)).toBe('5m ago');
    });
    it('produces "Xh ago" for hours', () => {
      const iso = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
      expect(component.formatRelative(iso)).toBe('3h ago');
    });
    it('produces "Xd ago" for days', () => {
      const iso = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
      expect(component.formatRelative(iso)).toBe('2d ago');
    });
    it('produces "Xmo ago" for months', () => {
      const iso = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
      expect(component.formatRelative(iso)).toBe('1mo ago');
    });
    it('produces "Xy ago" for years', () => {
      const iso = new Date(Date.now() - 400 * 24 * 60 * 60_000).toISOString();
      expect(component.formatRelative(iso)).toBe('1y ago');
    });
    it('returns empty string on NaN', () => {
      expect(component.formatRelative('not-a-date')).toBe('');
    });
  });

  it('linkHref returns /tickets/<id>', () => {
    expect(component.linkHref(42)).toBe('/tickets/42');
  });

  it('window:focus refetches when in success state', async () => {
    ticketService.adminDashboard.and.resolveTo(makeSummary());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('success');
    expect(ticketService.adminDashboard).toHaveBeenCalledTimes(1);

    component.onWindowFocus();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(ticketService.adminDashboard).toHaveBeenCalledTimes(2);
  });

  it('window:focus does NOT refetch when in loading state', async () => {
    let resolveFn!: (s: AdminDashboardSummary) => void;
    ticketService.adminDashboard.and.returnValue(
      new Promise<AdminDashboardSummary>((r) => { resolveFn = r; }),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.renderState()).toBe('loading');
    component.onWindowFocus();
    expect(ticketService.adminDashboard).toHaveBeenCalledTimes(1);

    resolveFn(makeSummary());
  });

  it('buckets computed signal reshapes the summary into the 4-bucket template input', () => {
    const summary = makeSummary();
    component['summary'].set(summary);
    const buckets = component.buckets();
    expect(buckets.length).toBe(4);
    expect(buckets[0].key).toBe('Open');
    expect(buckets[1].key).toBe('In Progress');
    expect(buckets[2].key).toBe('Resolved');
    expect(buckets[3].key).toBe('Closed');
    expect(buckets[0].status).toBe('Open');
    expect(buckets[0].rows.length).toBe(2);
    expect(buckets[0].total).toBe(11);
  });

  it('buckets returns empty array when summary is null', () => {
    // Default state — summary not yet set.
    expect(component.buckets()).toEqual([]);
  });
});

describe('AdminDashboardPageComponent URL hash routing (HD-013 + HD-014)', () => {
  let localTicketService: { adminDashboard: jasmine.Spy };
  let localUserService: { listAll: jasmine.Spy };
  let localAuthService: {
    userSnapshot: jasmine.Spy;
    user$: Observable<UserPublic | null>;
    refreshUser: jasmine.Spy;
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    localTicketService = { adminDashboard: jasmine.createSpy('adminDashboard') };
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
      // The Dashboard cards (the previous tab's content) are not
      // rendered when the Users tab is active.
      const compiled = newFixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.users-placeholder')).toBeNull();
      expect(compiled.querySelectorAll('.card-row .card').length).toBe(0);
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
