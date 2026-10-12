/**
 * AttachmentService — HD-016 spec.
 *
 * Verifies the two methods on `AttachmentService`:
 *
 *   - `upload(file)` — POST /api/attachments with a FormData
 *     body, returns the 4-field wire shape, throws ApiError
 *     with the right `status` / `errorCode` on a 413 / 415
 *     response.
 *   - `downloadUrl(id)` — returns the absolute URL.
 *
 * HttpClient is exercised through HttpTestingController. The
 * auth interceptor is bypassed (HttpClient goes straight to
 * the controller) so the test focuses on the service
 * contract — URL, method, body, response unwrap, ApiError
 * conversion on non-2xx.
 */

import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AttachmentService } from './attachment.service';
import { ApiError } from './api-error';
import { environment } from '../../environments/environment';

describe('AttachmentService (HD-016)', () => {
  let service: AttachmentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        AttachmentService,
      ],
    });
    service = TestBed.inject(AttachmentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('upload', () => {
    it('POSTs FormData to /api/attachments and returns the wire shape', async () => {
      const file = new File(['hello'], 'screenshot.png', {
        type: 'image/png',
      });
      const wireResponse = {
        id: 47,
        filename: 'screenshot.png',
        sizeBytes: 5,
        mimetype: 'image/png',
      };

      const p = service.upload(file);
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/attachments`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      // Body must be FormData containing the file under the
      // 'file' field name (matches the backend's
      // `uploadMiddleware = multer({...}).single('file')`).
      expect(req.request.body instanceof FormData).toBe(true);
      const form = req.request.body as FormData;
      expect(form.get('file')).toBeTruthy();
      expect((form.get('file') as File).name).toBe('screenshot.png');
      expect((form.get('file') as File).type).toBe('image/png');
      req.flush(wireResponse);

      const result = await p;
      expect(result).toEqual(wireResponse);
    });

    it('throws ApiError(413, file_too_large) immediately when file > 10 MB', async () => {
      // 11 MB file → client-side cap fires, no request is made.
      const oversized = new File(
        [new ArrayBuffer(11 * 1024 * 1024)],
        'huge.bin',
        { type: 'application/octet-stream' },
      );

      let caught: unknown = null;
      try {
        await service.upload(oversized);
        fail('expected ApiError');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(413);
      expect((caught as ApiError).errorCode).toBe('file_too_large');
      // No HTTP request should have been made — the cap is
      // client-side.
      httpMock.expectNone(() => true);
    });

    it('throws ApiError(415, unsupported_media_type) on backend rejection', async () => {
      const file = new File(['exe'], 'install.exe', {
        type: 'application/x-msdownload',
      });
      const p = service.upload(file);
      const req = httpMock.expectOne(`${environment.apiBaseUrl}/attachments`);
      req.flush(
        {
          error: 'unsupported_media_type',
          message: 'This file type is not allowed.',
        },
        { status: 415, statusText: 'Unsupported Media Type' },
      );
      let caught: unknown = null;
      try {
        await p;
        fail('expected ApiError');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(415);
      expect((caught as ApiError).errorCode).toBe('unsupported_media_type');
    });
  });

  describe('downloadUrl', () => {
    it('returns the absolute URL with the attachment id', () => {
      expect(service.downloadUrl(47)).toBe(
        `${environment.apiBaseUrl}/attachments/47`,
      );
    });

    it('handles different ids', () => {
      expect(service.downloadUrl(1)).toBe(
        `${environment.apiBaseUrl}/attachments/1`,
      );
      expect(service.downloadUrl(9999)).toBe(
        `${environment.apiBaseUrl}/attachments/9999`,
      );
    });
  });
});
