/**
 * Attachment service — row lifecycle + storage handshake.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * `createAttachment` is a two-phase write: insert the row with
 * an empty `storage_path` to get the PK, write the bytes, then
 * update the row with the final path. Two things can go wrong
 * and both were invisible before:
 *
 *   1. If the byte write fails, the row must be destroyed — a
 *      phantom attachment that 500s on every download is worse
 *      than no attachment at all.
 *   2. The row records *which* backend wrote it (`backend_kind`).
 *      The `fs` and `blob` backends use incompatible path
 *      formats, so a row written by one must never be read by
 *      the other. This is what the production 500 fix hinged on.
 *
 * The service is mocked wholesale in the controller + route
 * specs, so the real implementation had no coverage at all.
 */

import { expect, jest, describe, it, beforeEach } from '@jest/globals';

const attachmentCreate =
  jest.fn<(values: Record<string, unknown>) => Promise<unknown>>();
const attachmentUpdate =
  jest.fn<(values: Record<string, unknown>) => Promise<unknown>>();
const attachmentDestroy = jest.fn<() => Promise<unknown>>();

jest.mock('../models', () => ({
  Attachment: {
    create: (values: Record<string, unknown>) => attachmentCreate(values),
  },
  Ticket: { findOne: jest.fn(), findByPk: jest.fn() },
}));

const storagePut =
  jest.fn<(id: number, filename: string, source: unknown) => Promise<string>>();
jest.mock('../utils/attachmentStorage', () => ({
  attachmentStorage: {
    put: (id: number, filename: string, source: unknown) =>
      storagePut(id, filename, source),
    getStream: jest.fn(),
    delete: jest.fn(),
  },
  activeStorageBackend: () => 'fs',
}));

import { createAttachment } from './attachmentService';

describe('createAttachment', () => {
  beforeEach(() => {
    attachmentCreate.mockReset();
    attachmentUpdate.mockReset();
    attachmentDestroy.mockReset();
    storagePut.mockReset();

    attachmentCreate.mockImplementation(async (values: Record<string, unknown>) => ({
      id: 42,
      ...values,
      update: attachmentUpdate,
      destroy: attachmentDestroy,
    }));
    attachmentUpdate.mockResolvedValue(undefined);
    attachmentDestroy.mockResolvedValue(undefined);
    storagePut.mockResolvedValue('42-report.pdf');
  });

  it('inserts the row with an empty storage path, then updates it', async () => {
    await createAttachment({
      filename: 'report.pdf',
      sizeBytes: 5,
      mimetype: 'application/pdf',
      uploadedById: 7,
      source: { buffer: Buffer.from('hello') },
    });

    // The initial insert must not carry the final path — the
    // path isn't known until the bytes are written.
    expect(attachmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ storagePath: '' }),
    );
    expect(attachmentUpdate).toHaveBeenCalledWith({ storagePath: '42-report.pdf' });
  });

  it('records the active storage backend on the row', async () => {
    await createAttachment({
      filename: 'report.pdf',
      sizeBytes: 5,
      mimetype: 'application/pdf',
      uploadedById: 7,
      source: { buffer: Buffer.from('hello') },
    });

    expect(attachmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ backendKind: 'fs' }),
    );
  });

  it('passes the id and filename to the storage backend', async () => {
    await createAttachment({
      filename: 'report.pdf',
      sizeBytes: 5,
      mimetype: 'application/pdf',
      uploadedById: 7,
      source: { buffer: Buffer.from('hello') },
    });

    expect(storagePut).toHaveBeenCalledWith(
      42,
      'report.pdf',
      expect.objectContaining({ buffer: expect.any(Buffer) }),
    );
  });

  it('destroys the row and throws storage_failed when the write fails', async () => {
    storagePut.mockRejectedValue(new Error('EROFS: read-only file system'));

    await expect(
      createAttachment({
        filename: 'report.pdf',
        sizeBytes: 5,
        mimetype: 'application/pdf',
        uploadedById: 7,
        source: { buffer: Buffer.from('hello') },
      }),
    ).rejects.toMatchObject({ status: 500, errorCode: 'storage_failed' });

    expect(attachmentDestroy).toHaveBeenCalled();
  });

  it('still throws storage_failed when the row destroy also fails', async () => {
    // A row that can't be deleted is a leak, but the client's
    // error envelope matters more — we must not surface a 500
    // from the destroy path with a different code.
    storagePut.mockRejectedValue(new Error('boom'));
    attachmentDestroy.mockRejectedValue(new Error('destroy failed'));

    await expect(
      createAttachment({
        filename: 'report.pdf',
        sizeBytes: 5,
        mimetype: 'application/pdf',
        uploadedById: 7,
        source: { buffer: Buffer.from('hello') },
      }),
    ).rejects.toMatchObject({ errorCode: 'storage_failed' });
  });
});
