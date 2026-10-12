/**
 * authGuard — guard spec.
 *
 * Pins the public contract:
 *
 *   - userSnapshot() returns a user → guard returns true,
 *     refreshUser() is NOT called (no needless /me round-trip
 *     on hot navigations).
 *   - userSnapshot() is null + refreshUser() resolves to a
 *     user → guard returns true (the cold-load happy path).
 *   - userSnapshot() is null + refreshUser() resolves to null
 *     (401) → guard returns UrlTree to
 *     /login?return_to=<state.url>.
 *   - userSnapshot() is null + refreshUser() rejects
 *     (5xx / network) → guard returns UrlTree to
 *     /login?return_to=<state.url> (treats as unauthenticated).
 *
 * The guard is a functional CanActivateFn; we exercise it via
 * TestBed.runInInjectionContext (the canonical Angular 17
 * pattern — no full Router required).
 */

import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { authGuard } from './auth.guard';
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
}

describe('authGuard', () => {
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

  function run(): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(
      () => authGuard(route, state) as Promise<boolean | UrlTree>,
    );
  }

  it('returns true when the snapshot already has a user (no refreshUser call)', async () => {
    auth.userSnapshot.and.returnValue(baseUser());

    const result = await run();

    expect(result).toBeTrue();
    expect(auth.refreshUser).not.toHaveBeenCalled();
  });

  it('calls refreshUser when the snapshot is null and resolves true on a successful load', async () => {
    const user = baseUser({ id: 7, role: 'Admin' });
    auth.userSnapshot.and.callFake(() => {
      // First call: null (before refresh). Second call: user
      // (after refresh resolves).
      if (auth.refreshUser.calls.count() === 0) return null;
      return user;
    });
    auth.refreshUser.and.resolveTo();

    const result = await run();

    expect(auth.refreshUser).toHaveBeenCalledTimes(1);
    expect(result).toBeTrue();
  });

  it('redirects to /login?return_to=<url> when refreshUser leaves the snapshot null (401)', async () => {
    auth.userSnapshot.and.returnValue(null);
    auth.refreshUser.and.resolveTo();

    const result = await run();

    expect(result).toBeInstanceOf(UrlTree);
    const url = (result as UrlTree).toString();
    expect(url).toBe('/login?return_to=%2Fdashboard');
  });

  it('redirects to /login?return_to=<url> when refreshUser rejects (5xx / network)', async () => {
    auth.userSnapshot.and.returnValue(null);
    auth.refreshUser.and.rejectWith(new Error('boom'));

    const result = await run();

    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe('/login?return_to=%2Fdashboard');
  });

  it('preserves the original URL (with query params) in return_to', async () => {
    const queryState = { url: '/tickets/42?foo=bar' } as RouterStateSnapshot;

    auth.userSnapshot.and.returnValue(null);
    auth.refreshUser.and.resolveTo();

    const result = (await TestBed.runInInjectionContext(
      () => authGuard(route, queryState) as Promise<boolean | UrlTree>,
    )) as UrlTree;

    expect(result.toString()).toBe('/login?return_to=%2Ftickets%2F42%3Ffoo%3Dbar');
    // Sanity: the parseUrl path matches a manual URL.
    const parsed = router.parseUrl(result.toString());
    expect(parsed.queryParams['return_to']).toBe('/tickets/42?foo=bar');
  });
});
