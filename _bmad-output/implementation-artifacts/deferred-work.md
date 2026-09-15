# Deferred Work

<!-- Append-only. One row per deferred finding across all stories. -->
<!-- Each entry is referenced from the corresponding spec's Review Triage Log. -->

| Source Story | ID | Finding | Owner (target story / slice) | Notes |
|--------------|-----|---------|------------------------------|-------|
| HD-005 | D1 | No test harness for atoms (`button`, `input-text`, `link`, `show-password-toggle`) or molecule (`form-field`) | Frontend testing slice (post-HD-016) | Repo lacks Jest + Testing Library config yet. Land once first concrete testing need surfaces (HD-008 form coverage is a likely trigger). |
| HD-005 | D2 | No tests for `LoginPageComponent` | Frontend testing slice (post-HD-016) | Same dependency as D1. |
| HD-005 | D3 | No `environment.prod.ts` swap file | Out of MVP per HD-004 plan | Add when production deploy story lands. |
| HD-005 | D4 | No 429 (`rate_limited`) handler in `api-error.ts` or login page | When backend rate-limiting ships (post-HD-003) | Spec boundary: backend doesn't rate-limit yet. Add `rate_limited` to `ApiErrorCode` union + a "Too many attempts. Please wait a moment." message wired to the password field. |
| HD-005 | D5 | `api-error.ts` `asFieldMap` only handles string field values; drops `string[]` silently | When HD-008 (create-ticket) lands field-level validation | Defensive; revisit if backend starts emitting array field messages. |
| HD-005 | D6 | No barrel `index.ts` in `components/atoms/` or `components/molecules/` | Style convergence slice (post-HD-016) | Every consumer imports by full path today. Land barrel files when a third deep-import need surfaces. |
| HD-005 | D7 | `dialog-modal` hand-rolls `.btn-primary` / `.btn-secondary` instead of using `<atom-button>` | Pattern-convergence slice (post-HD-016) | Per HD-004/HD-005 impl notes, convergence is deliberate non-goal. Land when dialogs gain a second use case (HD-008 create-ticket confirm). |
| HD-008 | D8 | Attachment upload endpoint (`POST /api/attachments`) + frontend wiring on `<file-drop>` (flip disabled → enabled, add upload on fileSelected, pass `attachmentId` to `POST /api/tickets`) | HD-011 (Attachments slice) or follow-up | HD-008 ships the Attachment field disabled with helper text "Attach a file (coming soon)" (per OQ-1 lock, choice A). The `<file-drop>` organism is fully built; HD-011 only needs the upload handler + 1-line disabled flip. |
| HD-008 | D9 | Backend integration test for `ticketService.createTicket` (transaction + FOR UPDATE counter + Ticket.create in the same tx). The spec's DUPLICATE_NUMBER edge case ("two parallel POSTs get unique HD-<n>") has no pinning test | Backend testing-infrastructure story | Repo has no in-memory DB (sqlite/memory) or sequelize-mock library; current pattern mocks services at the controller boundary rather than exercising real Sequelize transactions. Closing this needs a dedicated testing slice. |
