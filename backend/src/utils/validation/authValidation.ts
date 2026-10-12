/**
 * Hand-rolled validators for the Auth resource — HD-018.
 *
 * HD-018 ships `validateChangePasswordBody` for PATCH /api/auth/me/password.
 *
 * The controller calls this directly; on any failure it throws
 * `HttpError(400, 'validation_error', ..., fields)` so the central
 * errorHandler emits the 400 + per-field error map the frontend
 * maps 1-to-1 onto its per-field error signals.
 *
 * Mirrors the conventions in `ticketValidation.ts` (no zod/joi per
 * the HD-003 precedent — small dep footprint).
 */

import { HttpError } from '../errors';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

const NEW_PASSWORD_MIN = 8;
const NEW_PASSWORD_MAX = 128;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate the body of PATCH /api/auth/me/password (HD-018).
 *
 * Body shape: `{ currentPassword: string, newPassword: string }` where
 *   - `currentPassword` is required, non-empty (any value, even
 *     short / no-format, is OK — the controller checks it against
 *     the stored hash with bcrypt)
 *   - `newPassword` is required, 8..128 chars, and must contain at
 *     least one letter and at least one digit (basic complexity
 *     policy; matches the existing "≥8 chars + ≥1 letter + ≥1
 *     number" pattern that admin-managed users would expect)
 *
 * Field-level errors map to the corresponding form fields on the
 * Change Password page.
 */
export function validateChangePasswordBody(
  body: unknown,
): ChangePasswordInput {
  const fields: Record<string, string> = {};

  if (!isPlainObject(body)) {
    throw new HttpError(
      400,
      'validation_error',
      'Please correct the highlighted fields.',
      { _body: 'Request body must be a JSON object.' },
    );
  }

  // Reject unknown keys — keeps the endpoint honest about what it
  // accepts and matches the partial-PATCH / comment discipline
  // already established in ticketValidation.ts.
  for (const key of Object.keys(body)) {
    if (key !== 'currentPassword' && key !== 'newPassword') {
      fields._body = `Unknown field "${key}". Allowed: currentPassword, newPassword.`;
      break;
    }
  }

  const currentRaw = body.currentPassword;
  if (typeof currentRaw !== 'string' || currentRaw.length === 0) {
    fields.currentPassword = 'Enter your current password.';
  }

  const newRaw = body.newPassword;
  if (typeof newRaw !== 'string' || newRaw.length === 0) {
    fields.newPassword = 'Enter a new password.';
  } else {
    if (newRaw.length < NEW_PASSWORD_MIN) {
      fields.newPassword = `New password must be at least ${NEW_PASSWORD_MIN} characters.`;
    } else if (newRaw.length > NEW_PASSWORD_MAX) {
      fields.newPassword = `New password must be ${NEW_PASSWORD_MAX} characters or fewer.`;
    } else if (!/[A-Za-z]/.test(newRaw)) {
      fields.newPassword = 'New password must include a letter.';
    } else if (!/[0-9]/.test(newRaw)) {
      fields.newPassword = 'New password must include a number.';
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new HttpError(
      400,
      'validation_error',
      'Please correct the highlighted fields.',
      fields,
    );
  }

  return {
    currentPassword: currentRaw as string,
    newPassword: newRaw as string,
  };
}
