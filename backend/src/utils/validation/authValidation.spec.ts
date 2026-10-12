/**
 * authValidation — unit spec (HD-018).
 *
 * Pins every documented failure mode of `validateChangePasswordBody`
 * plus the happy path. The validator is a pure function so no
 * model / service / controller to mock — just import + call + assert.
 *
 * Mirrors the structure of `ticketValidation.spec.ts`.
 */

import { HttpError } from '../errors';
import {
  validateChangePasswordBody,
  type ChangePasswordInput,
} from './authValidation';

function expectHttpError(
  fn: () => unknown,
  predicate: (err: HttpError) => boolean,
): HttpError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(HttpError);
    const httpErr = err as HttpError;
    expect(predicate(httpErr)).toBe(true);
    return httpErr;
  }
  throw new Error('expected validateChangePasswordBody to throw');
}

describe('validateChangePasswordBody', () => {
  it('returns a normalized input on the happy path', () => {
    const result: ChangePasswordInput = validateChangePasswordBody({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    });
    expect(result).toEqual({
      currentPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    });
  });

  it('rejects a non-object body (array) with fields._body = "Request body must be a JSON object."', () => {
    expectHttpError(
      () => validateChangePasswordBody([]),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?._body === 'Request body must be a JSON object.',
    );
  });

  it('rejects a null body with fields._body = "Request body must be a JSON object."', () => {
    expectHttpError(
      () => validateChangePasswordBody(null),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?._body === 'Request body must be a JSON object.',
    );
  });

  it('rejects a missing currentPassword with fields.currentPassword = "Enter your current password."', () => {
    expectHttpError(
      () => validateChangePasswordBody({ newPassword: 'newPassword456' }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.currentPassword === 'Enter your current password.',
    );
  });

  it('rejects a non-string currentPassword with fields.currentPassword = "Enter your current password."', () => {
    expectHttpError(
      () =>
        validateChangePasswordBody({
          currentPassword: 42,
          newPassword: 'newPassword456',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.currentPassword === 'Enter your current password.',
    );
  });

  it('rejects a missing newPassword with fields.newPassword = "Enter a new password."', () => {
    expectHttpError(
      () =>
        validateChangePasswordBody({ currentPassword: 'oldPassword123' }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.newPassword === 'Enter a new password.',
    );
  });

  it('rejects a non-string newPassword with fields.newPassword = "Enter a new password."', () => {
    expectHttpError(
      () =>
        validateChangePasswordBody({
          currentPassword: 'oldPassword123',
          newPassword: 12345678,
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.newPassword === 'Enter a new password.',
    );
  });

  it('rejects a newPassword under 8 chars with the "at least 8 characters" message', () => {
    expectHttpError(
      () =>
        validateChangePasswordBody({
          currentPassword: 'oldPassword123',
          newPassword: 'short1A',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.newPassword ===
          'New password must be at least 8 characters.',
    );
  });

  it('accepts a newPassword at exactly 8 chars (boundary)', () => {
    const result = validateChangePasswordBody({
      currentPassword: 'oldPassword123',
      newPassword: 'abcd1234',
    });
    expect(result.newPassword).toBe('abcd1234');
  });

  it('rejects a newPassword over 128 chars with the "128 characters or fewer" message', () => {
    const tooLong = 'a1' + 'a'.repeat(127);
    expectHttpError(
      () =>
        validateChangePasswordBody({
          currentPassword: 'oldPassword123',
          newPassword: tooLong,
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.newPassword ===
          'New password must be 128 characters or fewer.',
    );
  });

  it('rejects a newPassword with no letter with the "include a letter" message', () => {
    expectHttpError(
      () =>
        validateChangePasswordBody({
          currentPassword: 'oldPassword123',
          newPassword: '12345678',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.newPassword === 'New password must include a letter.',
    );
  });

  it('rejects a newPassword with no number with the "include a number" message', () => {
    expectHttpError(
      () =>
        validateChangePasswordBody({
          currentPassword: 'oldPassword123',
          newPassword: 'abcdefgh',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?.newPassword === 'New password must include a number.',
    );
  });

  it('rejects an unknown extra key with fields._body = "Unknown field ..."', () => {
    expectHttpError(
      () =>
        validateChangePasswordBody({
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456',
          email: 'attacker@evil.com',
        }),
      (err) =>
        err.status === 400 &&
        err.errorCode === 'validation_error' &&
        err.fields?._body ===
          'Unknown field "email". Allowed: currentPassword, newPassword.',
    );
  });
});
