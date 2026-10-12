---
title: 'HD-016 — Attachments (upload + storage + display)'
---

# HD-016 — Attachments (upload + storage + display)

## Intent

The `Attachment` model + migration + the `<file-drop>` organism
have been in place since HD-002 / HD-008 respectively, but the
actual upload pipeline (file write, mimetype check, download
route) is unimplemented. The Create Ticket page has shipped for
months with the Attachment field greyed out and the helper text
"Attach a file (coming soon)".

HD-016 closes the loop:

- **Backend**: `POST /api/attachments` (multipart, single file
  ≤10 MB, mimetype allowlist) + `GET /api/attachments/:id`
  (streams the file back with the correct Content-Type). Both
  are behind `authMiddleware`. Storage is local filesystem
  under `backend/uploads/`, wrapped in a thin
  `AttachmentStorage` interface so S3 can be swapped in v1.x
  without touching controllers.
- **Frontend**: flip the `<file-drop>` on Create Ticket to
  enabled, wire `attachmentService.upload` into `onSubmit`
  (upload first, then create with the returned `attachmentId`),
  and add a download row to the Ticket Detail header.

The Ticket wire shape picks up a new `attachment` field
(populated by eager-loading the existing `Ticket → Attachment`
association).

## Boundaries

### In scope

- 1 backend dep (`multer` + types).
- 4 new backend files: `utils/attachmentStorage.ts`,
  `services/attachmentService.ts`,
  `controllers/attachmentsController.ts`,
  `routes/attachments.ts`.
- 1 new controller test file (8 tests covering happy + 4xx + 401/403/404).
- 1 small modification to `serializeTicket` so the ticket
  wire includes the attachment.
- 2 new OpenAPI doc entries (`POST /attachments`, `GET /attachments/{id}`)
  + 2 new response components (`UnsupportedMediaType`,
  `PayloadTooLarge`).
- 1 new frontend service (`AttachmentService`) with 3 tests.
- Wire upload into the existing Create Ticket page (flip
  disabled → false, swap helper text, plumb the upload call
  into `onSubmit`).
- Display the attachment as a download row in the Ticket
  Detail header (1 conditional `@if` block, 1 new CSS class).
- ~10 lines of CSS in `styles.css` for the attachment row.

### Out of scope

- No add-attachment-after-create flow (HD-016 is create-only;
  editing is out of MVP).
- No delete-attachment endpoint or UI affordance.
- No image preview / thumbnail rendering — just filename +
  size + download link.
- No S3 / MinIO / cloud storage. Local fs only.
- No virus scan / malware detection.
- No progress bar on the upload (single-step <10 MB upload
  is fast enough that the "Submitting…" button state covers it).
- No "no attachment" placeholder row in the ticket header.
- No automatic cleanup of orphan `attachments` rows (rows
  that exist but aren't linked to a ticket because the
  ticket-create failed after the upload succeeded). The MVP
  leaves these; a future housekeeping story can sweep them.
- No resize / compress / image transformation pipeline.
- No preview pane or in-browser viewer.

## I/O matrix

| User action | System response |
|---|---|
| Open Create Ticket page | Attachment field is no longer greyed out. Helper reads "Drag a file here, or click to browse." |
| Drop a 1 MB PDF on the field | Drop zone shows the file name + "1.0 MB". Click Submit → redirect to submission-confirmation with the new ticket number. |
| Open the new ticket | Ticket header shows the PDF file name + size + a "Download" link. Clicking downloads the PDF. |
| Drop a 12 MB file | Inline error under the drop zone: "File is larger than 10 MB. Pick a smaller file." Field resets to empty. |
| Drop a `.exe` (mimetype `application/x-msdownload`) | Inline error: "This file type is not allowed." Field resets. |
| `POST /api/attachments` with no auth cookie | 401 `unauthorized`. |
| `POST /api/attachments` (User role) | 201 with `{ id, filename, sizeBytes, mimetype }`. Row written to `attachments`, file written under `backend/uploads/<id>-<filename>`. |
| `GET /api/attachments/:id` (no auth) | 401. |
| `GET /api/attachments/:id` (User role, attachment on own ticket) | 200 + file bytes with correct Content-Type. |
| `GET /api/attachments/:id` (User role, attachment on another user's ticket) | 404 (enumeration protection — same shape as a missing ticket). |
| `GET /api/attachments/:id` (Support Agent / Admin) | 200 regardless of ticket owner. |
| `GET /api/attachments/999` (non-existent) | 404 `not_found`. |

## Test plan

### Unit (Jest) — backend

`backend/src/controllers/attachmentsController.spec.ts`:

- POST 201 happy path: 1 MB PDF → 201, returns the 4-field
  wire shape, file exists on disk, row exists in
  `attachments`.
- POST 415: mimetype not in allowlist → 415 with
  `error: unsupported_media_type`.
- POST 413: 11 MB file → 413 with
  `error: file_too_large`.
- POST 401: no auth cookie → 401.
- GET 200: existing attachment → 200, correct Content-Type +
  Content-Length + Content-Disposition; response body matches
  the file bytes.
- GET 401: no auth cookie → 401.
- GET 403: User requests an attachment that's on another
  user's ticket → 403 (the existing `getAttachmentForUser`
  enumeration protection throws HttpError(403) for cross-user).
- GET 404: missing id → 404.

### Unit (Jasmine) — frontend

`frontend/src/app/services/attachment.service.spec.ts`:

- `upload()` happy path: FormData contains the file under
  the `file` key, request URL is `/api/attachments`, returns
  the 4-field wire shape.
- `upload()` 413: backend returns 413 → service throws
  `ApiError(status: 413, errorCode: 'file_too_large')`.
- `upload()` 415: backend returns 415 → service throws
  `ApiError(status: 415, errorCode: 'unsupported_media_type')`.

Extensions to existing specs:

- `create-ticket-page.component.spec.ts`:
  - With `attachment()` set, `onSubmit` calls
    `attachmentService.upload` first, then
    `ticketService.createTicket` with the returned id.
  - Upload 413 error renders into `attachmentError` and does
    NOT call `createTicket`.
  - With no attachment, `onSubmit` calls `createTicket`
    without an `attachmentId` (no regression).
- `ticket-detail-page.component.spec.ts`:
  - When `ticket.attachment` is null, the `.attachment-row`
    is not rendered.
  - When `ticket.attachment` is set, the row renders filename
    + size + an `<a>` whose `href` ends in
    `/api/attachments/<id>`.

### Integration — OpenAPI doc

`backend/src/docs/openapi.spec.ts` is extended with two new
path assertions (`/attachments`, `/attachments/{id}`) and two
new response components (`UnsupportedMediaType`,
`PayloadTooLarge`).

### Manual browser smoke

- Log in as `user@company.com`, open `/tickets/new`.
- The Attachment field is no longer greyed out; the helper
  reads "Drag a file here, or click to browse."
- Drop a 1 MB PDF → the drop zone shows the file name + "1.0 MB".
  Click Submit → redirected to submission-confirmation.
- Open the new ticket → header shows the file name + size + a
  download link. Clicking the link downloads the PDF.
- Try to drop a 12 MB file → inline error under drop zone;
  field resets.
- Try to drop a `.exe` (mimetype `application/x-msdownload`)
  → inline error; field resets.
- Log in as a different User, try to open the same ticket URL
  → 404 (enumeration protection).
- Visit `http://localhost:3000/api/docs` → confirm the two
  new endpoints appear under a new "Attachments" tag.

## Files

**New:**
- `backend/src/utils/attachmentStorage.ts`
- `backend/src/services/attachmentService.ts`
- `backend/src/controllers/attachmentsController.ts`
- `backend/src/controllers/attachmentsController.spec.ts`
- `backend/src/routes/attachments.ts`
- `frontend/src/app/services/attachment.service.ts`
- `frontend/src/app/services/attachment.service.spec.ts`
- `_bmad-output/implementation-artifacts/spec-hd-016-attachments.md`
  (this file)
- `_bmad-output/hd016.diff`

**Modified:**
- `backend/package.json` (add `multer` + `@types/multer`)
- `package-lock.json` (workspace root — npm will update on
  install)
- `backend/src/routes/index.ts` (mount `/attachments` router)
- `backend/src/controllers/ticketsController.ts` (eager-load
  attachment in `serializeTicket`; 6-line change)
- `backend/src/docs/openapi.ts` (add `UnsupportedMediaType` +
  `PayloadTooLarge` to `components.responses`)
- `backend/src/docs/openapi.spec.ts` (add 2 paths + 2
  responses to the assertion list)
- `frontend/src/app/pages/create-ticket-page/create-ticket-page.component.ts`
  (flip disabled → false, wire upload into `onSubmit`,
  update helper text)
- `frontend/src/app/pages/create-ticket-page/create-ticket-page.component.spec.ts`
  (extend with 3 attachment tests)
- `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.ts`
  (add conditional attachment row to the header)
- `frontend/src/app/pages/ticket-detail-page/ticket-detail-page.component.spec.ts`
  (extend with 2 attachment tests)
- `frontend/src/styles.css` (add `.attachment-row` rules)

## Implementation order

1. Add `multer` + `@types/multer` to `backend/package.json`;
   `npm install`. Confirm versions.
2. Write `backend/src/utils/attachmentStorage.ts` (interface +
   local-fs impl).
3. Write `backend/src/services/attachmentService.ts`
   (`createAttachment` + `getAttachmentForUser`).
4. Write `backend/src/controllers/attachmentsController.ts`
   (upload + download) and `backend/src/routes/attachments.ts`.
5. Mount the new router in `backend/src/routes/index.ts`.
6. Update `serializeTicket` to eager-load the attachment.
7. Add `@openapi` blocks for the 2 new endpoints + 2 new
   response components in `openapi.ts`.
8. Write `backend/src/controllers/attachmentsController.spec.ts`
   and run `npm test` — 82/82 pass.
9. `npm run typecheck` exits 0.
10. Frontend `AttachmentService` + spec.
11. Create Ticket page: flip disabled → false, wire upload.
12. Ticket Detail page: add attachment row + `formatSize` helper.
13. CSS in `styles.css`.
14. Run frontend tests (148/154 baseline) and `ng build`.
15. Manual browser smoke.
16. Generate diff, commit, push (two-commit pattern).

## Verification

1. `cd backend && npm test` — **82/82 pass** (was 74 + 8 new).
2. `cd backend && npm run typecheck` — exits 0.
3. `cd frontend && npx ng test --watch=false
   --browsers=ChromeHeadlessNoSandbox` — same baseline
   (148/154; 6 pre-existing failures, 0 new).
4. `cd frontend && npx ng build --configuration=development`
   — exits 0.
5. Manual: `cd backend && npm run dev` then visit
   `http://localhost:3000/api/docs` → "Attachments" tag
   lists 2 endpoints (POST + GET).

## Reuse (no new atoms/molecules)

- `<file-drop>` — already built (HD-008). The only change is
  flipping `[disabled]` from `true` to `false` and swapping
  the projected helper text. No organism work.
- `serializeUser` / `serializeComment` / `serializeTicket` —
  pattern copy for `serializeAttachment` (8 lines, in the
  controller — not shared, per the codebase's
  per-controller-not-shared convention).
- `formatSize` from `file-drop.component.ts:282` — copy to
  ticket-detail-page (same per-page-instance pattern the
  codebase already uses 5+ times for `formatRelative`).
- `asyncHandler`, `HttpError`, `environment.apiBaseUrl` —
  same as every other backend / frontend file.
- The `Ticket → Attachment` association is already wired in
  `models/index.ts:73-76` (HD-002). HD-016 just uses it.

## Notes for the implementer

- **Multer file filter** — the controller uses
  `multer({ storage: multer.memoryStorage(), limits: {
  fileSize: 10 * 1024 * 1024 }, fileFilter })`. Memory storage
  means the file sits in a `Buffer` on `req.file.buffer`; the
  controller hands that to `createAttachment` which writes it
  to the final disk path. No temp file, no rename — fewer
  moving parts than disk storage.
- **Multer error handling** — when the fileFilter rejects,
  multer throws `MulterError('LIMIT_UNEXPECTED_FILE')` which
  the controller catches and re-throws as `HttpError(415,
  'unsupported_media_type', 'This file type is not allowed.')`.
  When the size limit trips, multer throws
  `MulterError('LIMIT_FILE_SIZE')` which the controller
  re-throws as `HttpError(413, 'file_too_large', 'File is
  larger than 10 MB. Pick a smaller file.')`. The frontend
  auth-interceptor maps these to typed `ApiError` instances
  (the existing `api-error.ts` already handles 4xx → ApiError).
- **Stream + Content-Length** — `getStream` uses
  `fs.statSync` to get the size, then `fs.createReadStream`
  to open the file. Setting `Content-Length` from the stat
  lets the browser show a real progress bar. For small files
  (<10 MB) this is fine; for v1.x S3, the size comes from
  the S3 `HeadObject` response.
- **Sanitizing filenames for Content-Disposition** — the
  spec says the `filename="..."` should be the user-supplied
  filename. Browsers honor it; for security, strip `\r`,
  `\n`, and `"` from the value before setting the header.
- **OpenAPI doc** — `components.responses` additions:
  `UnsupportedMediaType` (415) and `PayloadTooLarge` (413),
  both 1-line entries with `description` + a `$ref` to
  `ErrorBody`. Per-route `@openapi` blocks reference them.
- **Frontend FormData** — `HttpClient.post(url, formData)`
  with the browser's native FormData; Angular sets the
  `Content-Type: multipart/form-data; boundary=...` header
  automatically (do NOT set it manually — the boundary is
  generated per request and a hard-coded value would break
  uploads).
- **Ticket wire change** — `serializeTicket` in
  `ticketsController.ts` gains a 6-line `serializeAttachment`
  helper + an `include: [{ model: Attachment, as:
  'attachment', include: [{ model: User, as: 'uploadedBy' }]
  }]` in the service's `getById`. The frontend `Ticket`
  interface already declares `attachment: Attachment | null`
  (HD-002), so this is a pure additive wire change.
