/**
 * Hand-rolled validators for the Ticket resource — HD-008.
 *
 * HD-008 introduces the create flow (POST /api/tickets) and ships a
 * single validator, `validateCreateTicketBody`. The shape mirrors the
 * spec's ALWAYS constraint:
 *
 *   { title: string 1..120,
 *     description: string 1..5000,
 *     category?: 'IT'|'HR'|'Finance'|'General',
 *     priority: 'Low'|'Medium'|'High',
 *     attachmentId?: number }
 *
 * The controller calls this directly; on any failure it throws
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
} from '../../models/Ticket';
import { HttpError } from '../errors';

export interface CreateTicketInput {
  title: string;
  description: string;
  category: TicketCategory | null;
  priority: TicketPriority;
  attachmentId: number | null;
}

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;

const CATEGORY_VALUES: readonly TicketCategory[] = [
  'IT',
  'HR',
  'Finance',
  'General',
];
const PRIORITY_VALUES: readonly TicketPriority[] = ['Low', 'Medium', 'High'];

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