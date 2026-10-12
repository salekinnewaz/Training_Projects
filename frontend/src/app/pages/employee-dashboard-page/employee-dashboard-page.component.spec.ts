/**
 * EmployeeDashboardPageComponent — smoke spec (HD-007).
 *
 * Mirrors the forbidden-page pattern: TestBed + mocks for
 * AuthService / TicketService / Router. Covers the four render
 * states (loading → empty / list / error) by stubbing
 * `TicketService.listMine` to return three different shapes.
 *
 *   empty  → `<empty-state>` rendered, no `<ticket-row>`
 *   list   → 2 × `<ticket-row>` rendered
 *   error  → `.error-message` shows SESSION_EXPIRED text AND
 *            router.navigate was called with ['/login'] +
 *            queryParams: { return_to: '/dashboard' }
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
  let ticketService: { listMine: jasmine.Spy };
  let router: Router;
  let routerNavigateSpy: jasmine.Spy;

  beforeEach(async () => {
    ticketService = { listMine: jasmine.createSpy('listMine') };

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

  it('renders two ticket-rows when listMine() returns two tickets', async () => {
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

    expect(compiled.querySelectorAll('ticket-row').length).toBe(2);
    expect(compiled.querySelector('empty-state')).toBeNull();
  });

  it('renders the 4-card stat strip with per-status counts on list state', async () => {
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
        status: 'Open',
        priority: 'High',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 3,
        number: 'T-000003',
        title: 'C',
        status: 'In Progress',
        priority: 'Medium',
        updatedAt: new Date().toISOString(),
      },
      {
        id: 4,
        number: 'T-000004',
        title: 'D',
        status: 'Resolved',
        priority: 'Low',
        updatedAt: new Date().toISOString(),
      },
    ]);

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const strip = compiled.querySelector('[data-testid="stat-strip"]');
    expect(strip).not.toBeNull();

    const openCard = compiled.querySelector('[data-testid="stat-card-Open"]');
    expect(openCard?.textContent).toContain('2');

    const inProgressCard = compiled.querySelector(
      '[data-testid="stat-card-In Progress"]',
    );
    expect(inProgressCard?.textContent).toContain('1');

    const resolvedCard = compiled.querySelector(
      '[data-testid="stat-card-Resolved"]',
    );
    expect(resolvedCard?.textContent).toContain('1');

    const closedCard = compiled.querySelector('[data-testid="stat-card-Closed"]');
    expect(closedCard?.textContent).toContain('0');
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
