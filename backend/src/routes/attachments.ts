/**
 * Attachments router — HD-016.
 *
 * Mounted at `/api/attachments` by `routes/index.ts`. Two routes:
 *
 *   POST /        — multipart upload, single file, ≤ 10 MB,
 *                   mimetype allowlist (see
 *                   `attachmentsController.ALLOWED_MIMETYPES`).
 *                   Returns 201 with `{ id, filename, sizeBytes,
 *                   mimetype }`.
 *   GET  /:id     — streams the file back. Auth required;
 *                   Users can only fetch attachments on their
 *                   own tickets (enumeration protection).
 *
 * The multer middleware lives in the controller file so the
 * mimetype-allowlist and size-cap mappings are co-located
 * with the error translation.
 */

import { Router } from 'express';

import {
  attachmentUploadMiddleware,
  downloadHandler,
  uploadHandler,
} from '../controllers/attachmentsController';
import { authMiddleware } from '../middleware/auth';

const attachmentsRouter = Router();

// POST: auth first, then the TRANSLATING multer wrapper, then the
// handler. The wrapper (`attachmentUploadMiddleware`) is used rather
// than multer's raw `.single('file')` so that `MulterError` codes
// (`LIMIT_FILE_SIZE`, `LIMIT_UNEXPECTED_FILE`) are translated into
// typed 413 / 415 envelopes. With the raw middleware wired here,
// multer threw straight out of this route-level middleware and the
// client received an opaque 500 instead.
attachmentsRouter.post(
  '/',
  authMiddleware,
  attachmentUploadMiddleware,
  uploadHandler,
);

attachmentsRouter.get('/:id', authMiddleware, downloadHandler);

export default attachmentsRouter;
