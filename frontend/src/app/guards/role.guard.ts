/**
 * roleGuard — HD-006.
 *
 * Functional CanActivateFn factory. Returns a guard that allows entry
 * only when the current user's role is in `allowedRoles`. Auth is
 * expected to have been verified by `authGuard` running first in the
 * `canActivate` array; this guard does NOT re-fetch `/me`.
 *
 * On role mismatch (or no user — defensive — e.g. if a page wires
 * `roleGuard` without `authGuard`), the guard redirects to
 * `/forbidden?denied_from=<currentUrl>` so the 403 page can render a
 * breadcrumb of where the user was trying to go.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/enums';

export function roleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return (_route, state): boolean | UrlTree => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const user = auth.userSnapshot();
    if (!user || !allowedRoles.includes(user.role)) {
      const deniedFrom = encodeURIComponent(state.url);
      return router.parseUrl(`/forbidden?denied_from=${deniedFrom}`);
    }

    return true;
  };
}
