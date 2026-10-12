/**
 * UserService — HD-014 spec.
 *
 * Verifies the three new methods on `UserService`:
 *   - listAll():     GET /api/users
 *   - updateRole():  PUT /api/users/:id/role
 *   - updateActive(): PUT /api/users/:id/status
 *
 * HttpClient is exercised through HttpTestingController. The
 * auth interceptor is bypassed (HttpClient goes straight to the
 * controller) so the test focuses on the service contract —
 * URL, method, body, response unwrap, ApiError conversion on
 * non-2xx.
 */

import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { UserService } from './user.service';
import { ApiError } from './api-error';
import { environment } from '../../environments/environment';
import type { UserPublic } from '../models/user';
import type { UserRole } from '../models/enums';

const baseUser = (overrides: Partial<UserPublic> = {}): UserPublic => ({
  id: 1,
  email: 'admin@example.com',
  displayName: 'Avery',
  role: 'Admin',
  isActive: true,
  lastActiveAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  ...overrides,
});

describe('UserService (HD-014)', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        UserService,
      ],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listAll', () => {
    it('GETs /api/users and unwraps { users } on 200', async () => {
      const users = [
        baseUser({ id: 1, displayName: 'Avery' }),
        baseUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ];
      const p = service.listAll();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ users, count: users.length });
      const result = await p;
      expect(result).toEqual(users);
    });

    it('throws ApiError on a 500 response', async () => {
      const p = service.listAll();
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/users`);
      req.flush(
        { error: 'internal_server_error', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      let caught: unknown = null;
      try {
        await p;
        fail('expected ApiError');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(500);
      expect((caught as ApiError).errorCode).toBe('internal_server_error');
    });
  });

  describe('updateRole', () => {
    it('PUTs /api/users/:id/role with { role } and returns the user on 200', async () => {
      const updated = baseUser({ id: 7, role: 'Support Agent' });
      const p = service.updateRole(7, 'Support Agent');
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/users/7/role`,
      );
      expect(req.request.method).toBe('PUT');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual({ role: 'Support Agent' });
      req.flush(updated);
      const result = await p;
      expect(result).toEqual(updated);
    });

    it('throws ApiError on a 5xx response', async () => {
      const p = service.updateRole(7, 'Admin');
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/users/7/role`,
      );
      req.flush(
        { error: 'internal_server_error', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await expectAsync(p).toBeRejectedWith(jasmine.any(ApiError));
    });

    it('throws ApiError on a 400 validation_error with fields.role', async () => {
      // Cast through unknown so the test exercises the wire
      // contract for a 400, not the UserRole type contract.
      const p = service.updateRole(7, 'Wizard' as unknown as UserRole);
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/users/7/role`,
      );
      req.flush(
        {
          error: 'validation_error',
          message: 'role must be one of: User, Support Agent, Admin.',
          fields: { role: 'invalid-role' },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      try {
        await p;
        fail('expected ApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(400);
        expect((err as ApiError).fields).toEqual({ role: 'invalid-role' });
      }
    });
  });

  describe('updateActive', () => {
    it('PUTs /api/users/:id/status with { isActive } and returns the user on 200', async () => {
      const updated = baseUser({ id: 7, isActive: false });
      const p = service.updateActive(7, false);
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/users/7/status`,
      );
      expect(req.request.method).toBe('PUT');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual({ isActive: false });
      req.flush(updated);
      const result = await p;
      expect(result).toEqual(updated);
    });

    it('throws ApiError on a 5xx response', async () => {
      const p = service.updateActive(7, true);
      const req = httpMock.expectOne(
        `${environment.apiBaseUrl}/users/7/status`,
      );
      req.flush(
        { error: 'internal_server_error', message: 'boom' },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await expectAsync(p).toBeRejectedWith(jasmine.any(ApiError));
    });
  });
});