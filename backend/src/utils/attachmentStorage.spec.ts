/**
 * Attachment storage backend selection + both implementations.
 *
 * WHY THIS FILE EXISTS
 * ────────────────────
 * The production 500 (`POST /api/attachments` → `storage_failed`)
 * was caused by the storage backend silently defaulting to the
 * filesystem on Vercel, where the serverless filesystem is
 * read-only. Nothing in the suite asserted *which* backend was
 * active, so the mistake was invisible until it hit production.
 *
 * These specs lock down three things:
 *
 *   1. Backend resolution — unset/`fs` → `fs`, `blob` → `blob`,
 *      anything else is a loud configuration error (never a
 *      silent fallback to `fs`, which is what caused the outage).
 *   2. `LocalFsStorage` — the two path bugs that were live in
 *      production: the doubled `uploads/` prefix that made every
 *      seeded row unreadable, and the missing path-traversal
 *      guard that would let a `storage_path` escape the base dir.
 *   3. `VercelBlobStorage` — put/get/delete against a mocked
 *      SDK, including the ENOENT contract the controller's
 *      `storage_missing` mapping depends on.
 */

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { expect, jest, describe, it, beforeEach, afterEach } from '@jest/globals';

import {
  LocalFsStorage,
  VercelBlobStorage,
  activeStorageBackend,
  resolveStorageBackend,
} from './attachmentStorage';

/**
 * The blob SDK is required lazily inside `VercelBlobStorage`, so
 * a `jest.mock` on the module id intercepts it. The mock is
 * hoisted, so it must be declared before the import above is
 * evaluated — hence `jest.mock` on a path that resolves to the
 * same module.
 */
const blobMock = {
  put: jest.fn<(pathname: string, body: Buffer, options: unknown) => Promise<{ pathname: string; url: string }>>(),
  get: jest.fn<(pathname: string, options: unknown) => Promise<unknown>>(),
  del: jest.fn<(pathname: string, options: unknown) => Promise<void>>(),
};

jest.mock('@vercel/blob', () => blobMock);

// ── Backend resolution ─────────────────────────────────────────────

describe('resolveStorageBackend', () => {
  const original = process.env.ATTACHMENT_STORAGE_BACKEND;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ATTACHMENT_STORAGE_BACKEND;
    } else {
      process.env.ATTACHMENT_STORAGE_BACKEND = original;
    }
  });

  it('defaults to "fs" when the env var is unset (zero-config local dev)', () => {
    delete process.env.ATTACHMENT_STORAGE_BACKEND;
    expect(resolveStorageBackend()).toBe('fs');
  });

  it('treats an empty / whitespace value as "fs"', () => {
    process.env.ATTACHMENT_STORAGE_BACKEND = '   ';
    expect(resolveStorageBackend()).toBe('fs');
  });

  it('reads "fs" explicitly', () => {
    process.env.ATTACHMENT_STORAGE_BACKEND = 'fs';
    expect(resolveStorageBackend()).toBe('fs');
  });

  it('reads "blob" explicitly', () => {
    process.env.ATTACHMENT_STORAGE_BACKEND = 'blob';
    expect(resolveStorageBackend()).toBe('blob');
  });

  it('is case- and whitespace-insensitive', () => {
    process.env.ATTACHMENT_STORAGE_BACKEND = '  Blob  ';
    expect(resolveStorageBackend()).toBe('blob');
  });

  it('throws on an unrecognised value rather than silently falling back to "fs"', () => {
    // The silent fallback is what caused the production outage:
    // a typo in the env var looked like a healthy deployment and
    // only failed on the first upload.
    process.env.ATTACHMENT_STORAGE_BACKEND = 's3';
    expect(() => resolveStorageBackend()).toThrow(/not valid/i);
  });

  it('activeStorageBackend mirrors resolveStorageBackend', () => {
    process.env.ATTACHMENT_STORAGE_BACKEND = 'blob';
    expect(activeStorageBackend()).toBe('blob');
  });
});

// ── LocalFsStorage ─────────────────────────────────────────────────

describe('LocalFsStorage', () => {
  let baseDir: string;
  let storage: LocalFsStorage;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'att-storage-'));
    storage = new LocalFsStorage(baseDir);
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it('writes the bytes and returns the base-relative path', async () => {
    const stored = await storage.put(7, 'report.pdf', {
      buffer: Buffer.from('hello'),
    });

    expect(stored).toBe('7-report.pdf');
    const bytes = await fs.readFile(path.join(baseDir, stored));
    expect(bytes.toString()).toBe('hello');
  });

  it('sanitizes path separators out of the filename', async () => {
    const stored = await storage.put(1, '../../etc/passwd', {
      buffer: Buffer.from('x'),
    });

    expect(stored).toBe('1-.._.._etc_passwd');
    expect(path.dirname(path.join(baseDir, stored))).toBe(baseDir);
  });

  it('reads the bytes back with the right size', async () => {
    const stored = await storage.put(3, 'a.png', { buffer: Buffer.from('abc') });

    const result = await storage.getStream(stored);

    expect(result.sizeBytes).toBe(3);
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream as Readable) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe('abc');
  });

  it('resolves a seeded "uploads/..." path against the base dir, not base-dir/uploads', async () => {
    // The seeded rows carry paths like `uploads/seed/x.png` —
    // relative to the project root, not to the base dir. Joining
    // them naively produced `<base>/uploads/uploads/seed/x.png`,
    // a file that never existed, so every seeded attachment 500'd
    // with `storage_missing`.
    await fs.mkdir(path.join(baseDir, 'seed'), { recursive: true });
    await fs.writeFile(path.join(baseDir, 'seed', 'x.png'), 'seeded');

    const result = await storage.getStream('uploads/seed/x.png');

    expect(result.sizeBytes).toBe(6);
  });

  it('rejects a path that escapes the base dir', async () => {
    // Path traversal: a `storage_path` of `../../etc/passwd` must
    // not resolve outside the uploads directory.
    await expect(storage.getStream('../../etc/passwd')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects an absolute path outside the base dir', async () => {
    await expect(storage.getStream('/etc/passwd')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('reports ENOENT for a missing file', async () => {
    await expect(storage.getStream('missing.png')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('delete removes the file', async () => {
    const stored = await storage.put(9, 'x.png', { buffer: Buffer.from('x') });

    await storage.delete(stored);

    await expect(fs.stat(path.join(baseDir, stored))).rejects.toThrow();
  });

  it('delete swallows a missing file', async () => {
    await expect(storage.delete('nope.png')).resolves.toBeUndefined();
  });
});

// ── VercelBlobStorage ──────────────────────────────────────────────

describe('VercelBlobStorage', () => {
  let storage: VercelBlobStorage;

  beforeEach(() => {
    blobMock.put.mockReset();
    blobMock.get.mockReset();
    blobMock.del.mockReset();
    storage = new VercelBlobStorage();
  });

  it('uploads to a private blob and returns the resulting pathname', async () => {
    // `addRandomSuffix` means the stored pathname differs from
    // the one we asked for — the SDK's answer is the truth.
    blobMock.put.mockResolvedValue({
      pathname: 'attachments/4-report.pdf-abc123',
      url: 'https://example.invalid/attachments/4-report.pdf-abc123',
    });

    const stored = await storage.put(4, 'report.pdf', {
      buffer: Buffer.from('hello'),
    });

    expect(stored).toBe('attachments/4-report.pdf-abc123');
    expect(blobMock.put).toHaveBeenCalledWith(
      'attachments/4-report.pdf',
      expect.any(Buffer),
      { access: 'private', addRandomSuffix: true },
    );
  });

  it('streams the blob back with its size', async () => {
    const webStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'));
        controller.close();
      },
    });
    blobMock.get.mockResolvedValue({
      blob: { size: 5 },
      stream: webStream,
    });

    const result = await storage.getStream('attachments/x.png');

    expect(result.sizeBytes).toBe(5);
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream as Readable) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe('hello');
  });

  it('throws ENOENT for a missing blob', async () => {
    // The controller maps ENOENT → 500 `storage_missing`; the
    // blob backend has to honour the same contract as the
    // filesystem one.
    blobMock.get.mockResolvedValue(null);

    await expect(storage.getStream('attachments/gone.png')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('deletes the blob', async () => {
    blobMock.del.mockResolvedValue(undefined);

    await storage.delete('attachments/x.png');

    expect(blobMock.del).toHaveBeenCalledWith('attachments/x.png', {
      access: 'private',
    });
  });

  it('swallows a delete failure', async () => {
    blobMock.del.mockRejectedValue(new Error('boom'));

    await expect(storage.delete('attachments/x.png')).resolves.toBeUndefined();
  });
});
