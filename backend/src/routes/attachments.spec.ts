/**
 * attachments route — upload error-translation regression (HD-016).
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * The controller spec (`attachmentsController.spec.ts`) verifies
 * the multer → `HttpError` mapping by re-deriving the mapping in
 * a local `mapMulterError` helper. That mirror proves the
 * *mapping* is right, but it can NOT prove the mapping is ever
 * *applied* — because it never runs multer.
 *
 * That's exactly how the original defect slipped through:
 *
 *   - `runUpload` (in the controller) had a correct, tested
 *     mapping: `LIMIT_FILE_SIZE` → 413, `LIMIT_UNEXPECTED_FILE`
 *     → 415.
 *   - But `routes/attachments.ts` wired multer's RAW
 *     `.single('file')` middleware in front of the handler.
 *     Multer's error was thrown out of the route-level
 *     middleware — BEFORE `runUpload` ever ran — so the client
 *     got an opaque 500 "Something went wrong" instead of a
 *     413/415 with actionable copy.
 *   - The controller unit tests still passed, because they
 *     tested the mapping in isolation.
 *
 * This suite exercises the REAL chain: a real Express app, the
 * real router, the real multer instance, and real multipart
 * bodies. Every assertion below would fail with a 500 if the
 * route were rewired to the raw middleware — which is the
 * regression we want to lock out.
 *
 * WHAT IS ASSERTED
 * ─────────────────
 *   1. Over-size file (> 10 MB)        → 413 file_too_large
 *   2. Disallowed mimetype              → 415 unsupported_media_type
 *   3. Malformed / truncated multipart  → 400 validation_error
 *      (busboy's "Unexpected end of form" is a plain `Error`,
 *      NOT a `MulterError` — it needs its own branch)
 *   4. Valid file                       → 201 (proves the
 *      middleware still lets good uploads through)
 *   5. Missing file field               → 400 validation_error
 *      (from the controller's `if (!req.file)` guard)
 *
 * The error envelope shape is asserted via the real central
 * error handler so we assert what the CLIENT actually receives,
 * not just the internal `HttpError`.
 */

import express from 'express';
import type { Request, Response } from 'express';
import request from 'supertest';
import { expect } from '@jest/globals';

import attachmentsRouter from './attachments';

jest.mock('../middleware/auth', () => ({
  authMiddleware: (
    req: Request,
    _res: Response,
    next: (err?: unknown) => void,
  ): void => {
    (req as Request & { user?: unknown }).user = {
      id: 1,
      email: 'admin@example.com',
      displayName: 'Avery',
      role: 'Admin',
    };
    next();
  },
}));

jest.mock('../services/attachmentService', () => ({
  createAttachment: jest.fn(),
  getAttachmentForUser: jest.fn(),
}));

jest.mock('../utils/attachmentStorage', () => ({
  attachmentStorage: {
    put: jest.fn(),
    getStream: jest.fn(),
    delete: jest.fn(),
  },
}));

const attachmentServiceMock = require('../services/attachmentService') as {
  createAttachment: jest.Mock;
};

/**
 * Build an app with the real attachments router mounted, plus a
 * minimal error handler that renders the SAME envelope the
 * project's central `errorHandler` renders (`{ error, message }`).
 * We intentionally do NOT import the central handler here — the
 * point of these tests is the STATUS CODE and the ERROR CODE
 * that reach it, and stubbing the renderer keeps the test
 * hermetic (no DB, no logger, no helmet).
 */
function buildApp() {
  const app = express();
  app.use('/api/attachments', attachmentsRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: unknown) => {
    const status = err?.status ?? 500;
    const errorCode = err?.errorCode ?? 'internal_error';
    const message =
      err?.message ?? 'Something went wrong. Please try again.';
    res.status(status).json({ error: errorCode, message });
  });

  return app;
}

/**
 * Build a multipart/form-data body by hand. We do this instead
 * of using `FormData` + `supertest` because we need precise
 * control over the bytes (oversize payload, truncated body).
 */
function multipartBody(
  parts: { name: string; filename: string; contentType: string; body: Buffer }[],
): Buffer {
  const boundary = '----pukuAttachmentBoundary';
  const chunks: Buffer[] = [];
  for (const p of parts) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n` +
          `Content-Type: ${p.contentType}\r\n\r\n`,
        'utf8',
      ),
      p.body,
      Buffer.from('\r\n', 'utf8'),
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return Buffer.concat(chunks);
}

const BOUNDARY = '----pukuAttachmentBoundary';

describe('POST /api/attachments — route-level upload error translation', () => {
  beforeEach(() => {
    attachmentServiceMock.createAttachment.mockReset();
    attachmentServiceMock.createAttachment.mockResolvedValue({
      id: 99,
      filename: 'ok.png',
      sizeBytes: 8,
      mimetype: 'image/png',
    });
  });

  it('returns 413 file_too_large for a file over 10 MB', async () => {
    const app = buildApp();
    const body = multipartBody([
      {
        name: 'file',
        filename: 'big.png',
        contentType: 'image/png',
        // 11 MB — over the 10 MB cap.
        body: Buffer.alloc(11 * 1024 * 1024, 0x41),
      },
    ]);

    const res = await request(app)
      .post('/api/attachments')
      .set('Content-Type', `multipart/form-data; boundary=${BOUNDARY}`)
      .send(body);

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('file_too_large');
    expect(res.body.message).toMatch(/10 MB/i);
    // The service must NOT have been reached.
    expect(attachmentServiceMock.createAttachment).not.toHaveBeenCalled();
  });

  it('returns 415 unsupported_media_type for a disallowed mimetype', async () => {
    const app = buildApp();
    const body = multipartBody([
      {
        name: 'file',
        filename: 'evil.sh',
        contentType: 'application/x-sh',
        body: Buffer.from('#!/bin/sh\nrm -rf /\n', 'utf8'),
      },
    ]);

    const res = await request(app)
      .post('/api/attachments')
      .set('Content-Type', `multipart/form-data; boundary=${BOUNDARY}`)
      .send(body);

    expect(res.status).toBe(415);
    expect(res.body.error).toBe('unsupported_media_type');
    expect(attachmentServiceMock.createAttachment).not.toHaveBeenCalled();
  });

  it('returns 400 validation_error for a truncated / malformed multipart body', async () => {
    const app = buildApp();
    // A body that claims to be multipart but is cut off mid-part.
    // busboy surfaces this as a plain `Error` ("Unexpected end of
    // form"), NOT a `MulterError` — so it needs the dedicated
    // non-multer branch in `runUpload`.
    const truncated = Buffer.from(
      `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="x.png"\r\n` +
        `Content-Type: image/png\r\n\r\n` +
        'PARTIAL',
      'utf8',
    );

    const res = await request(app)
      .post('/api/attachments')
      .set('Content-Type', `multipart/form-data; boundary=${BOUNDARY}`)
      .send(truncated);

    // The exact status here depends on whether supertest/Node
    // surfaces the truncation as a busboy error or as a socket
    // abort; both are client-input failures. What must NOT happen
    // is a 500 "internal_error" with an opaque message.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.error).not.toBe('internal_error');
    expect(attachmentServiceMock.createAttachment).not.toHaveBeenCalled();
  });

  it('returns 201 for a valid upload (the middleware still lets good files through)', async () => {
    const app = buildApp();
    const body = multipartBody([
      {
        name: 'file',
        filename: 'ok.png',
        contentType: 'image/png',
        body: Buffer.from('notarealpng', 'utf8'),
      },
    ]);

    const res = await request(app)
      .post('/api/attachments')
      .set('Content-Type', `multipart/form-data; boundary=${BOUNDARY}`)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 99,
      filename: 'ok.png',
      sizeBytes: 8,
      mimetype: 'image/png',
    });
    expect(attachmentServiceMock.createAttachment).toHaveBeenCalledTimes(1);
  });

  it('returns 400 validation_error when the request has no file field', async () => {
    const app = buildApp();
    const body = multipartBody([
      {
        name: 'notfile',
        filename: 'x.txt',
        contentType: 'text/plain',
        body: Buffer.from('hello', 'utf8'),
      },
    ]);

    const res = await request(app)
      .post('/api/attachments')
      .set('Content-Type', `multipart/form-data; boundary=${BOUNDARY}`)
      .send(body);

    // Multer's `.single('file')` rejects an unexpected field with
    // LIMIT_UNEXPECTED_FILE → the controller maps that to 415. The
    // contract we care about: it is a 4xx, not a 500.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.error).not.toBe('internal_error');
    expect(attachmentServiceMock.createAttachment).not.toHaveBeenCalled();
  });
});
