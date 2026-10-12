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
 * The default export is the filesystem implementation. v1.x
 * can replace it with an `S3Storage` class implementing the
 * same interface; the controller + route files don't change.
 */

import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';

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
    const absolute = path.join(this.baseDir, storagePath);
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
    const absolute = path.join(this.baseDir, storagePath);
    try {
      await fs.unlink(absolute);
    } catch (err) {
      console.error(
        `[attachmentStorage] failed to delete ${absolute}:`,
        err,
      );
    }
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
 * Singleton filesystem storage. Resolves `backend/uploads/`
 * relative to the project root (the cwd when `npm run dev`
 * is invoked). The directory is auto-created by the
 * `LocalFsStorage` constructor.
 */
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

export const attachmentStorage: AttachmentStorage = new LocalFsStorage(
  UPLOADS_DIR,
);
