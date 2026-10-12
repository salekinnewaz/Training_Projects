/**
 * AttachmentService — HD-016.
 *
 * Two methods:
 *
 *   - `upload(file)` — POST /api/attachments with a `FormData`
 *     containing the file under the key `file`. Returns the
 *     4-field wire shape `{ id, filename, sizeBytes, mimetype }`
 *     which the create-ticket page sets on the subsequent
 *     POST /tickets call (two-step flow per the design doc).
 *
 *   - `downloadUrl(id)` — returns the absolute URL for
 *     GET /api/attachments/:id. The Ticket Detail page uses
 *     this in an `<a href>` so the browser can stream the
 *     file back; the `auth` cookie rides automatically
 *     because the link is same-origin.
 *
 * Provided as `providedIn: 'root'` so any page can inject it
 * without a module-level import dance — mirrors `TicketService`
 * and `UserService`.
 *
 * Auth: every request goes through the `authInterceptor`, which
 * stamps `withCredentials: true` and converts HttpErrorResponse
 * into a typed `ApiError`. Services never need to think about
 * cookies or CORS preflight.
 *
 * **MIME type / size cap**: the backend enforces both (10 MB +
 * the allowlist in `attachmentsController.ts`). The frontend
 * does a quick client-side size check before opening the
 * upload request so the user sees the same error envelope
 * (413 `file_too_large`) without a wasted round-trip; the
 * server check is the source of truth.
 */

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { apiErrorFrom } from './api-error';

/**
 * Wire shape returned by `POST /api/attachments`. The row's
 * `storagePath` is internal — never returned.
 */
export interface AttachmentUploadResult {
  id: number;
  filename: string;
  sizeBytes: number;
  mimetype: string;
}

/**
 * Mirrors the backend's 10 MB cap. Used for the client-side
 * pre-check (avoids a wasted round-trip). The server is the
 * source of truth — a file exactly at 10 MB will succeed on
 * both sides; a 10 MB + 1 byte file will fail on the server
 * with 413 `file_too_large`.
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class AttachmentService {
  private readonly http = inject(HttpClient);

  /**
   * POST /api/attachments — upload a single file.
   *
   * The FormData payload is the standard browser pattern for
   * multipart uploads; Angular's HttpClient sets the right
   * `Content-Type: multipart/form-data; boundary=...` header
   * automatically when the body is a `FormData` instance.
   *
   * Throws `ApiError` on:
   *   - 400 `validation_error` `fields.file: 'required'` if
   *     no file was in the request.
   *   - 413 `file_too_large` if the file exceeds 10 MB.
   *   - 415 `unsupported_media_type` if the mimetype isn't in
   *     the server's allowlist (image/png|jpeg|gif, pdf, txt,
   *     zip).
   *   - 401 `unauthorized` if the caller isn't signed in.
   *   - 5xx on storage failure.
   */
  async upload(file: File): Promise<AttachmentUploadResult> {
    // Client-side cap: avoid the round-trip if we already
    // know the file is too big. The server enforces the
    // same limit; this is purely a UX optimization.
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw apiErrorFrom({
        status: 413,
        error: { error: 'file_too_large', message: 'File is larger than 10 MB. Pick a smaller file.' },
      } as unknown as Parameters<typeof apiErrorFrom>[0]);
    }

    const form = new FormData();
    form.append('file', file, file.name);

    try {
      const res = await firstValueFrom(
        this.http.post<AttachmentUploadResult>(
          `${environment.apiBaseUrl}/attachments`,
          form,
          { withCredentials: true },
        ),
      );
      return res;
    } catch (err) {
      throw apiErrorFrom(err as Parameters<typeof apiErrorFrom>[0]);
    }
  }

  /**
   * Return the absolute URL for `GET /api/attachments/:id`.
   * Used in `<a [href]="...">` on the Ticket Detail page so
   * the browser can stream the file back directly. The
   * `auth` cookie rides automatically because the link is
   * same-origin (frontend served by the same Express app
   * in dev, same host in prod).
   */
  downloadUrl(id: number): string {
    return `${environment.apiBaseUrl}/attachments/${id}`;
  }
}
