/**
 * UsersTabPageComponent — HD-014.
 *
 * Verifies the Admin Users tab:
 *   - 200 happy path: heading "Users", active-count micro-label,
 *     5 user-rows rendered from listAll().
 *   - alphabetical order: the page does NOT sort; the backend
 *     returns the rows pre-sorted. We assert the iteration
 *     matches the listAll() response order.
 *   - self-row: when currentUser.id === row.user.id, the row is
 *     styled as self (3px left border), controls are disabled,
 *     micro-label visible.
 *   - role dropdown change:
 *     - non-demotion: calls userService.updateRole immediately.
 *     - Admin-demote: opens dialog, confirm calls updateRole,
 *       cancel reverts.
 *   - status toggle:
 *     - non-Admin target: calls userService.updateActive
 *       immediately.
 *     - Admin target → inactive: opens dialog, confirm calls
 *       updateActive, cancel reverts.
 *   - render states: loading skeleton, server error + Retry,
 *     401 silent (auth interceptor redirects).
 *   - formatRelative: "just now" / "Xm ago" / "Xh ago" / "Xd
 *     ago" / "Xmo ago" / "Xy ago" / "" (NaN) / null → null.
 *   - window:focus refetches when in success state.
 *   - action error: 5xx from updateRole / updateActive reverts
 *     the local signal and shows the row error.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { BehaviorSubject, type Observable } from 'rxjs';

import { UsersTabPageComponent } from './users-tab-page.component';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ApiError } from '../../services/api-error';
import type { UserPublic } from '../../models/user';

const baseUser = (
  id: number,
  overrides: Partial<UserPublic> = {},
): UserPublic => ({
  id,
  email: `user${id}@example.com`,
  displayName: `User ${id}`,
  role: 'User',
  isActive: true,
  lastActiveAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  ...overrides,
});

const admin: UserPublic = baseUser(1, {
  email: 'admin@example.com',
  displayName: 'Avery',
  role: 'Admin',
});

function makeUserList(): UserPublic[] {
  return [
    admin,
    baseUser(2, { displayName: 'Eli Chen', role: 'User', ticketCount: 3 }),
    baseUser(3, {
      displayName: 'Jordan',
      role: 'Support Agent',
      ticketCount: 34,
    }),
    baseUser(4, {
      displayName: 'Morgan',
      role: 'User',
      isActive: false,
      ticketCount: 2,
    }),
    // Sam Patel is a second Admin so the Admin-demote / Admin-
    // deactivate flows have a real target that isn't the viewer.
    baseUser(5, {
      displayName: 'Sam Patel',
      role: 'Admin',
      ticketCount: 8,
    }),
  ];
}

describe('UsersTabPageComponent (HD-014)', () => {
  let fixture: ComponentFixture<UsersTabPageComponent>;
  let component: UsersTabPageComponent;
  let userService: {
    listAll: jasmine.Spy;
    updateRole: jasmine.Spy;
    updateActive: jasmine.Spy;
  };
  let authService: {
      userSnapshot: jasmine.Spy;
      user$: Observable<UserPublic | null>;
      refreshUser: jasmine.Spy;
    };

  beforeEach(async () => {
    userService = {
      listAll: jasmine.createSpy('listAll'),
      updateRole: jasmine.createSpy('updateRole'),
      updateActive: jasmine.createSpy('updateActive'),
    };
    // Minimal AuthService stub: enough to keep `<app-chrome>` +
    // `header-chrome` running in tests. The page reads `userSnapshot()`
    // synchronously for self-row detection; `user$` is consumed by
    // `header-chrome` via `toSignal`; `refreshUser()` is a no-op so
    // the chrome's bootstrap call doesn't fail.
    const userSubject = new BehaviorSubject<UserPublic | null>(admin);
    authService = {
      userSnapshot: jasmine
        .createSpy('userSnapshot')
        .and.returnValue(admin),
      user$: userSubject.asObservable(),
      refreshUser: jasmine
        .createSpy('refreshUser')
        .and.resolveTo(),
    };

    await TestBed.configureTestingModule({
      imports: [UsersTabPageComponent],
      providers: [
        provideRouter([
          { path: 'admin', children: [] },
          { path: 'users', children: [] },
        ]),
        provideHttpClient(),
        { provide: UserService, useValue: userService },
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersTabPageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // The dialog-modal ports its scrim + modal children to
    // document.body. Wipe body so the next suite (e.g. dialog-modal
    // or header-chrome) doesn't pick up a foreign modal here.
    document.body.innerHTML = '';
  });

  it('renders the stat summary + 5 rows in success state', async () => {
    const list = makeUserList();
    userService.listAll.and.resolveTo(list);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('success');

    const compiled = fixture.nativeElement as HTMLElement;

    // The list component is CONTENT-ONLY. It does NOT render an
    // <h1> — the host owns the heading (the shell for /users, the
    // Admin dashboard for the /admin#users tab). Rendering one
    // here produced two "Users" headings on the Admin tab.
    expect(compiled.querySelector('h1')).toBeNull();
    // Nor does it render its own app chrome (which would double
    // the header strip and the profile trigger).
    expect(compiled.querySelector('header-chrome')).toBeNull();

    // The stat summary row replaces the old single micro-label.
    const statRow = compiled.querySelector('[data-testid="users-stat-row"]');
    expect(statRow).not.toBeNull();
    const statValues = Array.from(
      statRow!.querySelectorAll('.stat-card__value'),
    ).map((n) => n.textContent?.trim());
    expect(statValues).toEqual(['5', '4', '1', '2', '1']);

    const rows = compiled.querySelectorAll('.user-row');
    expect(rows.length).toBe(5);
    // Iteration order matches the listAll() response.
    expect(
      Array.from(rows).map((r) =>
        r.querySelector('.user-row__display-name')?.textContent?.trim(),
      ),
    ).toEqual(['Avery', 'Eli Chen', 'Jordan', 'Morgan', 'Sam Patel']);
  });

  it('renders the Option A column headers', async () => {
    userService.listAll.and.resolveTo(makeUserList());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const headers = Array.from(
      compiled.querySelectorAll('.users-table-header [role="columnheader"]'),
    ).map((n) => n.textContent?.trim());
    // USER (identity) / ROLE / STATUS / TICKETS / LAST ACTIVE,
    // plus a trailing empty cell for the hover-revealed actions.
    expect(headers).toEqual([
      'USER',
      'ROLE',
      'STATUS',
      'TICKETS',
      'LAST ACTIVE',
      '',
    ]);
  });

  it('renders each row\'s ticket count', async () => {
    userService.listAll.and.resolveTo(makeUserList());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const counts = Array.from(
      compiled.querySelectorAll('.user-row__tickets'),
    ).map((n) => n.textContent?.trim());
    // Avery has no ticketCount in the fixture → renders 0, and
    // the rest carry their real counts.
    expect(counts).toEqual(['0', '3', '34', '2', '8']);
  });

  it('keeps the existing ticket count when a role change patches the row', async () => {
    userService.listAll.and.resolveTo(makeUserList());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The PUT /users/:id/role response does NOT carry a ticket
    // count — it sends 0. The page must keep the count it had.
    userService.updateRole.and.resolveTo(
      baseUser(2, {
        displayName: 'Eli Chen',
        role: 'Support Agent',
        ticketCount: 0,
      }),
    );

    const compiled = fixture.nativeElement as HTMLElement;
    const eliRow = compiled.querySelector('[data-user-id="2"]') as HTMLElement;
    const select = eliRow.querySelector(
      'atom-select select',
    ) as HTMLSelectElement;
    select.value = 'Support Agent';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const patched = compiled.querySelector('[data-user-id="2"]') as HTMLElement;
    expect(patched.querySelector('.user-row__tickets')?.textContent?.trim())
      .toBe('3');
  });

  it('filters rows by the search term (name or email)', async () => {
    const list = makeUserList();
    userService.listAll.and.resolveTo(list);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector(
      '[data-testid="users-search"]',
    ) as HTMLInputElement;

    input.value = 'eli';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(
      Array.from(compiled.querySelectorAll('.user-row__display-name')).map(
        (n) => n.textContent?.trim(),
      ),
    ).toEqual(['Eli Chen']);

    // Email matches too.
    input.value = 'morgan';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.user-row').length).toBe(1);

    // No match → empty state, not a blank table.
    input.value = 'zzzz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(compiled.querySelector('[data-testid="users-empty"]')).not.toBeNull();
    expect(compiled.querySelectorAll('.user-row').length).toBe(0);
  });

  it('filters rows by role via the role chips', async () => {
    const list = makeUserList();
    userService.listAll.and.resolveTo(list);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    (compiled.querySelector('[data-testid="role-filter-admin"]') as HTMLElement)
      .click();
    fixture.detectChanges();
    expect(
      Array.from(compiled.querySelectorAll('.user-row__display-name')).map(
        (n) => n.textContent?.trim(),
      ),
    ).toEqual(['Avery', 'Sam Patel']);

    (compiled.querySelector('[data-testid="role-filter-support-agent"]') as HTMLElement)
      .click();
    fixture.detectChanges();
    expect(
      Array.from(compiled.querySelectorAll('.user-row__display-name')).map(
        (n) => n.textContent?.trim(),
      ),
    ).toEqual(['Jordan']);

    // Clicking the active chip again clears the filter.
    (compiled.querySelector('[data-testid="role-filter-support-agent"]') as HTMLElement)
      .click();
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.user-row').length).toBe(5);
  });

  it('renders 5 row skeletons during the loading state', async () => {
    let resolveFn!: (u: UserPublic[]) => void;
    userService.listAll.and.returnValue(
      new Promise<UserPublic[]>((r) => {
        resolveFn = r;
      }),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.renderState()).toBe('loading');
    const skels = fixture.nativeElement.querySelectorAll('.user-row-skel');
    expect(skels.length).toBe(5);

    resolveFn(makeUserList());
  });

  it('shows inline error + Retry button on a 5xx load', async () => {
    userService.listAll.and.rejectWith(
      new ApiError(500, 'internal_server_error', 'boom'),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('error');
    const err = fixture.nativeElement.querySelector('.users-error-card');
    expect(err).toBeTruthy();
    expect(err.querySelector('.error-message')?.textContent?.trim())
      .toBe("Couldn't load users. Refresh to try again.");
    const retry = err.querySelector('atom-button');
    expect(retry).toBeTruthy();
  });

  it('Retry button refetches the list', async () => {
    let callCount = 0;
    userService.listAll.and.callFake(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(
          new ApiError(500, 'internal_server_error', 'boom'),
        );
      }
      return Promise.resolve(makeUserList());
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.renderState()).toBe('error');

    component.onRefresh();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('success');
    expect(userService.listAll).toHaveBeenCalledTimes(2);
  });

  it('does not render the error card on a 401 (auth interceptor redirects)', async () => {
    userService.listAll.and.rejectWith(
      new ApiError(401, 'unauthenticated', 'expired'),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).not.toBe('error');
  });

  describe('self-row', () => {
    it('marks the current user row as self (3px border + disabled controls + micro-label)', async () => {
      const list = makeUserList();
      userService.listAll.and.resolveTo(list);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const rows = fixture.nativeElement.querySelectorAll('.user-row');
      // Row 0 is Avery (admin.id === 1).
      const selfRow = rows[0] as HTMLElement;
      expect(selfRow.classList.contains('user-row--self')).toBe(true);
      const selfSelect = selfRow.querySelector(
        'atom-select select',
      ) as HTMLSelectElement;
      expect(selfSelect.disabled).toBe(true);
      const selfToggle = selfRow.querySelector(
        '.user-row__active-toggle',
      ) as HTMLButtonElement;
      expect(selfToggle.disabled).toBe(true);
      const selfLabel = selfRow.querySelector(
        '.user-row__self-micro-label',
      );
      expect(selfLabel?.textContent?.trim())
        .toBe('You cannot change your own role.');

      // Non-self rows are NOT styled as self.
      const otherRow = rows[1] as HTMLElement;
      expect(otherRow.classList.contains('user-row--self')).toBe(false);
      const otherSelect = otherRow.querySelector(
        'atom-select select',
      ) as HTMLSelectElement;
      expect(otherSelect.disabled).toBe(false);
    });
  });

  describe('role change', () => {
    it('non-demotion: calls updateRole immediately on dropdown change', async () => {
      const list = makeUserList();
      userService.listAll.and.resolveTo(list);
      userService.updateRole.and.resolveTo(
        baseUser(2, { displayName: 'Eli Chen', role: 'Support Agent' }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      component.onRoleChange('Support Agent', list[1]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(userService.updateRole).toHaveBeenCalledWith(2, 'Support Agent');
    });

    it('Admin-demote: opens dialog, confirm calls updateRole, cancel reverts', async () => {
      const list = makeUserList();
      userService.listAll.and.resolveTo(list);
      userService.updateRole.and.resolveTo(
        baseUser(5, { displayName: 'Sam Patel', role: 'Support Agent' }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Sam Patel is an Admin; Admin → Support Agent triggers the
      // confirm dialog.
      component.onRoleChange('Support Agent', list[4]);
      fixture.detectChanges();
      expect(component.confirmCtx()?.kind).toBe('role-demote');
      expect(userService.updateRole).not.toHaveBeenCalled();

      // Cancel reverts (no update call, dialog clears).
      component.onConfirmCancel();
      fixture.detectChanges();
      expect(component.confirmCtx()).toBeNull();
      expect(userService.updateRole).not.toHaveBeenCalled();

      // Trigger again, then confirm.
      component.onRoleChange('Support Agent', list[4]);
      fixture.detectChanges();
      component.onConfirmAccept();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(userService.updateRole).toHaveBeenCalledWith(5, 'Support Agent');
    });

    it('non-demotion 5xx: shows inline row error', async () => {
      const list = makeUserList();
      userService.listAll.and.resolveTo(list);
      userService.updateRole.and.rejectWith(
        new ApiError(500, 'internal_server_error', 'boom'),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      component.onRoleChange('Support Agent', list[1]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.rowError(2)).toBe("Couldn't update. Try again.");
    });
  });

  describe('active toggle', () => {
    it('non-Admin target: calls updateActive immediately on click', async () => {
      const list = makeUserList();
      userService.listAll.and.resolveTo(list);
      userService.updateActive.and.resolveTo(
        baseUser(2, { displayName: 'Eli Chen', isActive: false }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Eli Chen is a User (role !== 'Admin'), so click goes
      // straight to updateActive(false).
      component.onActiveToggle(list[1]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(userService.updateActive).toHaveBeenCalledWith(2, false);
    });

    it('re-activating an inactive user: calls updateActive(true) immediately', async () => {
      const list = makeUserList();
      userService.listAll.and.resolveTo(list);
      userService.updateActive.and.resolveTo(
        baseUser(4, { displayName: 'Morgan', isActive: true }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Morgan is currently inactive; re-activating is non-destructive.
      component.onActiveToggle(list[3]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(userService.updateActive).toHaveBeenCalledWith(4, true);
    });

    it('Admin → inactive: opens dialog, confirm calls updateActive(false), cancel reverts', async () => {
      const list = makeUserList();
      userService.listAll.and.resolveTo(list);
      userService.updateActive.and.resolveTo(
        baseUser(5, { displayName: 'Sam Patel', isActive: false }),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Sam Patel is Admin + active; click triggers the confirm.
      component.onActiveToggle(list[4]);
      fixture.detectChanges();
      expect(component.confirmCtx()?.kind).toBe('admin-deactivate');
      expect(userService.updateActive).not.toHaveBeenCalled();

      component.onConfirmCancel();
      fixture.detectChanges();
      expect(component.confirmCtx()).toBeNull();
      expect(userService.updateActive).not.toHaveBeenCalled();

      component.onActiveToggle(list[4]);
      fixture.detectChanges();
      component.onConfirmAccept();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(userService.updateActive).toHaveBeenCalledWith(5, false);
    });

    it('5xx: shows inline row error', async () => {
      const list = makeUserList();
      userService.listAll.and.resolveTo(list);
      userService.updateActive.and.rejectWith(
        new ApiError(500, 'internal_server_error', 'boom'),
      );
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      component.onActiveToggle(list[1]);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.rowError(2)).toBe("Couldn't update. Try again.");
    });
  });

  describe('formatRelative', () => {
    it('returns null for null input (renders "Never" in template)', () => {
      expect(component.formatRelative(null)).toBeNull();
    });
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
    it('returns "" on NaN', () => {
      expect(component.formatRelative('not-a-date')).toBe('');
    });
  });

  it('window:focus refetches when in success state', async () => {
    userService.listAll.and.resolveTo(makeUserList());
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.renderState()).toBe('success');
    expect(userService.listAll).toHaveBeenCalledTimes(1);

    component.onWindowFocus();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(userService.listAll).toHaveBeenCalledTimes(2);
  });

  it('window:focus does NOT refetch when in loading state', async () => {
    let resolveFn!: (u: UserPublic[]) => void;
    userService.listAll.and.returnValue(
      new Promise<UserPublic[]>((r) => {
        resolveFn = r;
      }),
    );
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.renderState()).toBe('loading');
    component.onWindowFocus();
    expect(userService.listAll).toHaveBeenCalledTimes(1);

    resolveFn(makeUserList());
  });

  it('does not call updateRole when the new role === current role (defensive)', async () => {
    const list = makeUserList();
    userService.listAll.and.resolveTo(list);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.onRoleChange('User', list[1]);
    fixture.detectChanges();
    expect(userService.updateRole).not.toHaveBeenCalled();
  });
});