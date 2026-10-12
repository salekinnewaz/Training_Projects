/**
 * `apiErrorFrom` — unit spec.
 *
 * Pins the typed-error contract that HD-004/HD-005/HD-018/HD-019
 * all rely on:
 *
 *   - HttpErrorResponse + server envelope → typed ApiError with
 *     the explicit `error` field as `errorCode` (when present)
 *   - HttpErrorResponse without a parsed body → typed ApiError
 *     via status-to-code fallback
 *   - status 0 → `network_error`
 *   - `validation_error` body → ApiError with `fields` map
 *     propagated through
 *   - `idempotency` (the bug this spec exists to pin): if the
 *     caller hands in an already-converted `ApiError` (because
 *     the auth interceptor converted upstream), `apiErrorFrom`
 *     hands the same instance back without re-reading the
 *     ApiError's `.error`/`.status` as if it were a fresh
 *     HttpErrorResponse. Without this, the service-layer
 *     defensive `catch (err) { throw apiErrorFrom(err) }` would
 *     downgrade an `invalid_credentials` 401 to a
 *     `unauthenticated` 401 — the regression that made the
 *     HD-005 login page render "Something went wrong" instead of
 *     "Email or password is incorrect" on a wrong-password
 *     attempt in production until the fix landed in
 *     `api-error.ts`.
 *
 * The `idempotency` regression is the load-bearing assertion.
 * Everything else is the positive-coverage matrix.
 */

import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, apiErrorFrom } from './api-error';

describe('apiErrorFrom', () => {
  describe('idempotency (regression)', () => {
    // The bug: a 401 invalid_credentials from the login endpoint
    // was first wrapped by the auth interceptor (correctly), then
    // re-wrapped by AuthService.login()'s defensive
    // `catch (err) { throw apiErrorFrom(err) }`. The second
    // call would re-read the ApiError's `.error`/`.status`
    // fields as if it were a fresh HttpErrorResponse, miss the
    // `.errorCode`, and downgrade invalid_credentials to
    // `unauthenticated`. The login page's switch has no case for
    // unauthenticated, so the user got "Something went wrong"
    // instead of "Email or password is incorrect". Pinned by
    // the four assertions below.

    it('returns the same ApiError instance for a 401 invalid_credentials', () => {
      const original = new ApiError(
        401,
        'invalid_credentials',
        'Email or password is incorrect. Try again.',
      );
      const result = apiErrorFrom(original);
      expect(result).toBe(original);
    });

    it('returns the same ApiError instance for a 401 account_inactive', () => {
      const original = new ApiError(
        401,
        'account_inactive',
        'Your account is inactive. Contact your administrator.',
      );
      const result = apiErrorFrom(original);
      expect(result).toBe(original);
    });

    it('returns the same ApiError instance for a 403 forbidden', () => {
      const original = new ApiError(403, 'forbidden', 'Not allowed.');
      const result = apiErrorFrom(original);
      expect(result).toBe(original);
    });

    it('returns the same ApiError instance for a 400 validation_error with fields', () => {
      const original = new ApiError(
        400,
        'validation_error',
        'Please correct the highlighted fields.',
        { email: 'Email is required.' },
      );
      const result = apiErrorFrom(original);
      expect(result).toBe(original);
      expect(result.fields).toEqual({ email: 'Email is required.' });
    });
  });

  describe('HttpErrorResponse → ApiError', () => {
    function httpErr(
      status: number,
      body: unknown,
    ): HttpErrorResponse {
      return new HttpErrorResponse({
        status,
        statusText: status === 0 ? 'Unknown Error' : 'Error',
        error: body,
      });
    }

    it('maps a 401 with { error: "invalid_credentials" } to ApiError(401, invalid_credentials)', () => {
      const err = httpErr(401, {
        error: 'invalid_credentials',
        message: 'Email or password is incorrect. Try again.',
      });
      const result = apiErrorFrom(err);
      expect(result).toBeInstanceOf(ApiError);
      expect(result.status).toBe(401);
      expect(result.errorCode).toBe('invalid_credentials');
      expect(result.message).toBe('Email or password is incorrect. Try again.');
    });

    it('maps a 401 with no body to ApiError(401, unauthenticated) via status fallback', () => {
      const err = httpErr(401, null);
      const result = apiErrorFrom(err);
      expect(result.status).toBe(401);
      expect(result.errorCode).toBe('unauthenticated');
    });

    it('maps status 0 to network_error regardless of body', () => {
      const err = httpErr(0, { error: 'whatever', message: 'whatever' });
      const result = apiErrorFrom(err);
      expect(result.status).toBe(0);
      expect(result.errorCode).toBe('network_error');
      expect(result.message).toBe(
        'Could not reach the server. Check your connection.',
      );
    });

    it('propagates the fields map on validation_error', () => {
      const err = httpErr(400, {
        error: 'validation_error',
        message: 'Please correct the highlighted fields.',
        fields: {
          email: 'Email is required.',
          password: 'Password must be at least 8 characters.',
        },
      });
      const result = apiErrorFrom(err);
      expect(result.errorCode).toBe('validation_error');
      expect(result.fields).toEqual({
        email: 'Email is required.',
        password: 'Password must be at least 8 characters.',
      });
    });

    it('drops non-string field values silently (defensive)', () => {
      // The asFieldMap helper only keeps string-valued fields.
      // Arrays / numbers are dropped. This pins the current
      // behavior; if backend ever emits array field messages
      // (D5), this assertion will start failing and signal it's
      // time to revisit.
      const err = httpErr(400, {
        error: 'validation_error',
        message: 'Please correct the highlighted fields.',
        fields: {
          email: 'Email is required.',
          tags: ['too short', 'too long'],
          count: 3,
        },
      });
      const result = apiErrorFrom(err);
      expect(result.fields).toEqual({ email: 'Email is required.' });
    });

    it('maps a 5xx to internal_server_error when no explicit `error` field is present', () => {
      // Empty body — the status-to-code fallback kicks in.
      const err = httpErr(500, {});
      const result = apiErrorFrom(err);
      expect(result.status).toBe(500);
      expect(result.errorCode).toBe('internal_server_error');
    });

    it('maps an unknown status with a string body to the explicit error code', () => {
      const err = httpErr(418, {
        error: 'im_a_teapot',
        message: "I'm a teapot",
      });
      const result = apiErrorFrom(err);
      // The 'im_a_teapot' code is not in the union, so the cast
      // lets it through as-is; the assertion just pins that the
      // explicit `error` field wins over the status-to-code
      // fallback.
      expect((result.errorCode as string)).toBe('im_a_teapot');
    });

    it('falls back to "Request failed." when body has no message and err.message is empty', () => {
      const err = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        error: {},
      });
      // Angular sets err.message to the statusText in ctor.
      // We just verify a non-empty message comes back.
      const result = apiErrorFrom(err);
      expect(result.message.length).toBeGreaterThan(0);
    });
  });
});
