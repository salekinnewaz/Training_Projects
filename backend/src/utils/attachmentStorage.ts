/**
 * Attachment storage abstraction — HD-016.
 *
 * The Phase 6 kickoff locks the MVP storage as the local
 * filesystem under `backend/uploads/`, but instructs us to
 * wrap the implementation in a small interface so v1.x can
 * swap in S3 (or any other blob store) without touching
 * controllers or routes.
 *
 * The interface is intentionally minimal — just the three
 * operations the controller actually performs:
 *
 *   - `put(id, filename, sourcePath)` — move (or copy, for
 *     memory-storage multer) the freshly-uploaded bytes to
 *     a permanent location. Returns the relative path the
 *     `attachments` row should store in `storage_path`.
 *   - `getStream(storagePath)` — open a readable stream
 *     over the bytes. Returns the stream + the byte count
 *     so the controller can set `Content-Length` (browsers
 *     show a real progress bar instead of "unknown").
 *   - `delete(storagePath)` — best-effort cleanup. Failures
 *     are logged but not thrown; the row is the source of
 *     truth and a missing file is recoverable from a backup.
 *
 * Two implementations ship:
 *
 *   - `LocalFsStorage` — the filesystem under `backend/uploads/`.
 *     The default for local dev; zero configuration.
 *   - `VercelBlobStorage` — a private Vercel Blob store. The
 *     default on Vercel, because the serverless filesystem is
 *     read-only except `/tmp` and `/tmp` is ephemeral per
 *     instance (files vanish when the instance recycles), so it
 *     cannot hold attachment bytes permanently.
 *
 * The backend is selected by the `ATTACHMENT_STORAGE_BACKEND`
 * env var (`fs` | `blob`). The controller + route files don't
 * change either way — that was the whole point of the seam.
 */

import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

export interface AttachmentStream {
  stream: NodeJS.ReadableStream;
  sizeBytes: number;
}

export interface AttachmentStorage {
  /**
   * Persist the uploaded bytes to a permanent location.
   * `sourcePath` is the temp path the multer middleware wrote
   * to (or the in-memory buffer's `tempfile` if a future story
   * switches to disk storage). Returns the relative path
   * (relative to the storage base) the row should record.
   */
  put(
    id: number,
    filename: string,
    source: { buffer: Buffer } | { path: string },
  ): Promise<string>;

  /**
   * Open a readable stream over the persisted bytes + report
   * the size so the controller can set `Content-Length`.
   * Throws if the file is missing (orphaned by a botched
   * cleanup); the controller maps that to a 500.
   */
  getStream(storagePath: string): Promise<AttachmentStream>;

  /**
   * Best-effort delete. Failures are logged but never thrown
   * — the attachment row is the source of truth and a missing
   * file is recoverable from a backup.
   */
  delete(storagePath: string): Promise<void>;
}

/**
 * Filesystem storage under `backend/uploads/`. The directory is
 * created on construction (idempotent) so a fresh checkout
 * with no `uploads/` dir still works on the first upload.
 *
 * File naming: `<id>-<filename>` (e.g. `47-report.pdf`). The
 * id is the freshly-inserted Attachment PK so each file is
 * unique without needing a UUID; the filename suffix is the
 * user-supplied name (sanitized — the controller strips path
 * separators and a few special characters before calling
 * `put`). The full storage path recorded in the row is the
 * base-relative path (e.g. `47-report.pdf`), not an absolute
 * path — the absolute path is reconstructed at read time.
 */
export class LocalFsStorage implements AttachmentStorage {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    // Best-effort: mkdir -p. If the call fails, the first
    // `put` will surface the error to the caller.
    fs.mkdir(this.baseDir, { recursive: true }).catch((err) => {
      console.error(
        `[attachmentStorage] failed to create base dir ${this.baseDir}:`,
        err,
      );
    });
  }

  async put(
    id: number,
    filename: string,
    source: { buffer: Buffer } | { path: string },
  ): Promise<string> {
    const safeFilename = sanitizeFilename(filename);
    const storageFilename = `${id}-${safeFilename}`;
    const dest = path.join(this.baseDir, storageFilename);

    if ('buffer' in source) {
      // In-memory multer: write the buffer to the final path.
      await fs.writeFile(dest, source.buffer);
    } else {
      // Disk multer (future): move the temp file to the final
      // path. `fs.rename` is atomic on the same filesystem
      // and faster than copy + unlink.
      await fs.rename(source.path, dest);
    }
    return storageFilename;
  }

  async getStream(storagePath: string): Promise<AttachmentStream> {
    const absolute = this.resolveWithinBase(storagePath);
    // `stat` first so we can surface a clear error if the
    // file is missing. The controller maps ENOENT to a 500
    // (orphaned-metadata scenario).
    const stat = await fs.stat(absolute);
    return {
      stream: createReadStream(absolute),
      sizeBytes: stat.size,
    };
  }

  async delete(storagePath: string): Promise<void> {
    const absolute = this.resolveWithinBase(storagePath);
    try {
      await fs.unlink(absolute);
    } catch (err) {
      console.error(
        `[attachmentStorage] failed to delete ${absolute}:`,
        err,
      );
    }
  }

  /**
   * Resolve a stored relative path to an absolute path inside
   * the base dir, or throw ENOENT.
   *
   * Two hazards are handled here:
   *
   *  1. **Doubled prefix.** Seeded rows carry paths like
   *     `uploads/seed/x.png` (the path is relative to the
   *     *project root*, not to the base dir). Joining that
   *     against `<cwd>/uploads` yields
   *     `<cwd>/uploads/uploads/seed/x.png` — a file that
   *     never existed. We strip a leading `uploads/` segment
   *     before joining.
   *
   *  2. **Path traversal.** `path.join(base, '../../etc/passwd')`
   *     escapes the base dir entirely. We resolve the joined
   *     path and verify it is still inside the base dir.
   *
   * Both failures surface as `ENOENT` so the controller's
   * existing missing-bytes mapping works unchanged.
   */
  private resolveWithinBase(storagePath: string): string {
    const relative = storagePath.replace(/^[/\\]+/, '');
    const withoutBasePrefix = relative.replace(
      /^uploads[/\\]/,
      '',
    );
    const absolute = path.resolve(this.baseDir, withoutBasePrefix);
    const baseWithSep = this.baseDir.endsWith(path.sep)
      ? this.baseDir
      : this.baseDir + path.sep;
    if (absolute !== this.baseDir && !absolute.startsWith(baseWithSep)) {
      const err = new Error(
        `[attachmentStorage] refusing to read ${storagePath} — it escapes ${this.baseDir}`,
      ) as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }
    return absolute;
  }
}

/**
 * Strip path separators and a few control characters from the
 * user-supplied filename before using it on disk. The browser
 * is the only caller, so the most common attack is `../../etc`
 * or a null byte — both neutralized here. The id-prefix in
 * the storage path is what makes collisions impossible
 * (we never overwrite an existing file because the id is
 * always fresh), so we don't need to mangle the name further
 * to enforce uniqueness.
 */
function sanitizeFilename(filename: string): string {
  // Strip path separators, control chars, and the colon
  // (Windows reserved). Replace with underscore.
  return filename
    .replace(/[\\/]/g, '_')
    .replace(/[\x00-\x1f\x7f:]/g, '_')
    .trim()
    .slice(0, 200) || 'file';
}

/**
 * Which storage implementation is in use.
 *
 * `fs`   — local filesystem under `<cwd>/uploads`. Default.
 * `blob` — a private Vercel Blob store. Required on Vercel,
 *          where the serverless filesystem is read-only.
 */
export type StorageBackendKind = 'fs' | 'blob';

/**
 * Read `ATTACHMENT_STORAGE_BACKEND` and validate it.
 *
 * Unset (or empty) means `fs` so local dev needs zero
 * configuration. An unrecognised value is a configuration
 * error and must fail loudly — silently falling back to `fs`
 * on Vercel would reproduce the 500 this module exists to fix.
 */
export function resolveStorageBackend(): StorageBackendKind {
  const raw = (process.env.ATTACHMENT_STORAGE_BACKEND ?? '')
    .trim()
    .toLowerCase();
  if (raw === '' || raw === 'fs') return 'fs';
  if (raw === 'blob') return 'blob';
  throw new Error(
    `[attachmentStorage] ATTACHMENT_STORAGE_BACKEND="${raw}" is not valid. Use "fs" or "blob".`,
  );
}

/**
 * The backend the running process is actually using. Recorded
 * on each attachment row (`backend_kind`) so a row written by
 * one backend is never read by the other.
 */
export function activeStorageBackend(): StorageBackendKind {
  return resolveStorageBackend();
}

/**
 * Vercel Blob storage — a private store.
 *
 * The blob URL is *not* publicly reachable; bytes are fetched
 * through the Function with the SDK and streamed to the
 * client, which is exactly what the existing auth-gated
 * `GET /api/attachments/:id` route already does. No wire
 * contract change, no frontend change.
 *
 * `storage_path` holds the blob **pathname** (not the URL) so
 * it fits `VARCHAR(512)` comfortably and survives a change of
 * the store's hostname.
 *
 * The SDK is required lazily inside each method so the `fs`
 * path never loads it.
 */
export class VercelBlobStorage implements AttachmentStorage {
  async put(
    id: number,
    filename: string,
    source: { buffer: Buffer } | { path: string },
  ): Promise<string> {
    const { put } = loadBlobSdk();
    const safeFilename = sanitizeFilename(filename);
    // The blob SDK takes a Buffer (or a stream), so the
    // disk-backed multer variant has to be read into memory
    // first. The current wiring uses `memoryStorage`, so this
    // path is only for a future switch.
    const body =
      'buffer' in source
        ? source.buffer
        : await fs.readFile(source.path);
    const blob = await put(`attachments/${id}-${safeFilename}`, body, {
      access: 'private',
      addRandomSuffix: true,
    });
    // With `addRandomSuffix` the stored pathname differs from
    // the one we passed in — `blob.pathname` is the truth.
    return blob.pathname;
  }

  async getStream(storagePath: string): Promise<AttachmentStream> {
    const { get } = loadBlobSdk();
    const result = await get(storagePath, { access: 'private' });
    if (!result) {
      throw enoent(`blob not found: ${storagePath}`);
    }
    return {
      stream: Readable.fromWeb(
        result.stream as unknown as Parameters<typeof Readable.fromWeb>[0],
      ),
      sizeBytes: result.blob.size,
    };
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const { del } = loadBlobSdk();
      await del(storagePath, { access: 'private' });
    } catch (err) {
      console.error(
        `[attachmentStorage] failed to delete blob ${storagePath}:`,
        err,
      );
    }
  }
}

/**
 * Build an `ENOENT` error so the controller's existing
 * missing-bytes branch works identically for both backends.
 */
function enoent(message: string): NodeJS.ErrnoException {
  const err = new Error(message) as NodeJS.ErrnoException;
  err.code = 'ENOENT';
  return err;
}

/**
 * Lazy-load `@vercel/blob`. Requiring it at module scope would
 * pull the SDK into every local dev boot, and it is a Vercel-only
 * dependency.
 */
type BlobSdk = {
  put: (
    pathname: string,
    body: Buffer,
    options: { access: 'private'; addRandomSuffix: boolean },
  ) => Promise<{ pathname: string; url: string }>;
  get: (
    pathname: string,
    options: { access: 'private' },
  ) => Promise<{
    blob: { size: number };
    stream: unknown;
  } | null>;
  del: (pathname: string, options: { access: 'private' }) => Promise<void>;
};

let blobSdk: BlobSdk | null = null;

function loadBlobSdk(): BlobSdk {
  if (blobSdk) return blobSdk;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    blobSdk = require('@vercel/blob') as BlobSdk;
  } catch (err) {
    throw new Error(
      '[attachmentStorage] ATTACHMENT_STORAGE_BACKEND="blob" requires the @vercel/blob package: ' +
        String(err),
    );
  }
  return blobSdk;
}

/**
 * The active storage singleton.
 *
 * Local dev resolves `backend/uploads/` relative to the project
 * root (the cwd when `npm run dev` is invoked). The directory is
 * auto-created by the `LocalFsStorage` constructor.
 */
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

export const attachmentStorage: AttachmentStorage =
  resolveStorageBackend() === 'blob'
    ? new VercelBlobStorage()
    : new LocalFsStorage(UPLOADS_DIR);
