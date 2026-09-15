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
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ApiError } from '../../services/api-error';
import { AuthService } from '../../services/auth.service';
import { TicketService } from '../../services/ticket.service';
import { EmployeeDashboardPageComponent } from './employee-dashboard-page.component';

describe('EmployeeDashboardPageComponent', () => {
  let ticketService: { listMine: jasmine.Spy };
  let router: { navigate: jasmine.Spy };

  beforeEach(async () => {
    ticketService = { listMine: jasmine.createSpy('listMine') };
    router = { navigate: jasmine.createSpy('navigate') };

    await TestBed.configureTestingModule({
      imports: [EmployeeDashboardPageComponent],
      providers: [
        provideRouter([]),
        { provide: TicketService, useValue: ticketService },
        {
          provide: AuthService,
          useValue: {
            userSnapshot: () => null,
            roleHomePath: () => '/login',
          },
        },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
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
    expect(router.navigate).not.toHaveBeenCalled();
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

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { return_to: '/dashboard' },
    });
  });
});
