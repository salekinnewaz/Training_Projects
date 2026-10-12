---
title: 'HD-014 — Users tab (Admin in-page Users table + /users route)'
type: 'feature'
created: '2026-10-12'
status: 'in-progress'
route: 'build'
review_loop_iteration: 0
baseline_commit: '253ebd6f6c8e2c4c2c0b3f3a8e1d1c2f7d9a4b3e'
context:
  - 'design-process/D-UX-Design/users-tab.md'
  - 'design-process/D-UX-Design/admin-dashboard.md'
  - 'design-process/E-Design-System/04-organisms/users-table-page.md'
  - 'design-process/E-Design-System/05-patterns/confirmation-dialog.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** HD-013 stubbed the Users tab on `/admin` as a placeholder that links to a placeholder `/users` page. Admin has no user-management surface today. Admin's two operational jobs are: (1) see the queue's shape (HD-013 shipped this) and (2) manage who has access to HelpDesk Lite (HD-014 ships this). HD-014 closes the Users tab loop and replaces both placeholders with the real table.

**Approach:**
- New `GET /api/users` endpoint (Admin only) returning the full user list alphabetical by `displayName`, with all fields the design doc surfaces (id, email, displayName, role, isActive, lastActiveAt, createdAt, updatedAt).
- New `PUT /api/users/:id/role` endpoint (Admin only) that updates a user's role. Self-protection server-side — `req.user.id === :id` returns 400. The frontend pre-validates via a confirmation dialog when the change is a demotion from Admin.
- New `PUT /api/users/:id/status` endpoint (Admin only) that toggles `isActive`. Same self-protection. The frontend pre-validates via a dialog when the toggle would deactivate an Admin.
- All three new routes live under the existing `usersRouter` (mounted at `/api/users` by `routes/index.ts`) — matches the design doc's URL paths verbatim and the existing `routes/users.ts` docblock that anticipated these endpoints.
- Full rewrite of `UsersTabPageComponent` (placeholder today) with `<app-chrome>` wrap, heading, active-count summary, and the 5-column table (Name / Email / Role / Status / Last active). Self-row protection: the row corresponding to the Admin viewing the page renders disabled controls + a 3px primary left border + a muted micro-label below the row.
- New `<molecule-user-row>` at `frontend/src/app/components/molecules/user-row/` that owns the per-row markup + the role/active wiring. Page component handles table chrome + render states + window-focus refetch.
- `<app-users-tab-page>` rendered inside `AdminDashboardPageComponent`'s `users-placeholder` branch (replacing the placeholder card) so the Users tab on `/admin#users` shows the real table in-page. Same component is mounted by `/users` for deep-link parity.

**Boundaries noted now:** Add-user flow is out of MVP (design doc §Open Questions). Per-user detail page is out. Bulk actions are out. Search/filter is out. Pagination is out (≤20 users per the design doc's MVP team size). The activity log surface (where role/status changes are recorded) is a separate story — HD-014 just calls `User.update()`.

## Boundaries & Constraints

**Always:**
- Backend `GET /api/users` returns `{ users: UserPublic[], count: number }` sorted by `displayName ASC`. Each entry is the full `UserPublic` wire (no `passwordHash`). Eager-loads none (no associations needed).
- Backend `GET /api/users` is Admin-only — inline role gate, 403 `forbidden` on mismatch.
- Backend `PUT /api/users/:id/role` accepts `{ role: 'User' | 'Support Agent' | 'Admin' }`, validates it (400 `validation_error` on missing/invalid), refuses self-demotion (400 `validation_error` with `fields.actor`), returns 200 + updated user.
- Backend `PUT /api/users/:id/status` accepts `{ isActive: boolean }`, validates it (400 `validation_error` on missing/non-boolean), refuses self-deactivation (same 400 shape), returns 200 + updated user.
- Backend `serializeUser` helper in `usersController.ts` (mirrors `serializeTicket` in `adminController.ts`) maps the Sequelize row to the `UserPublic` wire (strips `passwordHash`, ISO-encodes `lastActiveAt` or passes null).
- Backend `listAllUsers`, `setUserRole`, `setUserActive` helpers in `services/ticketService.ts` — the file already houses `listActiveAgents` (HD-010), so the user-related helpers cluster together.
- Frontend `UserService.listAll() / updateRole() / updateActive()` mirror the existing `listAgents()` shape: `firstValueFrom` + `withCredentials` + `apiErrorFrom` on non-2xx.
- Frontend page wraps in `<app-chrome>`. Heading "Users" (24px / 600 / `--color-primary`). Active-count micro-label below (12px / `--color-muted`): "N users · N active · N inactive".
- Frontend table: 5 columns matching the design doc geometry (Name 220px · Email 280px · Role 160px · Status 120px · Last active 100px — flex inside the 880px content column).
- Frontend Name column = `<atom-chrome-avatar size="32">` + display name. Email = full email in `--color-muted`. Role = bare `<atom-select>` (no form-field wrapper). Status = custom inline toggle button (filled `#2b8a3e` circle + "Active" / empty `#adb5bd` circle + "Inactive" in `--color-muted`). Last active = `formatRelative()` output or "Never" for null.
- Frontend self-row protection: `isSelf = currentUser?.id === row.user.id`. When true: 3px left border (`--color-primary`), atom-select + status toggle are `disabled`, micro-label "You cannot change your own role." appears 12px below the row.
- Frontend role-change demotion flow: dropdown change → if `user.role === 'Admin'` AND new role !== 'Admin' → open `<dialog-modal>` with headline "Demote <displayName> from Admin to <newRole>? They will lose admin access immediately." + Cancel + Demote. Confirm → call `updateRole`. Cancel → revert the select to the prior role (the local signal still holds the previous value).
- Frontend role-change non-demotion flow: dropdown change → immediate `updateRole` call, success updates the local signal, error reverts + inline row error.
- Frontend status-toggle Admin-deactivation flow: toggle click → if `user.role === 'Admin'` AND `user.isActive === true` → open `<dialog-modal>` with headline "Deactivate <displayName>? They will be logged out and unable to log in." + Cancel + Deactivate. Confirm → call `updateActive(false)`. Cancel → noop.
- Frontend status-toggle non-Admin flow: immediate `updateActive`. Same revert-on-error pattern as the role change.
- Frontend render states (`@switch`): `loading` → heading + 5 row skeletons (64px tall, grey bars). `error` → inline error card "Couldn't load users. Refresh to try again." + Retry button. `success` → the table.
- Frontend window:focus refetches the list when in success state (mirrors admin-dashboard).
- Frontend alphabetical sort: backend handles it; frontend just iterates the array.

**Never:**
- No add-user flow. No bulk actions. No per-user detail page. No audit log surface. No search/filter. No pagination. (All explicitly out of MVP per the design doc.)
- No new design tokens. Reuses every existing token: `--color-surface`, `--color-border`, `--color-primary`, `--color-muted`, `--color-disabled`, `--color-success` (for the active indicator), `--color-error`, `--focus-ring-color`, `--button-radius`, `--button-height`, `--space-modal-pad`, `--size-modal-width`, `--color-scrim`, `--z-modal-scrim`, `--z-modal`.
- No new atoms. Reuses `atom-select` (HD-008), `atom-chrome-avatar` (HD-004), `atom-button` (HD-004).
- No new molecules beyond `<molecule-user-row>` (HD-014). Reuses `<dialog-modal>` (HD-004) and `<app-chrome>` (HD-004).
- No extension of `DialogModalComponent` — the existing `headline` input is sufficient because the design doc's "no body copy" rule says the headline IS the question (e.g., "Demote Sam from Admin to Support Agent? They will lose admin access immediately.").
- No write endpoints to the activity log from the role/status changes — that's the existing `ActivityLog` model and is a separate slice.
- No realtime updates (no WebSocket / SSE / long-poll). Page refetches on window-focus OR explicit Retry.
- The Agent Kanban `/queue` and Employee Dashboard `/dashboard` are not modified by HD-014.
- The HD-013 admin-dashboard-page's `users-placeholder` branch is REPLACED with `<app-users-tab-page>` (no longer a placeholder card), but the rest of HD-013 (Dashboard tab, tablist ARIA, etc.) is untouched.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_ADMIN_LOADS_USERS | Avery (Admin) loads `/users` or `/admin#users`; 6 users seeded (1 Admin, 2 Support Agents, 3 Users; 1 inactive) | 200 → table renders 6 rows alphabetical by displayName. Active-count micro-label "6 users · 5 active · 1 inactive". Self-row (Avery) has disabled controls + 3px border + micro-label. | N/A |
| HAPPY_PATH_CHANGE_NON_ADMIN_ROLE | Avery changes Eli Chen's role from `User` to `Support Agent` (non-demotion) | Dropdown updates immediately, no dialog. `PUT /api/users/7/role` → 200 → row reflects new role. | N/A |
| HAPPY_PATH_TOGGLE_NON_ADMIN_STATUS | Avery clicks the Active toggle on Eli Chen (User role, currently active) | Toggle updates immediately, no dialog. `PUT /api/users/7/status` `{ isActive: false }` → 200 → row reflects Inactive. Active-count micro-label updates to "6 users · 4 active · 2 inactive". | N/A |
| CONFIRM_DEMOTE_ADMIN | Avery selects a different Admin (Sam Patel) and chooses `Support Agent` in the dropdown | Dialog opens: "Demote Sam Patel from Admin to Support Agent? They will lose admin access immediately." Cancel → dropdown reverts. Save Demote → `PUT /api/users/<sam-id>/role` → 200 → row reflects new role, dialog closes. | N/A |
| CONFIRM_DEACTIVATE_ADMIN | Avery clicks the Active toggle on Sam Patel (Admin role, currently active) | Dialog opens: "Deactivate Sam Patel? They will be logged out and unable to log in." Cancel → noop, toggle reverts. Deactivate → `PUT /api/users/<sam-id>/status` `{ isActive: false }` → 200 → row reflects Inactive, dialog closes. | N/A |
| NOOP_SELF_ROW_CONTROLS | Avery (Admin) views their own row | Dropdown is disabled (`<atom-select disabled>`). Toggle button is disabled (`disabled` attr + `cursor: not-allowed`). Micro-label "You cannot change your own role." appears 12px below the row. 3px primary left border on the row. Click on either control does nothing. | N/A |
| NOOP_CHANGE_OWN_ROLE_VIA_CURL | Direct PUT `/api/users/<own-id>/role` as Admin | 400 `validation_error` `actor` field. Server-side self-protection. | 400 response |
| NOOP_DEACTIVATE_SELF_VIA_CURL | Direct PUT `/api/users/<own-id>/status` `{ isActive: false }` as Admin | 400 `validation_error` `actor` field. Same server-side self-protection. | 400 response |
| ERROR_LOAD_USERS_5XX | Backend returns 500 on `GET /api/users` | Inline error card: "Couldn't load users. Refresh to try again." + Retry button. Retry refetches. | n/a |
| ERROR_LOAD_USERS_401 | Backend returns 401 | Auth interceptor redirects to /login; page does not render an error card (mirrors admin-dashboard contract). | redirect |
| ERROR_UPDATE_ROLE_5XX | Backend returns 500 on `PUT /api/users/<id>/role` | Dropdown reverts to prior role; inline row error "Couldn't update. Try again." below the row. | n/a |
| ERROR_UPDATE_STATUS_5XX | Backend returns 500 on `PUT /api/users/<id>/status` | Toggle reverts to prior state; inline row error "Couldn't update. Try again." below the row. | n/a |
| ERROR_INVALID_ROLE_PUT_CURL | Body `{ role: 'Wizard' }` | 400 `validation_error` no role field. | 400 response |
| ERROR_INVALID_STATUS_PUT_CURL | Body `{}` (missing isActive) | 400 `validation_error` no status field. | 400 response |
| ERROR_404_MISSING_USER_PUT | `PUT /api/users/9999/role` (no user with id 9999) | 404 `not_found`. Frontend reverts the dropdown. | 404 response |
| ERROR_403_NON_ADMIN_LOAD | Support Agent direct-arrival to `/users` | `roleGuard(['Admin'])` redirects to `/forbidden`. Backend defense-in-depth: even if guard bypassed, GET returns 403 `forbidden`. | redirect + 403 |
| WINDOW_FOCUS_REFETCH | Admin's tab loses then regains focus while page is in success state | `GET /api/users` is called again, table refreshes. (Mirrors admin-dashboard behavior.) | N/A |
| IN_PAGE_TAB_NAV | Avery clicks Users tab on `/admin` | URL hash becomes `#users`; the `users-placeholder` branch in admin-dashboard-page renders `<app-users-tab-page>` in-place. Same component as `/users` mounts. No router navigation to `/users`. | N/A |

## Test Plan

### Backend (extend `backend/src/controllers/usersController.spec.ts`)

Auth middleware mocked (default Admin). `ticketService` mocked. Add ~10 tests:

- `GET /` (listAllHandler):
  - 200 happy path: 5 users alphabetical, `{ users, count }` shape, each user has all 8 UserPublic fields.
  - 403 for User role.
  - 403 for Support Agent role.
  - 401 not tested here (authMiddleware mock bypasses it).
- `PUT /:id/role` (setRoleHandler):
  - 200 happy path: Admin updates another user (Eli) from `User` → `Support Agent`. Returns serialized updated user.
  - 200 self-update non-demotion: Admin updates their own role from `Admin` → `Admin` is rejected; we test Admin updating another Admin's role from `Admin` → `Admin` (no-op) works (returns 200, no change).
  - 400 self-demote attempt: Admin tries to demote themselves. Service is NOT called. Response has `errorCode: 'validation_error'` and `fields.actor`.
  - 400 missing/invalid role in body: `{ role: 'Wizard' }`. Service is NOT called. `fields.role`.
  - 404 missing user.
  - 403 for User role.
- `PUT /:id/status` (setActiveHandler):
  - 200 happy path: Admin toggles another user from active → inactive. Returns serialized updated user.
  - 200 self-toggle active-when-not-active (impossible by definition since self is always active by design, but we test the contract).
  - 400 self-deactivate attempt: Admin tries to deactivate themselves. Service is NOT called.
  - 400 missing `isActive` in body.
  - 404 missing user.
  - 403 for User role.

### Frontend

**`frontend/src/app/services/user.service.spec.ts`** (new file):
- `listAll()` happy path: GET `/api/users`, returns the array.
- `listAll()` 5xx: throws `ApiError(500, 'internal_server_error')`.
- `updateRole(id, role)` happy path: PUT `/api/users/:id/role` with body, returns updated user.
- `updateRole()` 5xx: throws `ApiError`.
- `updateActive(id, isActive)` happy path: PUT `/api/users/:id/status` with body, returns updated user.
- `updateActive()` 5xx: throws `ApiError`.

**`frontend/src/app/components/molecules/user-row/user-row.component.spec.ts`** (new):
- Renders avatar + name + email + role select + status toggle + last-active for a non-self row.
- Renders disabled controls + 3px left border + micro-label for a self row.
- Click on role select emits `roleChange`.
- Click on status toggle emits `activeToggle`.

**`frontend/src/app/pages/users-tab-page/users-tab-page.component.spec.ts`** (new):
- happy path: 5 rows from `listAll()`, alphabetical.
- heading + active-count micro-label.
- loading state: 5 row skeletons, no table body.
- server error: inline error + Retry, Retry refetches.
- 401: does not render error card.
- self-row: disabled atom-select, disabled status toggle, micro-label visible, 3px left border.
- role change non-demotion: calls `updateRole` immediately.
- role demotion (Admin → Support Agent): opens dialog, confirm calls `updateRole`, cancel reverts.
- status toggle non-Admin: calls `updateActive` immediately.
- status toggle Admin → inactive: opens dialog, confirm calls `updateActive`, cancel reverts.
- window:focus refetches.
- `formatRelative`: "just now" / "Xm ago" / "Xh ago" / "Xd ago" / "Xmo ago" / "Xy ago" / "" (NaN).
- `formatRelative(null)` → "Never".

## Files

**New:**
- `backend/src/controllers/usersController.spec.ts` (extend with ~10 tests; ~250 lines added)
- `frontend/src/app/services/user.service.spec.ts` (~120 lines)
- `frontend/src/app/components/molecules/user-row/user-row.component.ts` (~150 lines)
- `frontend/src/app/components/molecules/user-row/user-row.component.spec.ts` (~100 lines)
- `frontend/src/app/pages/users-tab-page/users-tab-page.component.spec.ts` (~350 lines)
- `_bmad-output/hd014.diff` (BMAD artifact)

**Modified:**
- `backend/src/services/ticketService.ts` — add `listAllUsers`, `setUserRole`, `setUserActive` (~80 lines)
- `backend/src/controllers/usersController.ts` — add `serializeUser`, `listAllHandler`, `setRoleHandler`, `setActiveHandler` (~120 lines)
- `backend/src/routes/users.ts` — register 3 new routes (~10 lines)
- `frontend/src/app/services/user.service.ts` — add `listAll`, `updateRole`, `updateActive` (~100 lines added)
- `frontend/src/app/pages/users-tab-page/users-tab-page.component.ts` — full rewrite (~280 lines)
- `frontend/src/app/pages/admin-dashboard-page/admin-dashboard-page.component.ts` — replace `users-placeholder` branch with `<app-users-tab-page>` (~10 lines changed)
- `frontend/src/styles.css` — add `.user-table` rules (~100 lines)

## Implementation Order

1. **Backend service helpers** (`listAllUsers`, `setUserRole`, `setUserActive` in `services/ticketService.ts`).
2. **Backend controller handlers** (`serializeUser` + `listAllHandler` + `setRoleHandler` + `setActiveHandler` in `controllers/usersController.ts`).
3. **Backend routes** (extend `routes/users.ts`).
4. **Backend tests** (extend `usersController.spec.ts`).
5. **Frontend service** (extend `frontend/src/app/services/user.service.ts`).
6. **Frontend molecule** (`<molecule-user-row>`).
7. **Frontend page** (rewrite `<app-users-tab-page>`).
8. **Frontend styles** (extend `styles.css` with user-table rules).
9. **Frontend in-page tab wiring** (replace `users-placeholder` branch in `<app-admin-dashboard-page>`).
10. **Frontend tests** (3 spec files: service, molecule, page).

## Verification

1. `cd backend && npm test` — full suite green (target: 57 prior + ~10 new = ~67 tests).
2. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox --include='**/users-tab-page/**,**/user-row/**,**/user.service.spec.ts'` — all new tests pass.
3. `cd frontend && npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox` — full frontend suite (expect same baseline: 105+ SUCCESS, same 6 pre-existing EmployeeDashboard failures unrelated to HD-014).
4. `cd frontend && npx ng build --configuration=development` — exits 0.
5. Browser smoke (manual): log in as `admin@company.com`, navigate to `/admin` Dashboard, click Users tab, exercise the full flow per the I/O matrix.

## Out of Scope (deferred)

- Refactor `formatRelative` from per-page copy into a shared util (already deferred; pattern continues).
- Add-user flow. Bulk actions. Per-user detail page. Audit log surface on the page. Search/filter. Pagination. (All per design doc.)
- `lastActiveAt` write-hook — already wired in `authController.ts:130` on every successful login, so the column has fresh data without HD-014 work.

## Open Questions

None blocking. The design doc fully specifies the visual + behavior contract.