/**
 * loginGuard — HD-006.
 *
 * Inverse of `authGuard`. Applied to `/login`. If the user is already
 * authenticated (or `refreshUser()` resolves one), redirect them to
 * their role-correct dashboard via `auth.roleHomePath()`. Otherwise
 * allow the login form to render.
 *
 * Like `authGuard`, this reads `userSnapshot()` first to avoid a `/me`
 * round-trip on every hot visit.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const loginGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  let user = auth.userSnapshot();
  if (!user) {
    try {
      await auth.refreshUser();
    } catch {
      // Network / 5xx — fall through and let the login form render.
    }
    user = auth.userSnapshot();
  }

  if (user) {
    return router.parseUrl(auth.roleHomePath());
  }

  return true;
};
