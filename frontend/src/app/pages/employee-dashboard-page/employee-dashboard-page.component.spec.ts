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

  it('does NOT render a stat strip (wireframe-forbidden summary stats)', async () => {
    // Wireframe §"Content & Actions" #6: "No summary stats
    // ('3 open, 1 closed') — those would imply team-wide
    // visibility." Eli sees her own tickets; counts of how
    // many are in each status are noise.
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
        status: 'In Progress',
        priority: 'Medium',
        updatedAt: new Date().toISOString(),
      },
    ]);

    const fixture = TestBed.createComponent(EmployeeDashboardPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[data-testid="stat-strip"]')).toBeNull();
    expect(compiled.querySelectorAll('[data-testid^="stat-card-"]').length).toBe(0);
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
