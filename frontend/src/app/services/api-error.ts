/**
 * Typed API error — HD-004.
 *
 * The backend `errorHandler` middleware (HD-003) emits bodies of
 * shape:
 *   { error: <code>, message: <human>, [fields]: { field: <human> } }
 *
 * This module wraps `HttpErrorResponse` so service callers (AuthService
 * now, login page in HD-005) can switch on a typed `errorCode`
 * rather than scraping the message.
 */

import { HttpErrorResponse } from '@angular/common/http';

/** Server's `error` field. Extend as new codes are introduced. */
export type ApiErrorCode =
  | 'validation_error'
  | 'invalid_credentials'
  | 'account_inactive'
  | 'unauthenticated'
  | 'invalid_token'
  | 'forbidden'
  | 'not_found'
  | 'not_implemented'
  | 'internal_server_error'
  | 'network_error'
  | 'unknown_error';

interface RawApiErrorBody {
  error?: unknown;
  message?: unknown;
  fields?: unknown;
}

function readBody(err: HttpErrorResponse): RawApiErrorBody {
  // HttpErrorResponse.error is `any` per Angular's types. Body may be
  // a parsed object or a string (when the server returns plain text).
  const body = err.error;
  if (body && typeof body === 'object') {
    return body as RawApiErrorBody;
  }
  return {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asFieldMap(
  value: unknown,
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: ApiErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Coerce an HttpErrorResponse into a typed ApiError. */
export function apiErrorFrom(err: HttpErrorResponse): ApiError {
  const body = readBody(err);
  const message =
    asString(body.message) ?? err.message ?? 'Request failed.';
  const fields = asFieldMap(body.fields);
  const explicit = asString(body.error);

  if (err.status === 0) {
    // Status 0 = network failure (CORS preflight reject, offline, etc.)
    return new ApiError(
      0,
      'network_error',
      'Could not reach the server. Check your connection.',
    );
  }

  const errorCode = (explicit ?? mapStatusToCode(err.status)) as ApiErrorCode;
  return new ApiError(err.status, errorCode, message, fields);
}

function mapStatusToCode(status: number): ApiErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 501) return 'not_implemented';
  if (status >= 500) return 'internal_server_error';
  return 'unknown_error';
}
