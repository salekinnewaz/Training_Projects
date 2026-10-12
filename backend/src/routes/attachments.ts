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
  downloadHandler,
  uploadHandler,
  uploadMiddleware,
} from '../controllers/attachmentsController';
import { authMiddleware } from '../middleware/auth';

const attachmentsRouter = Router();

// POST: auth + multer first, then the handler. The handler
// re-runs multer in a try/catch (via `runUpload`) so it can
// translate `MulterError` codes into typed HttpError envelopes.
attachmentsRouter.post(
  '/',
  authMiddleware,
  uploadMiddleware,
  uploadHandler,
);

attachmentsRouter.get('/:id', authMiddleware, downloadHandler);

export default attachmentsRouter;
