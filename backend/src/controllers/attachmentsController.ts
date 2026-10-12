/**
 * Attachments controller — HD-016.
 *
 * Two endpoints:
 *
 *   POST /api/attachments — multipart upload. Returns 201 with
 *     `{ id, filename, sizeBytes, mimetype }` (the wire shape
 *     the frontend `AttachmentService.upload` declares). The
 *     caller is the JWT'd user; the file is stored under
 *     `backend/uploads/<id>-<filename>`.
 *
 *   GET /api/attachments/:id — streams the file back with the
 *     correct Content-Type + Content-Length + Content-Disposition.
 *     Same enumeration protection as the ticket download: a
 *     User can only fetch an attachment that's on a ticket
 *     they submitted; Support Agent / Admin can fetch any.
 *
 * Multer is configured with `memoryStorage` (the file sits in
 * a `Buffer` on `req.file.buffer`) and a 10 MB cap. The file
 * filter consults `ALLOWED_MIMETYPES`; anything else is
 * rejected with a `MulterError('LIMIT_UNEXPECTED_FILE')`
 * which the controller catches and re-throws as
 * `HttpError(415, 'unsupported_media_type', ...)` so the
 * frontend can render the same error envelope it does for
 * every other 4xx.
 *
 * The size cap is enforced by multer; when it trips, multer
 * throws `MulterError('LIMIT_FILE_SIZE')` which the controller
 * re-throws as `HttpError(413, 'file_too_large', ...)`.
 */

import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';

import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/errors';
import { attachmentStorage } from '../utils/attachmentStorage';
import {
  createAttachment,
  getAttachmentForUser,
} from '../services/attachmentService';

/**
 * Allowed MIME types for attachment uploads. Conservative
 * allowlist per the Phase 6 kickoff: images, PDF, plain text,
 * zip. Future stories can extend (e.g. docx, xlsx) without
 * changing the controller.
 */
const ALLOWED_MIMETYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/zip',
]);

/**
 * Multer middleware: in-memory storage, 10 MB cap, mimetype
 * allowlist. The error handling for the cap and the filter
 * lives in the controller (see `runUpload`) so we can map
 * multer's `MulterError` codes to our typed `HttpError`
 * envelopes.
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      // Reject with a `LIMIT_UNEXPECTED_FILE`-shaped error.
      // Multer doesn't have a dedicated mimetype code, so we
      // piggyback on the closest one and translate in the
      // controller.
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    }
  },
}).single('file');

/**
 * Wraps `uploadMiddleware` in a try/catch so multer's
 * `MulterError` codes map to typed `HttpError` envelopes.
 * Without this, multer errors fall through to the central
 * error handler as plain `Error` and the response would be
 * an unhelpful 500.
 *
 * Idempotent: if `req.file` is already populated (e.g. the
 * route-level `uploadMiddleware` ran before this controller,
 * which is the production wiring in `routes/attachments.ts`),
 * we skip the second multer call. Without this guard, multer
 * would re-parse the same request and either no-op (silently
 * dropping `req.file`) or fail (mismatched multipart). This
 * also makes the controller unit-testable by letting the test
 * inject a synthetic `req.file` without setting up a real
 * multipart body.
 */
function runUpload(req: Request, res: Response): Promise<void> {
  if (req.file) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          reject(
            new HttpError(
              413,
              'file_too_large',
              'File is larger than 10 MB. Pick a smaller file.',
            ),
          );
          return;
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          reject(
            new HttpError(
              415,
              'unsupported_media_type',
              'This file type is not allowed.',
            ),
          );
          return;
        }
      }
      // Non-multer error (or no error): forward to the
      // next middleware. The `asyncHandler` wrapper catches
      // thrown errors and routes to the central error handler.
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Serialize an attachment row to the public wire shape.
 * Mirrors the per-controller serializer pattern (the
 * codebase deliberately keeps these small and per-file —
 * see `adminController.ts:21-25` for the rationale).
 */
function serializeAttachment(att: {
  id: number;
  filename: string;
  sizeBytes: number;
  mimetype: string;
}): { id: number; filename: string; sizeBytes: number; mimetype: string } {
  return {
    id: att.id,
    filename: att.filename,
    sizeBytes: att.sizeBytes,
    mimetype: att.mimetype,
  };
}

/**
 * POST /api/attachments — upload a single file (multipart).
 *
 * Request: `multipart/form-data` with one field `file` ≤ 10 MB
 * and mimetype in `ALLOWED_MIMETYPES`.
 *
 * Response: 201 with `{ id, filename, sizeBytes, mimetype }`.
 * The row's `storagePath` is internal — never returned.
 */
/**
 * @openapi
 * /attachments:
 *   post:
 *     summary: Upload an attachment
 *     description: |
 *       Multipart upload of a single file ≤ 10 MB with a
 *       mimetype from the server's allowlist. Returns the
 *       `attachmentId` to be set on the subsequent
 *       `POST /tickets` call (two-step flow per design doc).
 *
 *       Allowlist: `image/png`, `image/jpeg`, `image/gif`,
 *       `application/pdf`, `text/plain`, `application/zip`.
 *     tags: [Attachments]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Uploaded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttachmentUploadResponse'
 *       400:
 *         description: No file in the request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorBody'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       413:
 *         $ref: '#/components/responses/PayloadTooLarge'
 *       415:
 *         $ref: '#/components/responses/UnsupportedMediaType'
 */
export const uploadHandler = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      await runUpload(req, res);
    } catch (err) {
      // Re-throw to the central error handler. `runUpload`
      // already wraps multer errors as `HttpError`.
      throw err;
    }

    if (!req.file) {
      // The middleware succeeded but no file arrived —
      // multer's `fileFilter` would have caught a bad
      // mimetype, so this is the "missing file" case.
      throw new HttpError(
        400,
        'validation_error',
        'No file uploaded. Pick a file and try again.',
        { file: 'required' },
      );
    }

    const actor = req.user!;
    const row = await createAttachment({
      filename: req.file.originalname,
      sizeBytes: req.file.size,
      mimetype: req.file.mimetype,
      uploadedById: actor.id,
      source: { buffer: req.file.buffer },
    });

    res.status(201).json(serializeAttachment(row));
  },
);

/**
 * GET /api/attachments/:id — stream the file back.
 *
 * Response: 200 with the file bytes, Content-Type from the
 * row's `mimetype`, Content-Length from the file stat,
 * Content-Disposition: attachment; filename="<sanitized>".
 *
 * Errors: 400 invalid id; 401 (handled by authMiddleware
 * upstream); 403 (User not the submitter, 404 to avoid
 * enumeration); 404 missing row; 500 storage_missing.
 */
/**
 * @openapi
 * /attachments/{id}:
 *   get:
 *     summary: Download an attachment
 *     description: |
 *       Streams the attachment bytes back with the row's
 *       `mimetype` as `Content-Type`, the file size as
 *       `Content-Length`, and a sanitized `Content-Disposition`.
 *
 *       Enumeration protection (mirrors the ticket download):
 *       a User can only fetch an attachment that's on a
 *       ticket they submitted. Support Agent / Admin can
 *       fetch any. Unauthorized fetches return 404, not 403,
 *       so an attacker can't probe for the existence of
 *       attachments they don't own.
 *     tags: [Attachments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Attachment row id.
 *     responses:
 *       200:
 *         description: |
 *           File bytes. The response body is the raw file
 *           content; the schema below describes the
 *           response *headers*.
 *         headers:
 *           Content-Type:
 *             schema:
 *               type: string
 *               example: application/pdf
 *           Content-Length:
 *             schema:
 *               type: integer
 *               example: 1048576
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: 'attachment; filename="screenshot.png"'
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: 'private, max-age=3600'
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid id.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorBody'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         description: |
 *           File metadata exists but the bytes are missing
 *           on disk (orphan from a botched cleanup).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *             example:
 *               error: storage_missing
 *               message: File metadata exists but the bytes are missing on disk.
 */
export const downloadHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      throw new HttpError(
        400,
        'validation_error',
        'Attachment id must be a positive integer.',
      );
    }

    const actor = req.user!;
    const attachment = await getAttachmentForUser(id, actor.id, actor.role);

    let streamResult;
    try {
      streamResult = await attachmentStorage.getStream(
        attachment.storagePath,
      );
    } catch (err) {
      if (
        err instanceof Error &&
        'code' in err &&
        (err as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        throw new HttpError(
          500,
          'storage_missing',
          'File metadata exists but the bytes are missing on disk.',
        );
      }
      throw err;
    }

    // Sanitize the filename for Content-Disposition: strip
    // CR / LF / `"` so a malicious filename can't inject
    // header content.
    const safeFilename = attachment.filename
      .replace(/[\r\n"\\]/g, '_')
      .slice(0, 200);

    res.setHeader('Content-Type', attachment.mimetype);
    res.setHeader('Content-Length', streamResult.sizeBytes);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeFilename}"`,
    );
    // Cache-Control: private (don't share across users) +
    // 1h (matches JWT expiry).
    res.setHeader('Cache-Control', 'private, max-age=3600');
    streamResult.stream.pipe(res);
  },
);
