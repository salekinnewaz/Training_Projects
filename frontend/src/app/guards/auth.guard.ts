/**
 * authGuard — HD-006.
 *
 * Functional CanActivateFn that enforces "must be authenticated to enter".
 *
 * Reads `AuthService.userSnapshot()` synchronously first — the common
 * case (hot navigation while a session cookie is still good) avoids a
 * `/me` round-trip. Only on a confirmed null does the guard call
 * `refreshUser()` once; on a 401 that promise resolves cleanly with
 * user$ = null and the guard then redirects to
 * `/login?return_to=<currentUrl>`.
 *
 * On any other error (network / 5xx), the guard treats the user as
 * unauthenticated and still redirects — the original URL is preserved
 * in `return_to` so a successful login bounces the user back.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  let user = auth.userSnapshot();
  if (!user) {
    // Confirm with the backend before bouncing to /login — covers the
    // cold-visit case where the cookie is valid but the in-memory
    // snapshot hasn't been filled yet.
    try {
      await auth.refreshUser();
    } catch {
      // Network / 5xx — treat as unauthenticated and fall through.
      // The refreshUser promise itself never throws on 401 (it
      // silently sets user$ = null), so any throw here is a real error.
    }
    user = auth.userSnapshot();
  }

  if (!user) {
    const returnTo = encodeURIComponent(state.url);
    return router.parseUrl(`/login?return_to=${returnTo}`);
  }

  return true;
};
