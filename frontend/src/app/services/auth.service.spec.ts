/**
 * AuthService — service spec.
 *
 * Pins the public contract:
 *
 *   - refreshUser() calls GET /api/auth/me with withCredentials
 *   - 200 response → user$ emits the response body
 *   - 401 response → user$ emits null (silently, no throw)
 *   - 5xx / network error → refreshUser() rejects
 *
 * And the D10 dedup contract:
 *
 *   - Concurrent refreshUser() calls share a single in-flight
 *     HTTP request (authGuard + roleGuard + header-chrome's
 *     mount effect all fire on a cold load — only one /me
 *     round-trip should hit the network)
 *   - After the in-flight request settles (success OR error),
 *     the next refreshUser() call fires a fresh request
 *
 * The auth interceptor is registered via `withInterceptors`
 * (matches the real app config) so the spec exercises the
 * same error-conversion path the app does.
 */

import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { ApiError } from './api-error';
import { environment } from '../../environments/environment';
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

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthService,
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('userSnapshot', () => {
    it('returns null before any refreshUser() call', () => {
      expect(service.userSnapshot()).toBeNull();
    });
  });

  describe('user$', () => {
    it('emits the current user after a successful refreshUser()', async () => {
      // Collect emissions from the moment we subscribe; the
      // BehaviorSubject's first value is null (initial), then
      // refreshUser pushes the loaded user. We assert on the
      // last emission.
      const emissions: Array<UserPublic | null> = [];
      const sub = service.user$.subscribe((u) => emissions.push(u));
      try {
        const user = baseUser();
        const p = service.refreshUser();
        const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
        req.flush({ user });
        await p;
        expect(emissions).toEqual([null, user]);
      } finally {
        sub.unsubscribe();
      }
    });

    it('emits null after a 401 refreshUser()', async () => {
      const emissions: Array<UserPublic | null> = [];
      const sub = service.user$.subscribe((u) => emissions.push(u));
      try {
        const p = service.refreshUser();
        const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
        req.flush(
          { error: 'unauthenticated', message: 'No session.' },
          { status: 401, statusText: 'Unauthorized' },
        );
        await p;
        // Initial null, then null again after the 401 mapping.
        expect(emissions).toEqual([null, null]);
      } finally {
        sub.unsubscribe();
      }
    });
  });

  describe('refreshUser', () => {
    it('GETs /api/auth/me with withCredentials on a 200', async () => {
      const user = baseUser({ id: 7, role: 'Support Agent' });
      const p = service.refreshUser();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ user });
      await p;
      expect(service.userSnapshot()).toEqual(user);
    });

    it('silently sets user$ to null on a 401 (no throw)', async () => {
      const p = service.refreshUser();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      req.flush(
        { error: 'unauthenticated', message: 'No session.' },
        { status: 401, statusText: 'Unauthorized' },
      );
      await p;
      expect(service.userSnapshot()).toBeNull();
    });

    it('rejects with ApiError on a 5xx', async () => {
      const p = service.refreshUser();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      req.flush(
        { error: 'internal_server_error', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await expectAsync(p).toBeRejectedWith(jasmine.any(ApiError));
      // Snapshot stays at its prior value (null) on a 5xx — the
      // service only emits null on a confirmed 401.
      expect(service.userSnapshot()).toBeNull();
    });

    it('rejects with ApiError on a network failure (status 0)', async () => {
      const p = service.refreshUser();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      await expectAsync(p).toBeRejectedWith(jasmine.any(ApiError));
    });
  });

  describe('refreshUser — D10 in-flight dedup', () => {
    it('shares a single GET /me across 3 concurrent callers', async () => {
      // Fire three refreshUser() calls without awaiting — the
      // spec proves the dedup pattern by ensuring httpMock
      // records exactly one in-flight request, not three.
      const p1 = service.refreshUser();
      const p2 = service.refreshUser();
      const p3 = service.refreshUser();
      const reqs = httpMock.match(`${environment.apiBaseUrl}/auth/me`);
      expect(reqs.length).toBe(1);

      const user = baseUser({ id: 11 });
      reqs[0].flush({ user });

      await Promise.all([p1, p2, p3]);
      expect(service.userSnapshot()).toEqual(user);
    });

    it('lets a new refreshUser() fire after the in-flight one resolves', async () => {
      const first = service.refreshUser();
      const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      const user1 = baseUser({ id: 11, displayName: 'First' });
      req1.flush({ user: user1 });
      await first;

      // After the first resolves, the inflight cache is cleared —
      // a new call should fire its own GET.
      const second = service.refreshUser();
      const req2 = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      const user2 = baseUser({ id: 22, displayName: 'Second' });
      req2.flush({ user: user2 });
      await second;

      expect(service.userSnapshot()).toEqual(user2);
    });

    it('lets a new refreshUser() fire after the in-flight one rejects', async () => {
      // First call rejects with 5xx — the dedup cache must be
      // cleared so the next call hits the network instead of
      // returning the same rejected promise.
      const first = service.refreshUser();
      const req1 = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      req1.flush(
        { error: 'internal_server_error', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await expectAsync(first).toBeRejectedWith(jasmine.any(ApiError));

      const second = service.refreshUser();
      const req2 = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      const user = baseUser({ id: 33 });
      req2.flush({ user });
      await second;
      expect(service.userSnapshot()).toEqual(user);
    });

    it('shares the rejection with concurrent callers (no double /me)', async () => {
      const p1 = service.refreshUser();
      const p2 = service.refreshUser();
      const reqs = httpMock.match(`${environment.apiBaseUrl}/auth/me`);
      expect(reqs.length).toBe(1);
      reqs[0].flush(
        { error: 'internal_server_error', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await expectAsync(p1).toBeRejectedWith(jasmine.any(ApiError));
      await expectAsync(p2).toBeRejectedWith(jasmine.any(ApiError));
    });
  });

  describe('logout', () => {
    it('POSTs /api/auth/logout and clears the snapshot', async () => {
      // Prime the snapshot.
      const primed = service.refreshUser();
      const reqMe = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      reqMe.flush({ user: baseUser() });
      await primed;
      expect(service.userSnapshot()).not.toBeNull();

      const p = service.logout();
      const reqLogout = httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`);
      expect(reqLogout.request.method).toBe('POST');
      reqLogout.flush({});
      await p;
      expect(service.userSnapshot()).toBeNull();
    });

    it('treats a 401 on logout as success (cookie already gone)', async () => {
      const p = service.logout();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`);
      req.flush(
        { error: 'unauthenticated', message: 'No session.' },
        { status: 401, statusText: 'Unauthorized' },
      );
      // logout() swallows 401 → resolves cleanly.
      await expectAsync(p).toBeResolved();
      expect(service.userSnapshot()).toBeNull();
    });

    it('rethrows on a non-401 logout error', async () => {
      const p = service.logout();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/logout`);
      req.flush(
        { error: 'internal_server_error', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await expectAsync(p).toBeRejectedWith(jasmine.any(ApiError));
    });
  });

  describe('roleHomePath', () => {
    it('returns /admin for an Admin snapshot', () => {
      const p = service.refreshUser();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      req.flush({ user: baseUser({ role: 'Admin' }) });
      return p.then(() => {
        expect(service.roleHomePath()).toBe('/admin');
      });
    });

    it('returns /queue for a Support Agent snapshot', () => {
      const p = service.refreshUser();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      req.flush({ user: baseUser({ role: 'Support Agent' }) });
      return p.then(() => {
        expect(service.roleHomePath()).toBe('/queue');
      });
    });

    it('returns /dashboard for a User snapshot', () => {
      const p = service.refreshUser();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/me`);
      req.flush({ user: baseUser({ role: 'User' }) });
      return p.then(() => {
        expect(service.roleHomePath()).toBe('/dashboard');
      });
    });

    it('returns /login when the snapshot is null', () => {
      expect(service.roleHomePath()).toBe('/login');
    });
  });
});
