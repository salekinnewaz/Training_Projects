/**
 * Hand-rolled validators for the Ticket resource — HD-008 + HD-010.
 *
 * HD-008 ships `validateCreateTicketBody`. HD-010 (Ticket Detail)
 * adds two more:
 *   - `validateUpdateTicketBody` — partial updates for PATCH /:id.
 *     Any subset of {status, priority, category, ownerId}; at least
 *     one must be present. Unknown keys are rejected with a
 *     `validation_error.fields._body` entry. Per-field enum
 *     membership is checked against the MySQL ENUMs declared in
 *     `models/Ticket.ts`.
 *   - `validateAddCommentBody` — `{ body: string }` with the
 *     trimmed-length floor (1) and cap (5000).
 *
 * The controller calls these directly; on any failure they throw
 * `HttpError(400, 'validation_error', ..., fields)` so the central
 * errorHandler emits the 400 + per-field error map the frontend maps
 * 1-to-1 onto its per-field error signals.
 *
 * The repo deliberately avoids zod / joi (HD-003/HD-007 precedent) so
 * the dependency footprint stays small. Type checks + range checks +
 * enum membership are sufficient for this single endpoint; future
 * validators follow the same shape.
 */

import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../models/Ticket';
import { HttpError } from '../errors';

export interface CreateTicketInput {
  title: string;
  description: string;
  category: TicketCategory | null;
  priority: TicketPriority;
  attachmentId: number | null;
}

/**
 * The validated, partial PATCH body. Every field is optional — the
 * controller (and validator) only assert at least one key was
 * supplied, then perform the per-field enum checks. The service
 * uses the explicit `actorRole` to enforce the "User can only edit
 * category" rule, which lives in the controller, not here.
 */
export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory | null;
  ownerId?: number | null;
}

export interface AddCommentInput {
  body: string;
}

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;
const COMMENT_MAX = 5000;

const CATEGORY_VALUES: readonly TicketCategory[] = [
  'IT',
  'HR',
  'Finance',
  'General',
];
const PRIORITY_VALUES: readonly TicketPriority[] = ['Low', 'Medium', 'High'];
const STATUS_VALUES: readonly TicketStatus[] = [
  'Open',
  'In Progress',
  'Resolved',
  'Closed',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validate the body of POST /api/tickets. Returns a typed
 * `CreateTicketInput` ready to hand to the service. On any failure
 * throws `HttpError(400, 'validation_error', ..., fields)` so the
 * central handler can convert it to a 400 response.
 *
 * `category` and `attachmentId` are optional in the body. When omitted
 * (or explicitly null/empty for category) they normalize to `null` on
 * the returned object — the Ticket model allows both columns to be
 * nullable.
 */
export function validateCreateTicketBody(
  body: unknown,
): CreateTicketInput {
  const fields: Record<string, string> = {};

  if (!isPlainObject(body)) {
    throw new HttpError(
      400,
      'validation_error',
      'Please correct the highlighted fields.',
      { _body: 'Request body must be a JSON object.' },
    );
  }

  // ── title ────────────────────────────────────────────────────────
  const titleRaw = body.title;
  if (!isNonEmptyString(titleRaw)) {
    fields.title = 'Enter a title.';
  } else if (titleRaw.length > TITLE_MAX) {
    fields.title = 'Keep the title under 120 characters.';
  }

  // ── description ──────────────────────────────────────────────────
  const descriptionRaw = body.description;
  if (!isNonEmptyString(descriptionRaw)) {
    fields.description = 'Describe the issue.';
  } else if (descriptionRaw.length > DESCRIPTION_MAX) {
    fields.description = 'Description is limited to 5000 characters.';
  }

  // ── category (optional) ──────────────────────────────────────────
  let category: TicketCategory | null = null;
  const categoryRaw = body.category;
  if (
    categoryRaw !== undefined &&
    categoryRaw !== null &&
    categoryRaw !== ''
  ) {
    if (
      typeof categoryRaw !== 'string' ||
      !CATEGORY_VALUES.includes(categoryRaw as TicketCategory)
    ) {
      fields.category =
        "Category must be one of: IT, HR, Finance, General.";
    } else {
      category = categoryRaw as TicketCategory;
    }
  }

  // ── priority (required, literal enum) ────────────────────────────
  const priorityRaw = body.priority;
  if (
    typeof priorityRaw !== 'string' ||
    !PRIORITY_VALUES.includes(priorityRaw as TicketPriority)
  ) {
    fields.priority = "Priority must be one of: Low, Medium, High.";
  }

  // ── attachmentId (optional) ──────────────────────────────────────
  let attachmentId: number | null = null;
  const attachmentRaw = body.attachmentId;
  if (attachmentRaw !== undefined && attachmentRaw !== null) {
    if (
      typeof attachmentRaw !== 'number' ||
      !Number.isInteger(attachmentRaw) ||
      attachmentRaw <= 0
    ) {
      fields.attachmentId = 'Attachment id must be a positive integer.';
    } else {
      attachmentId = attachmentRaw;
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
    title: titleRaw as string,
    description: descriptionRaw as string,
    category,
    priority: priorityRaw as TicketPriority,
    attachmentId,
  };
}

/**
 * Validate the body of PATCH /api/tickets/:id (HD-010).
 *
 * Permitted keys: `status`, `priority`, `category`, `ownerId`.
 * Any other key produces a `_body` field error so callers can't
 * smuggle unknowns past us.
 *
 * At least one recognized key must be present — an empty body
 * returns 400 validation_error with `_body: 'Provide at least
 * one field to update.'`.
 *
 * Per-field rules:
 *   - `status`     ∈ {Open, In Progress, Resolved, Closed}
 *   - `priority`   ∈ {Low, Medium, High}
 *   - `category`   ∈ {IT, HR, Finance, General} OR null (to clear)
 *   - `ownerId`    positive integer OR null (to unassign)
 *
 * Role-gate (only Support Agent / Admin may edit status / priority
 * / ownerId) is NOT enforced here — that's the controller's job,
 * where it can use `req.user.role`. This validator only knows
 * about field shape.
 */
export function validateUpdateTicketBody(body: unknown): UpdateTicketInput {
  const fields: Record<string, string> = {};

  if (!isPlainObject(body)) {
    throw new HttpError(
      400,
      'validation_error',
      'Please correct the highlighted fields.',
      { _body: 'Request body must be a JSON object.' },
    );
  }

  const ALLOWED_KEYS = ['status', 'priority', 'category', 'ownerId'];
  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.includes(key)) {
      fields._body = `Unknown field "${key}". Allowed: ${ALLOWED_KEYS.join(', ')}.`;
      break;
    }
  }

  // ── status (optional) ────────────────────────────────────────────
  let statusValue: TicketStatus | undefined;
  const statusRaw = body.status;
  if (statusRaw !== undefined) {
    if (
      typeof statusRaw !== 'string' ||
      !STATUS_VALUES.includes(statusRaw as TicketStatus)
    ) {
      fields.status =
        'Status must be one of: Open, In Progress, Resolved, Closed.';
    } else {
      statusValue = statusRaw as TicketStatus;
    }
  }

  // ── priority (optional) ──────────────────────────────────────────
  let priorityValue: TicketPriority | undefined;
  const priorityRaw = body.priority;
  if (priorityRaw !== undefined) {
    if (
      typeof priorityRaw !== 'string' ||
      !PRIORITY_VALUES.includes(priorityRaw as TicketPriority)
    ) {
      fields.priority = "Priority must be one of: Low, Medium, High.";
    } else {
      priorityValue = priorityRaw as TicketPriority;
    }
  }

  // ── category (optional, nullable) ────────────────────────────────
  let categoryValue: TicketCategory | null | undefined;
  const categoryRaw = body.category;
  if (categoryRaw !== undefined) {
    if (categoryRaw === null || categoryRaw === '') {
      categoryValue = null;
    } else if (
      typeof categoryRaw !== 'string' ||
      !CATEGORY_VALUES.includes(categoryRaw as TicketCategory)
    ) {
      fields.category =
        'Category must be one of: IT, HR, Finance, General, or null.';
    } else {
      categoryValue = categoryRaw as TicketCategory;
    }
  }

  // ── ownerId (optional, nullable, positive integer) ───────────────
  let ownerIdValue: number | null | undefined;
  const ownerRaw = body.ownerId;
  if (ownerRaw !== undefined) {
    if (ownerRaw === null) {
      ownerIdValue = null;
    } else if (
      typeof ownerRaw !== 'number' ||
      !Number.isInteger(ownerRaw) ||
      ownerRaw <= 0
    ) {
      fields.ownerId = 'Owner id must be a positive integer or null.';
    } else {
      ownerIdValue = ownerRaw;
    }
  }

  // At least one field must be supplied (after the unknown-key check,
  // which uses _body as its own error key).
  if (
    statusValue === undefined &&
    priorityValue === undefined &&
    categoryValue === undefined &&
    ownerIdValue === undefined &&
    !fields._body
  ) {
    fields._body = 'Provide at least one field to update.';
  }

  if (Object.keys(fields).length > 0) {
    throw new HttpError(
      400,
      'validation_error',
      'Please correct the highlighted fields.',
      fields,
    );
  }

  const out: UpdateTicketInput = {};
  if (statusValue !== undefined) out.status = statusValue;
  if (priorityValue !== undefined) out.priority = priorityValue;
  if (categoryValue !== undefined) out.category = categoryValue;
  if (ownerIdValue !== undefined) out.ownerId = ownerIdValue;
  return out;
}

/**
 * Validate the body of POST /api/tickets/:id/comments (HD-010).
 *
 * Body shape: `{ body: string }` where the trimmed string is
 * 1..5000 chars. Empty / whitespace-only / non-string / missing
 * body produces a `fields.body` error.
 */
export function validateAddCommentBody(body: unknown): AddCommentInput {
  const fields: Record<string, string> = {};

  if (!isPlainObject(body)) {
    throw new HttpError(
      400,
      'validation_error',
      'Please correct the highlighted fields.',
      { _body: 'Request body must be a JSON object.' },
    );
  }

  // Reject unknown keys — keeps the comment endpoint honest about
  // what it accepts and matches the partial-PATCH discipline.
  for (const key of Object.keys(body)) {
    if (key !== 'body') {
      fields._body = `Unknown field "${key}". Allowed: body.`;
      break;
    }
  }

  const raw = body.body;
  if (typeof raw !== 'string') {
    fields.body = 'Comment body is required.';
  } else {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      fields.body = 'Comment body is required.';
    } else if (raw.length > COMMENT_MAX) {
      fields.body = 'Comment is limited to 5000 characters.';
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

  return { body: (raw as string).trim() };
}