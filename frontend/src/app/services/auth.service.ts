/**
 * AuthService — HD-004.
 *
 * Owns the "who is logged in" state for the frontend. Backed by:
 *   POST /api/auth/login    (sets the httpOnly cookie on success)
 *   POST /api/auth/logout   (clears the cookie + emits null)
 *   GET  /api/auth/me       (refreshes user$ on demand)
 *
 * The cookie rides in/out automatically because the auth interceptor
 * stamps `withCredentials: true` on every /api/* request.
 *
 * Bootstrap-performant: this service does NOT call /me on construction.
 * Consumers pull `userSnapshot()` synchronously and (if null) call
 * `refreshUser()` from their own ngOnInit. This avoids a guaranteed 401
 * round-trip on public pages like /login. The route guard (HD-006)
 * will own the "must be logged in to enter" enforcement.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import type { UserPublic } from '../models/user';
import { ApiError, apiErrorFrom } from './api-error';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly userSubject = new BehaviorSubject<UserPublic | null>(null);
  readonly user$: Observable<UserPublic | null> = this.userSubject.asObservable();

  /** Synchronous read for templates / event handlers. */
  userSnapshot(): UserPublic | null {
    return this.userSubject.value;
  }

  /**
   * POST /api/auth/login. Sets the httpOnly cookie on success and
   * fills the user$ BehaviorSubject with the full UserPublic shape.
   *
   * Rejects with an `ApiError` (status, errorCode, message, fields)
   * on any non-2xx response — the login page (HD-005) renders field
   * errors from `err.fields`.
   */
  async login(email: string, password: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBaseUrl}/auth/login`,
          { email, password },
          { withCredentials: true, observe: 'response', responseType: 'json' },
        ),
      );
      // The login response body only carries { id, email, displayName, role }.
      // Pull the full shape via /me so consumers don't need to special-case.
      await this.refreshUser();
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * POST /api/auth/logout. Always succeeds from the client's POV —
   * the backend may return 401 if the cookie was already expired,
   * which is treated as success (the cookie is already gone).
   *
   * After resolving, user$ is null. Caller (the chrome) is responsible
   * for the post-logout redirect to /login.
   */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBaseUrl}/auth/logout`,
          {},
          { withCredentials: true, observe: 'response' },
        ),
      );
    } catch (err) {
      const apiErr = apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
      // 401 just means the cookie was already gone — still a success.
      if (apiErr.status !== 401) {
        throw apiErr;
      }
    } finally {
      this.userSubject.next(null);
    }
  }

  /**
   * GET /api/auth/me. Fills user$ from the response body.
   *
   * 401 is silently swallowed → user$ = null (no redirect, no error).
   * Any other non-2xx is surfaced as ApiError so callers can react.
   */
  async refreshUser(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ user: UserPublic }>(
          `${environment.apiBaseUrl}/auth/me`,
          { withCredentials: true },
        ),
      );
      this.userSubject.next(res.user);
    } catch (err) {
      const apiErr = apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
      if (apiErr.status === 401) {
        this.userSubject.next(null);
        return;
      }
      throw apiErr;
    }
  }

  /**
   * Role-correct dashboard route — used by the chrome's brand mark.
   * Employees land on /dashboard, Support Agents on /queue, Admins
   * on /admin. Unauthenticated → /login.
   */
  roleHomePath(): string {
    const role = this.userSubject.value?.role;
    if (role === 'Admin') return '/admin';
    if (role === 'Support Agent') return '/queue';
    if (role === 'User') return '/dashboard';
    return '/login';
  }
}
