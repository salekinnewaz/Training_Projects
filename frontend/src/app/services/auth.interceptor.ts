/**
 * Auth HTTP interceptor — HD-004.
 *
 * Functional HttpInterceptorFn (Angular 17 idiom). Two jobs:
 *
 * 1. Stamp `withCredentials: true` on every same-origin /api/* request
 *    so the httpOnly `auth` cookie flows on cross-port dev requests
 *    (frontend :4200 → backend :3000).
 *
 * 2. Convert raw `HttpErrorResponse` into the typed `ApiError` shape
 *    so service callers can switch on `errorCode` instead of inspecting
 *    status + message text.
 *
 * Cross-origin asset requests (fonts, images, anything not under the
 * API base URL) pass through untouched — they don't need credentials
 * and re-cloning would break them.
 */

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { apiErrorFrom } from './api-error';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi =
    req.url.startsWith('/') ||
    req.url.startsWith(environment.apiBaseUrl);

  const stamped = isApi && !req.withCredentials
    ? req.clone({ withCredentials: true })
    : req;

  return next(stamped).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        return throwError(() => apiErrorFrom(err));
      }
      return throwError(() => err);
    }),
  );
};
