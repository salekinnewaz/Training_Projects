/**
 * roleGuard — HD-006, D10 fix.
 *
 * Functional CanActivateFn factory. Returns a guard that allows entry
 * only when the current user's role is in `allowedRoles`. Auth is
 * expected to have been verified by `authGuard` running first in the
 * `canActivate` array; this guard does NOT re-fetch `/me` when the
 * snapshot is already populated.
 *
 * **Cold-load race fix (D10)**: the previous synchronous body read
 * `userSnapshot()` immediately. Angular runs the `canActivate` array
 * entries concurrently, so `roleGuard` could observe a null
 * snapshot on a hard-reload of a protected URL while still
 * authenticated — `authGuard`'s `await refreshUser()` had not yet
 * resolved. The fix makes `roleGuard` async and awaits
 * `refreshUser()` itself when the snapshot is null. `AuthService`
 * dedups concurrent `/me` calls via `inflightRefresh`, so the
 * duplication is bounded to a single in-flight HTTP request even
 * when `authGuard` is also in the array.
 *
 * On role mismatch (or no user — defensive — e.g. if a page wires
 * `roleGuard` without `authGuard`, or `refreshUser` rejects), the
 * guard redirects to `/forbidden?denied_from=<currentUrl>` so the
 * 403 page can render a breadcrumb of where the user was trying
 * to go.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/enums';

export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return async (_route, state): Promise<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const router = inject(Router);

    let user = auth.userSnapshot();
    if (!user) {
      // Cold-load case (D10): the snapshot is null because no
      // /me round-trip has completed yet. authGuard may be
      // racing us in the canActivate array; AuthService's
      // inflightRefresh dedup means we share its request.
      try {
        await auth.refreshUser();
      } catch {
        // Network / 5xx — treat as no user and fall through to
        // the forbidden redirect.
      }
      user = auth.userSnapshot();
    }

    if (!user || !allowedRoles.includes(user.role)) {
      const deniedFrom = encodeURIComponent(state.url);
      return router.parseUrl(`/forbidden?denied_from=${deniedFrom}`);
    }

    return true;
  };
}
