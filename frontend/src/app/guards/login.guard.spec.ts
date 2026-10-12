/**
 * loginGuard — guard spec.
 *
 * Pins the inverse-of-authGuard contract:
 *
 *   - Snapshot is null → guard returns true (login form
 *     renders).
 *   - Snapshot is null + refreshUser resolves to null → guard
 *     returns true (still null, form still renders).
 *   - Snapshot is null + refreshUser rejects (5xx / network)
 *     → guard returns true (form renders; we never block on
 *     a network error).
 *   - Snapshot is null + refreshUser resolves to a user →
 *     guard returns UrlTree to auth.roleHomePath() (bounce
 *     the already-authed user to their dashboard).
 *   - Snapshot already has a user → guard returns UrlTree to
 *     auth.roleHomePath() (no refresh, hot-path fast bounce).
 */

import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { loginGuard } from './login.guard';
import { AuthService } from '../services/auth.service';
import type { UserPublic } from '../models/user';

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
  roleHomePath: jasmine.Spy<() => string>;
}

describe('loginGuard', () => {
  let auth: AuthServiceStub;
  let router: Router;

  const state = { url: '/login' } as RouterStateSnapshot;
  const route = {} as ActivatedRouteSnapshot;

  beforeEach(async () => {
    auth = {
      userSnapshot: jasmine.createSpy('userSnapshot'),
      refreshUser: jasmine.createSpy('refreshUser'),
      roleHomePath: jasmine.createSpy('roleHomePath').and.returnValue('/dashboard'),
    };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  function run(): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(
      () => loginGuard(route, state) as Promise<boolean | UrlTree>,
    );
  }

  it('returns true when the snapshot is null and refreshUser resolves to null (cold-load no auth)', async () => {
    // The guard always tries a refresh on a null snapshot —
    // this is the "did the user arrive here with a valid
    // cookie we haven't read yet?" check. If /me 401s (cookie
    // missing or expired), the snapshot stays null and the
    // form renders.
    let postRefresh: UserPublic | null = null;
    auth.userSnapshot.and.callFake(() => {
      if (auth.refreshUser.calls.count() === 0) return null;
      return postRefresh;
    });
    auth.refreshUser.and.callFake(async () => {
      postRefresh = null;
    });

    const result = await run();

    expect(auth.refreshUser).toHaveBeenCalledTimes(1);
    expect(result).toBeTrue();
  });

  it('returns true when the snapshot is null + refreshUser rejects (5xx / network)', async () => {
    auth.userSnapshot.and.returnValue(null);
    auth.refreshUser.and.rejectWith(new Error('boom'));

    const result = await run();

    expect(auth.refreshUser).toHaveBeenCalledTimes(1);
    expect(result).toBeTrue();
  });

  it('redirects to roleHomePath when the snapshot already has a user (hot path, no refresh)', async () => {
    auth.userSnapshot.and.returnValue(baseUser({ role: 'Admin' }));
    auth.roleHomePath.and.returnValue('/admin');

    const result = await run();

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/admin');
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });

  it('redirects to roleHomePath when refreshUser resolves to a user (cold-load authed user)', async () => {
    let postRefresh: UserPublic | null = null;
    auth.userSnapshot.and.callFake(() => {
      if (auth.refreshUser.calls.count() === 0) return null;
      return postRefresh;
    });
    auth.refreshUser.and.callFake(async () => {
      postRefresh = baseUser({ role: 'Support Agent' });
    });
    auth.roleHomePath.and.returnValue('/queue');

    const result = await run();

    expect(auth.refreshUser).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/queue');
  });
});
