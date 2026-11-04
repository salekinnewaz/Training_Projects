/**
 * AdminDashboardPageComponent — WDS-2026 Admin Workspace.
 *
 * Verifies the /admin workspace dashboard, which renders SIX
 * widgets from ONE endpoint (GET /api/admin/workspace):
 *
 *   hero · stat strip · Recent Tickets · Users Overview
 *        · Ticket Trends · Priority Distribution · Recent Users
 *
 * Coverage:
 *   - The render-state switch: the loading skeleton, the error
 *     card and its Retry button, and the workspace itself.
 *   - The summary counters that feed the hero and the stat strip,
 *     including the period-over-period delta.
 *   - The Recent Tickets table (its five columns and its rows).
 *   - The Users Overview donut's slices and its legend rows.
 *   - The Priority Distribution donut's slices and its legend rows.
 *   - The Ticket Trends chart's stacked bars and its legend.
 *   - The Recent Users list: its role labels, its avatar palette
 *     and its relative timestamps.
 *   - The 401 no-error rule (the auth guard owns the redirect).
 *
 * The legacy two-tab layout (Tickets / Users) is gone — the
 * sidebar carries that navigation now.
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { computed, signal } from '@angular/core';

import { AdminDashboardPageComponent } from './admin-dashboard-page.component';
import {
  TicketService,
  type AdminWorkspaceBundle,
  type TrendBucket,
} from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { NotificationsService } from '../../services/notifications.service';
import { ApiError } from '../../services/api-error';
import type { Ticket } from '../../models/ticket';
import type { UserPublic } from '../../models/user';

/**
 * A stand-in for the real NotificationsService.
 *
 * The shared chrome's bell reads `hasUnread()`, `items()`, `loading()`
 * and `error()` off it, and lazily starts polling on first click, so
 * the stub has to carry that whole surface — a partial stub throws
 * while the chrome is being constructed, which would fail every
 * test in the suite for a reason that has nothing to do with the
 * workspace itself.
 */
function makeNotificationsStub(): unknown {
  const unread = signal(0);
  const panelOpen = signal(false);
  const items = signal<unknown[]>([]);
  const loading = signal(false);
  return {
    hasUnread: computed(() => unread() > 0),
    unreadCount: unread.asReadonly(),
    items: items.asReadonly(),
    loading: loading.asReadonly(),
    error: signal<string | null>(null).asReadonly(),
    panelOpen,
    togglePanel: jasmine.createSpy('togglePanel').and.callFake(async () => {
      panelOpen.update((v: boolean) => !v);
    }),
    closePanel: jasmine.createSpy('closePanel').and.callFake(() => {
      panelOpen.set(false);
    }),
    markRead: jasmine.createSpy('markRead').and.resolveTo(),
    markAllRead: jasmine.createSpy('markAllRead').and.resolveTo(),
    startPolling: jasmine.createSpy('startPolling').and.callFake(() => {}),
  };
}

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

function makeTrend(date: string, overrides: Partial<TrendBucket> = {}): TrendBucket {
  return {
    date,
    open: 3,
    inProgress: 2,
    resolved: 4,
    closed: 1,
    ...overrides,
  };
}

function makeBundle(): AdminWorkspaceBundle {
  return {
    summary: {
      totalTickets: 156,
      recentTickets: 20,
      previousTickets: 10,
      totalUsers: 8,
      newUsersThisWeek: 2,
      counts: {
        total: 156,
        open: 40,
        inProgress: 32,
        resolved: 50,
        closed: 34,
      },
    },
    recentTickets: [
      makeTicket(1, 'Open', 'Printer offline'),
      makeTicket(2, 'In Progress', 'VPN drops'),
    ],
    usersOverview: {
      total: 8,
      active: 6,
      inactive: 2,
      byRole: { admins: 2, supportAgents: 4, employees: 2 },
    },
    priorities: [
      { priority: 'High', count: 30 },
      { priority: 'Medium', count: 60 },
      { priority: 'Low', count: 50 },
      { priority: 'None', count: 16 },
    ],
    trends: [
      makeTrend('2026-10-01'),
      makeTrend('2026-10-02'),
      makeTrend('2026-10-03'),
    ],
    recentUsers: [
      {
        id: 1,
        displayName: 'Zara Mensah',
        email: 'zara@example.com',
        role: 'User',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
      {
        id: 2,
        displayName: 'Ken Adeyemi',
        email: 'ken@example.com',
        role: 'Support Agent',
        isActive: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: null,
      },
    ],
  };
}

describe('AdminDashboardPageComponent (WDS-2026 Admin Workspace)', () => {
  let fixture: ComponentFixture<AdminDashboardPageComponent>;
  let component: AdminDashboardPageComponent;
  let ticketService: { workspace: jasmine.Spy };
  let router: Router;

  beforeEach(async () => {
    ticketService = {
      workspace: jasmine
        .createSpy('workspace')
        .and.resolveTo(makeBundle()),
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardPageComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: TicketService, useValue: ticketService },
        {
          provide: AuthService,
          useValue: {
            userSnapshot: () => baseUser,
            // The shared `<app-chrome>` renders `<header-chrome>`,
            // which subscribes to `user$` through `toSignal`. A stub
            // without it throws "Cannot read properties of undefined
            // (reading 'subscribe')" while the chrome is being
            // constructed — before any assertion in this suite runs.
            user$: new BehaviorSubject<UserPublic | null>(baseUser),
          },
        },
        // The chrome's bell reads the notifications service, so the
        // stub has to carry the same shape the real service exposes.
        { provide: NotificationsService, useValue: makeNotificationsStub() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  // ── Render states ──────────────────────────────────────────────

  it('shows the skeleton while the bundle is in flight', async () => {
    ticketService.workspace.and.returnValue(new Promise(() => {}));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-testid="admin-workspace-skeleton"]'),
    ).toBeTruthy();
  });

  it('renders the workspace once the bundle resolves', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('success');
    expect(
      fixture.nativeElement.querySelector('[data-testid="admin-stat-strip"]'),
    ).toBeTruthy();
  });

  it('shows an error card and a Retry button when the load fails', async () => {
    ticketService.workspace.and.rejectWith(new ApiError(500, 'internal_server_error', 'boom'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('error');
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain("Couldn't load the workspace");

    const retry = fixture.nativeElement.querySelector(
      '[role="alert"] atom-button button',
    );
    expect(retry).toBeTruthy();
  });

  it('re-fetches the bundle when Retry is pressed', async () => {
    ticketService.workspace.and.rejectWith(new ApiError(500, 'internal_server_error', 'boom'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    ticketService.workspace.and.resolveTo(makeBundle());
    const retry = fixture.nativeElement.querySelector(
      '[role="alert"] atom-button button',
    ) as HTMLButtonElement;
    retry.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(ticketService.workspace).toHaveBeenCalledTimes(2);
    expect(component.renderState()).toBe('success');
  });

  it('does not render the error card on a 401 — the auth guard redirects', async () => {
    ticketService.workspace.and.rejectWith(new ApiError(401, 'unauthenticated', 'expired'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).not.toBe('error');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  // ── Summary counters ───────────────────────────────────────────

  it('derives the summary counters from the bundle', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.totalTickets()).toBe(156);
    expect(component.totalUsers()).toBe(8);
    expect(component.newUsersThisWeek()).toBe(2);
    expect(component.trendsDays()).toBe(3);
  });

  it('computes the period-over-period ticket delta', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // (20 - 10) / 10 = +100%
    expect(component.ticketDelta()).toBe(100);
    expect(component.deltaLabel()).toBe('100%');
  });

  it('hides the delta when there is no previous period to compare against', async () => {
    const bundle = makeBundle();
    bundle.summary.previousTickets = 0;
    ticketService.workspace.and.resolveTo(bundle);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.ticketDelta()).toBeNull();
    expect(component.deltaLabel()).toBe('');
  });

  it('builds one stat-strip entry per status bucket, each with a sparkline series', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const items = component.statusItems();
    expect(items.length).toBe(4);
    expect(items.map((i) => i.label)).toEqual([
      'Open',
      'In Progress',
      'Resolved',
      'Closed',
    ]);
    expect(items[0].value).toBe(40);
    expect(items[0].series).toEqual([3, 3, 3]);
  });

  // ── Recent Tickets ─────────────────────────────────────────────

  it('renders the Recent Tickets table with one row per ticket', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll(
      '[data-testid="admin-recent-tickets"] tbody tr',
    );
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Printer offline');
    expect(rows[0].textContent).toContain('HD-001');
  });

  it('navigates to the ticket when a row is clicked', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const spy = spyOn(router, 'navigate').and.resolveTo(true);
    const row = fixture.nativeElement.querySelector(
      '[data-testid="admin-recent-tickets"] tbody tr',
    ) as HTMLElement;
    row.click();

    expect(spy).toHaveBeenCalledWith(['/tickets', 1]);
  });

  // ── Users Overview ─────────────────────────────────────────────

  it('builds the Users Overview donut slices and legend rows', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const slices = component.userSlices();
    expect(slices.length).toBe(2);
    expect(slices[0]).toEqual(
      jasmine.objectContaining({ key: 'active', value: 6 }),
    );

    const legend = component.userLegend();
    expect(legend.map((l) => l.label)).toEqual(['Active', 'Inactive']);
    expect(legend[0].value).toBe(6);
    expect(legend[0].pct).toBe('75.0%');
  });

  // ── Priority Distribution ──────────────────────────────────────

  it('builds the Priority Distribution slices and legend rows', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const slices = component.prioritySlices();
    expect(slices.length).toBe(4);
    expect(slices[0]).toEqual(
      jasmine.objectContaining({ key: 'High', value: 30 }),
    );

    const legend = component.priorityLegend();
    expect(legend.map((l) => l.label)).toEqual([
      'High',
      'Medium',
      'Low',
      'None',
    ]);
    // 30 of 156 tickets.
    expect(legend[0].pct).toBe('19%');
  });

  // ── Ticket Trends ──────────────────────────────────────────────

  it('builds one stacked bar per trend bucket with four segments', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const bars = component.trendBars();
    expect(bars.length).toBe(3);
    expect(bars[0].key).toBe('Oct 1');
    expect(bars[0].segments.map((s) => s.key)).toEqual([
      'open',
      'inProgress',
      'resolved',
      'closed',
    ]);
    expect(bars[0].segments[0].value).toBe(3);
  });

  it('builds the trends chart legend', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.trendLegend().map((l) => l.label)).toEqual([
      'Open',
      'In Progress',
      'Resolved',
      'Closed',
    ]);
  });

  // ── Recent Users ───────────────────────────────────────────────

  it('renders the Recent Users rows with their role labels', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll(
      '[data-testid="admin-recent-users"] .ru-row',
    );
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Zara Mensah');
    expect(rows[0].textContent).toContain('Employee');
    expect(rows[1].textContent).toContain('Support Agent');
  });

  it('maps the `User` role to the `Employee` label', () => {
    expect((component as unknown as { roleLabel(r: string): string }).roleLabel('User')).toBe('Employee');
    expect((component as unknown as { roleLabel(r: string): string }).roleLabel('Support Agent')).toBe('Support Agent');
    expect((component as unknown as { roleLabel(r: string): string }).roleLabel('Admin')).toBe('Admin');
  });

  it('cycles the avatar palette so each row gets a pastel disc', () => {
    expect((component as unknown as { avatarBg(i: number): string }).avatarBg(0)).toBe('#C9D6FE');
    expect((component as unknown as { avatarFg(i: number): string }).avatarFg(0)).toBe('#2303EE');
    expect((component as unknown as { avatarBg(i: number): string }).avatarBg(1)).toBe('#FBD3DE');
    expect((component as unknown as { avatarFg(i: number): string }).avatarFg(1)).toBe('#F70B34');
    // The palette wraps after five rows.
    expect((component as unknown as { avatarBg(i: number): string }).avatarBg(5)).toBe('#C9D6FE');
    expect((component as unknown as { avatarFg(i: number): string }).avatarFg(5)).toBe('#2303EE');
  });

  it('formats the relative timestamp', () => {
    const minutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect((component as unknown as { relativeTime(iso: string): string }).relativeTime(minutesAgo)).toBe('5m ago');

    const hoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect((component as unknown as { relativeTime(iso: string): string }).relativeTime(hoursAgo)).toBe('3h ago');

    const daysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect((component as unknown as { relativeTime(iso: string): string }).relativeTime(daysAgo)).toBe('2d ago');
  });

  it('marks an inactive user with the offline dot', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll(
      '[data-testid="admin-recent-users"] .ru-row',
    );
    const dots = rows[0].querySelectorAll('.ru-dot');
    expect(dots.length).toBe(1);
    expect(dots[0].classList.contains('is-offline')).toBe(false);
    expect(
      rows[1].querySelector('.ru-dot')?.classList.contains('is-offline'),
    ).toBe(true);
  });

  // ── Window focus ───────────────────────────────────────────────

  it('re-fetches the bundle when the window regains focus', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(ticketService.workspace).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('focus'));
    await fixture.whenStable();

    expect(ticketService.workspace).toHaveBeenCalledTimes(2);
  });
});
