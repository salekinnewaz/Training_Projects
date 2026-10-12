/**
 * Typed API error — HD-004 + HD-005 + HD-018 + HD-019 + D4.
 *
 * The backend `errorHandler` middleware (HD-003) emits bodies of
 * shape:
 *   { error: <code>, message: <human>, [fields]: { field: <human> } }
 *
 * This module wraps `HttpErrorResponse` so service callers (AuthService
 * now, login page in HD-005) can switch on a typed `errorCode`
 * rather than scraping the message.
 *
 * `apiErrorFrom` is **idempotent** — if the input is already an
 * `ApiError` (because the auth interceptor converted upstream), it
 * hands the same instance back. This is what makes the
 * "interceptor converts + service calls `apiErrorFrom` defensively"
 * pattern safe; without the short-circuit, a 401
 * `invalid_credentials` from the login endpoint would be
 * downgraded to a generic 401 `unauthenticated` by the second
 * call, which is what made the HD-005 login page render
 * "Something went wrong" instead of "Email or password is
 * incorrect" in production until the fix landed here. Pinned by
 * the `api-error.spec.ts` regression test.
 *
 * D4 added the `rate_limited` member (alphabetical position) +
 * a 429 arm in `mapStatusToCode`. The backend's login rate
 * limiter emits `{ error: 'rate_limited', message: 'Too many
 * attempts. Please wait a moment.' }`; the login page picks it
 * up in `applyApiError` and renders the same constant under the
 * password field. The 429 arm in `mapStatusToCode` is the
 * fallback path (for when the body is missing or malformed);
 * the normal code path goes through `explicit`.
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
  | 'file_too_large'
  | 'unsupported_media_type'
  | 'storage_missing'
  | 'storage_failed'
  | 'rate_limited'
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
    if (typeof v === 'string') {
      out[k] = v;
    } else if (v !== null && v !== undefined) {
      // Tripwire (D5): the backend doesn't emit non-string
      // field values today. If this branch ever fires, the
      // server has changed its error envelope — likely to a
      // `string[]` for per-field multi-message cases — and the
      // `ApiError.fields` type (Record<string, string>) is
      // silently dropping data. Log so the regression is loud
      // in dev / CI; the type is preserved for now (D5
      // deferred note: "revisit if backend starts emitting
      // array field messages"). See
      // `_bmad-output/implementation-artifacts/spec-d5-asFieldMap-tripwire.md`.
      // eslint-disable-next-line no-console
      console.warn(
        `[api-error] dropping non-string field "${String(k)}" (type=${typeof v}); ` +
        `ApiError.fields is Record<string, string> and will not surface arrays.`,
      );
    }
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
export function apiErrorFrom(err: HttpErrorResponse | ApiError): ApiError {
  // Idempotent: if the caller already converted via the auth
  // interceptor (or any other layer that does this conversion
  // first), hand the existing ApiError straight back. Without
  // this short-circuit, the service-layer `catch (err) { throw
  // apiErrorFrom(err) }` defensive wrapper would re-read the
  // ApiError's `.error` and `.status` fields, miss the
  // `.errorCode` we already set, and downgrade an
  // `invalid_credentials` 401 to a `unauthenticated` /
  // `unknown_error` 401 — which is what made the HD-005
  // login page show the generic "Something went wrong" copy
  // on a wrong-password attempt when the auth interceptor was
  // registered (i.e. in production).
  if (err instanceof ApiError) {
    return err;
  }

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
  if (status === 429) return 'rate_limited';
  if (status === 501) return 'not_implemented';
  if (status >= 500) return 'internal_server_error';
  return 'unknown_error';
}
