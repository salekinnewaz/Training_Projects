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
 * a `Buffer` on `req.file.buffer`) and an environment-derived
 * size cap (10 MB locally, 4 MB on Vercel — see
 * `MAX_UPLOAD_BYTES`). The file
 * filter consults `ALLOWED_MIMETYPES`; anything else is
 * rejected with a `MulterError('LIMIT_UNEXPECTED_FILE')`
 * which the controller catches and re-throws as
 * `HttpError(415, 'unsupported_media_type', ...)` so the
 * frontend can render the same error envelope it does for
 * every other 4xx.
 *
 * The size cap is enforced twice: from the `Content-Length`
 * header before multer buffers anything, and by multer's own
 * `fileSize` limit. When multer's trips, it throws
 * `MulterError('LIMIT_FILE_SIZE')` which the controller
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
 * The maximum upload size, in bytes.
 *
 * Derived from the environment so local dev and production can
 * differ without a code change:
 *
 *   - `MAX_UPLOAD_BYTES` — explicit override, wins over everything.
 *   - `VERCEL === '1'`   — 4 MB. Vercel rejects request bodies
 *     larger than 4.5 MB with an opaque platform 413
 *     (`FUNCTION_PAYLOAD_TOO_LARGE`) *before* the app sees
 *     them, so our own cap has to be lower than that limit or
 *     the client gets a platform error instead of our
 *     actionable one.
 *   - otherwise         — 10 MB, the documented MVP limit.
 */
export const MAX_UPLOAD_BYTES = resolveMaxUploadBytes();

function resolveMaxUploadBytes(): number {
  const raw = (process.env.MAX_UPLOAD_BYTES ?? '').trim();
  if (raw !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(
        `[attachments] MAX_UPLOAD_BYTES="${raw}" is not a positive integer.`,
      );
    }
    return parsed;
  }
  return process.env.VERCEL === '1' ? 4 * 1024 * 1024 : 10 * 1024 * 1024;
}

/**
 * Render a byte count as a whole-number MB string — `"10 MB"`,
 * `"4 MB"` — never `"10.0 MB"`. The 413 copy is asserted
 * verbatim by the specs, so the formatting has to be exact.
 */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : Number(mb.toFixed(1))} MB`;
}

/**
 * Multer middleware: in-memory storage, size cap, mimetype
 * allowlist. The error handling for the cap and the filter
 * lives in the controller (see `runUpload`) so we can map
 * multer's `MulterError` codes to our typed `HttpError`
 * envelopes.
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
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
  const lengthError = checkContentLength(req);
  if (lengthError) {
    // Drain the request before responding. The client is still
    // streaming the body; if we answer and close the socket
    // mid-upload the client gets an EPIPE instead of our 413.
    return drainRequest(req).then(
      () => Promise.reject(lengthError),
      () => Promise.reject(lengthError),
    );
  }
  return new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          reject(
            new HttpError(
              413,
              'file_too_large',
              `File is larger than ${formatBytes(MAX_UPLOAD_BYTES)}. Pick a smaller file.`,
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
      // A malformed / truncated multipart body surfaces as a plain
      // `Error` from busboy ("Unexpected end of form"), not a
      // `MulterError`. That is still client input, so it must be a
      // 400 with actionable copy — not an opaque 500.
      if (err instanceof Error && !isMulterError(err)) {
        reject(
          new HttpError(
            400,
            'validation_error',
            'Could not read the upload. Pick a file and try again.',
            { file: 'invalid-upload' },
          ),
        );
        return;
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
 * Reject an oversized upload from the `Content-Length` header,
 * before multer buffers the body into memory.
 *
 * This is a best-effort early exit: browsers send
 * `Content-Length` for `FormData` POSTs, so in practice the
 * client gets *our* 413 with actionable copy rather than the
 * platform's opaque `FUNCTION_PAYLOAD_TOO_LARGE`. A chunked
 * request has no `Content-Length` and falls through to multer's
 * own `fileSize` limit, which enforces the same cap.
 *
 * The header covers the whole multipart envelope, not just the
 * file payload, so we allow a small margin for the boundary
 * lines and part headers. Without the margin a file of exactly
 * the cap would be rejected on the envelope's overhead.
 */
function checkContentLength(req: Request): HttpError | null {
  const header = req.headers['content-length'];
  if (typeof header !== 'string' || header === '') {
    return null;
  }
  const declared = Number.parseInt(header, 10);
  if (!Number.isFinite(declared) || declared <= 0) {
    return null;
  }
  // ~64 KB of multipart envelope overhead is generous.
  const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
  if (declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return new HttpError(
      413,
      'file_too_large',
      `File is larger than ${formatBytes(MAX_UPLOAD_BYTES)}. Pick a smaller file.`,
    );
  }
  return null;
}

/**
 * Consume and discard the rest of the request body.
 *
 * Used before answering an oversized upload with 413: the client
 * is still writing the body, so replying without draining closes
 * the socket underneath it and the client sees a connection reset
 * rather than the 413. Draining lets the response land.
 *
 * Best-effort — if the stream errors we still send the 413.
 */
function drainRequest(req: Request): Promise<void> {
  return new Promise<void>((resolve) => {
    if (req.readableEnded || req.destroyed) {
      resolve();
      return;
    }
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    req.on('data', () => {
      /* discard */
    });
    req.on('end', finish);
    req.on('error', finish);
    req.on('aborted', finish);
    req.resume();
  });
}

/**
 * Type guard for multer's `MulterError`.
 *
 * `multer.MulterError` extends `Error`, so a plain `instanceof
 * Error` check would also match it. We need to tell the two apart:
 * a `MulterError` we don't have an explicit mapping for should
 * still surface as itself, while a non-multer parse failure should
 * become a 400 validation envelope.
 */
function isMulterError(err: unknown): err is multer.MulterError {
  return (
    err instanceof Error &&
    typeof (err as multer.MulterError).code === 'string'
  );
}

/**
 * Express middleware wrapper around `runUpload` that translates
 * multer's `MulterError` codes into typed `HttpError` envelopes.
 *
 * This is the form the ROUTE must use. The route previously called
 * the raw `uploadMiddleware` (multer's own `.single('file')`),
 * which meant a `LIMIT_FILE_SIZE` or `LIMIT_UNEXPECTED_FILE` error
 * was thrown straight out of the route-level middleware — BEFORE
 * the controller's `runUpload` translation could ever see it. The
 * client got an opaque 500 "Something went wrong" instead of a
 * 413 / 415 with actionable copy.
 *
 * Using this wrapper keeps the translation in one place and makes
 * it apply regardless of how the middleware is wired.
 */
export function attachmentUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  runUpload(req, res).then(
    () => next(),
    (err: unknown) => next(err),
  );
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
 * Request: `multipart/form-data` with one field `file` no
 * larger than the server's configured cap (10 MB in
 * development, 4 MB in production) and mimetype in
 * `ALLOWED_MIMETYPES`.
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
 *       Multipart upload of a single file within the server's
 *       configured size cap with a mimetype from the server's
 *       allowlist. Returns the
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
 * enumeration); 404 missing row; 500 storage_missing /
 * storage_unavailable.
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
 *           File metadata exists but the stored bytes are
 *           missing (`storage_missing`), or the file store is
 *           unreachable (`storage_unavailable`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorBody'
 *             example:
 *               error: storage_missing
 *               message: File metadata exists but the stored bytes are missing.
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
          'File metadata exists but the stored bytes are missing.',
        );
      }
      // Anything else — a misconfigured store, a network failure,
      // a missing credential — is a server fault, not a missing
      // file. Log the underlying cause so an operator can tell
      // the two apart, and return a distinct error code.
      console.error(
        '[attachments] failed to read attachment bytes:',
        err,
      );
      throw new HttpError(
        500,
        'storage_unavailable',
        'The file store is unavailable. Try again shortly.',
      );
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
