/**
 * roleGuard — guard spec (HD-006, D10 fix).
 *
 * Pins the public contract including the D10 cold-load race
 * fix:
 *
 *   - Hot path: snapshot has a user with an allowed role →
 *     guard returns true, refreshUser() is NOT called.
 *   - Hot path: snapshot has a user with a DISALLOWED role →
 *     guard returns UrlTree to /forbidden?denied_from=<url>.
 *   - **Cold-load happy path (D10 fix)**: snapshot is null,
 *     refreshUser() resolves to a user with an allowed role →
 *     guard returns true. Before the fix this branch went to
 *     /forbidden because the synchronous read happened before
 *     the async /me round-trip completed.
 *   - Cold-load null user: snapshot is null, refreshUser()
 *     resolves to null → guard returns UrlTree to
 *     /forbidden?denied_from=<url>.
 *   - Cold-load 5xx: snapshot is null, refreshUser() rejects
 *     → guard returns UrlTree to /forbidden?denied_from=<url>
 *     (no need to fall through to /login — the roleGuard only
 *     enforces role, not auth).
 *
 * The functional CanActivateFn is invoked via
 * TestBed.runInInjectionContext (canonical Angular 17 pattern).
 */

import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import type { UserPublic } from '../models/user';
import type { UserRole } from '../models/enums';

const baseUser = (overrides: Partial<UserPublic> = {}): UserPublic => ({
  id: 1,
  email: 'sam@example.com',
  displayName: 'Sam',
  role: 'User',
  isActive: true,
  lastActiveAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

interface AuthServiceStub {
  userSnapshot: jasmine.Spy<() => UserPublic | null>;
  refreshUser: jasmine.Spy<() => Promise<void>>;
}

describe('roleGuard', () => {
  let auth: AuthServiceStub;
  let router: Router;

  const state = { url: '/dashboard' } as RouterStateSnapshot;
  const route = {} as ActivatedRouteSnapshot;

  beforeEach(async () => {
    auth = {
      userSnapshot: jasmine.createSpy('userSnapshot'),
      refreshUser: jasmine.createSpy('refreshUser'),
    };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  function run(allowed: UserRole[]): Promise<boolean | UrlTree> {
    const guard = roleGuard(allowed);
    return TestBed.runInInjectionContext(
      () => guard(route, state) as Promise<boolean | UrlTree>,
    );
  }

  describe('hot path (snapshot populated)', () => {
    it('returns true when the user role is in allowedRoles', async () => {
      auth.userSnapshot.and.returnValue(baseUser({ role: 'User' }));

      const result = await run(['User', 'Support Agent']);

      expect(result).toBeTrue();
      expect(auth.refreshUser).not.toHaveBeenCalled();
    });

    it('redirects to /forbidden?denied_from=<url> when the role is disallowed', async () => {
      auth.userSnapshot.and.returnValue(baseUser({ role: 'User' }));

      const result = await run(['Admin']);

      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe(
        '/forbidden?denied_from=%2Fdashboard',
      );
      expect(auth.refreshUser).not.toHaveBeenCalled();
    });

    it('does NOT call refreshUser even when a refresh would resolve a permitted role (no needless /me)', async () => {
      // Even though calling refreshUser() with this stub would
      // resolve to the same user, the guard must short-circuit
      // on the populated snapshot.
      auth.userSnapshot.and.returnValue(baseUser({ role: 'Support Agent' }));
      auth.refreshUser.and.resolveTo();

      const result = await run(['Support Agent', 'Admin']);

      expect(result).toBeTrue();
      expect(auth.refreshUser).not.toHaveBeenCalled();
    });
  });

  describe('cold-load race (D10 fix)', () => {
    it('awaits refreshUser and returns true when the loaded user is allowed', async () => {
      // Snapshot starts null; the stub's callFake mimics the
      // real AuthService: null before refresh, populated after.
      let postRefresh: UserPublic | null = null;
      auth.userSnapshot.and.callFake(() => {
        if (auth.refreshUser.calls.count() === 0) return null;
        return postRefresh;
      });
      auth.refreshUser.and.callFake(async () => {
        postRefresh = baseUser({ id: 7, role: 'User' });
      });

      const result = await run(['User']);

      expect(auth.refreshUser).toHaveBeenCalledTimes(1);
      expect(result).toBeTrue();
    });

    it('redirects to /forbidden when refreshUser leaves the snapshot null (401)', async () => {
      auth.userSnapshot.and.returnValue(null);
      auth.refreshUser.and.resolveTo();

      const result = await run(['User']);

      expect(auth.refreshUser).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe(
        '/forbidden?denied_from=%2Fdashboard',
      );
    });

    it('redirects to /forbidden when refreshUser rejects (5xx / network)', async () => {
      auth.userSnapshot.and.returnValue(null);
      auth.refreshUser.and.rejectWith(new Error('boom'));

      const result = await run(['User']);

      expect(auth.refreshUser).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe(
        '/forbidden?denied_from=%2Fdashboard',
      );
    });

    it('redirects to /forbidden when refreshUser resolves to a user with a disallowed role', async () => {
      // Defensive: even if /me returns a user, if their role
      // does not match, the guard still rejects. This guards
      // against a stale /me response after a role change.
      let postRefresh: UserPublic | null = null;
      auth.userSnapshot.and.callFake(() => {
        if (auth.refreshUser.calls.count() === 0) return null;
        return postRefresh;
      });
      auth.refreshUser.and.callFake(async () => {
        postRefresh = baseUser({ id: 7, role: 'User' });
      });

      const result = await run(['Admin']);

      expect(result).toBeInstanceOf(UrlTree);
      expect((result as UrlTree).toString()).toBe(
        '/forbidden?denied_from=%2Fdashboard',
      );
    });
  });

  describe('denied_from encoding', () => {
    it('preserves the original URL (with query params) in denied_from', async () => {
      auth.userSnapshot.and.returnValue(baseUser({ role: 'User' }));
      const queryState = { url: '/tickets/42?foo=bar' } as RouterStateSnapshot;
      const guard = roleGuard(['Admin']);

      const result = (await TestBed.runInInjectionContext(
        () => guard(route, queryState) as Promise<boolean | UrlTree>,
      )) as UrlTree;

      expect(result.toString()).toBe(
        '/forbidden?denied_from=%2Ftickets%2F42%3Ffoo%3Dbar',
      );
      const parsed = router.parseUrl(result.toString());
      expect(parsed.queryParams['denied_from']).toBe('/tickets/42?foo=bar');
    });
  });
});
