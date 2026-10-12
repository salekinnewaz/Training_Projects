/**
 * Attachment service — HD-016.
 *
 * Two helpers used by the attachments controller:
 *
 *   - `createAttachment(input)` — inserts the metadata row,
 *     writes the bytes to permanent storage, updates the row
 *     with the final `storage_path`. Wraps in a try/catch that
 *     removes the row on storage failure so we never have an
 *     attachment row pointing at a file that doesn't exist.
 *
 *   - `getAttachmentForUser(id, userId, role)` — same
 *     enumeration protection as `getTicketForUser` in
 *     `ticketService.ts`: a User can only fetch an attachment
 *     that's on one of their own tickets; Support Agent / Admin
 *     can fetch any. Mirrors the design contract that an
 *     attachment is part of the ticket (no separate ACL surface).
 *
 * Why a service and not inline in the controller? The
 * controller is the request/response boundary — it parses
 * multipart, sets headers, maps multer errors. The service is
 * the data boundary — it owns the row lifecycle and the
 * storage dance. This split mirrors every other
 * controller/service pair in the codebase (tickets, users,
 * admin).
 */

import { Attachment, Ticket } from '../models';
import { HttpError } from '../utils/errors';
import { attachmentStorage } from '../utils/attachmentStorage';

export interface CreateAttachmentInput {
  filename: string;
  sizeBytes: number;
  mimetype: string;
  uploadedById: number;
  /**
   * Either an in-memory buffer (multer.memoryStorage) or a
   * temp file path (multer.diskStorage). The service handles
   * both — the storage abstraction is the seam.
   */
  source: { buffer: Buffer } | { path: string };
}

/**
 * Insert a new attachment row, persist the bytes, and return
 * the saved row. The returned object has `storagePath` set
 * to the final on-disk path.
 *
 * On storage failure the row is deleted (best-effort) so
 * callers don't have to worry about orphaned metadata.
 */
export async function createAttachment(
  input: CreateAttachmentInput,
): Promise<Attachment> {
  // 1. Insert the row first to get the PK. The `storage_path`
  //    is initially empty; we update it after the file write
  //    so the row is never visible to readers with a broken
  //    path.
  const row = await Attachment.create({
    filename: input.filename,
    sizeBytes: input.sizeBytes,
    mimetype: input.mimetype,
    storagePath: '',
    uploadedById: input.uploadedById,
  });

  try {
    const storagePath = await attachmentStorage.put(
      row.id,
      input.filename,
      input.source,
    );
    await row.update({ storagePath });
    return row;
  } catch (err) {
    // Storage failed. Best-effort: delete the row so the
    // caller doesn't see a phantom attachment. The buffer
    // / temp file (if any) is GC'd by V8 / multer respectively.
    await row.destroy().catch((destroyErr) => {
      console.error(
        '[attachmentService] failed to delete row after storage failure:',
        destroyErr,
      );
    });
    throw new HttpError(
      500,
      'storage_failed',
      'Failed to save the uploaded file. Try again.',
    );
  }
}

/**
 * Fetch an attachment, applying the same enumeration
 * protection as `getTicketForUser` in ticketService.ts.
 *
 * A User who isn't the submitter of the ticket carrying the
 * attachment gets a 404 — same shape as a missing ticket, so
 * they can't probe by id. Support Agent / Admin see any
 * attachment.
 *
 * The `Ticket → Attachment` association is the right
 * direction: `Ticket.attachmentId` is the FK, so we look up
 * any ticket that points at this attachment and check the
 * caller is the submitter. No reverse association exists in
 * the model graph.
 */
export async function getAttachmentForUser(
  attachmentId: number,
  userId: number,
  role: 'User' | 'Support Agent' | 'Admin',
): Promise<Attachment> {
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    throw new HttpError(
      400,
      'validation_error',
      'Attachment id must be a positive integer.',
    );
  }

  const attachment = await Attachment.findByPk(attachmentId);
  if (!attachment) {
    throw new HttpError(404, 'not_found', 'Attachment not found.');
  }

  if (role === 'User') {
    // Find any ticket that links to this attachment and is
    // submitted by the caller. If none, treat as 404
    // (enumeration protection).
    const ownTicket = await Ticket.findOne({
      where: { attachmentId, submitterId: userId },
      attributes: ['id'],
    });
    if (!ownTicket) {
      throw new HttpError(404, 'not_found', 'Attachment not found.');
    }
  }

  return attachment;
}
