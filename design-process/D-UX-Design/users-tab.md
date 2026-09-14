# Users Tab (Admin Overlay)

**Route:** `/users`
**Scenario:** Admin only. Non-Admin Support Agents cannot reach this page — the Users tab is hidden from their Agent Kanban Dashboard, and direct-arrival to `/users` returns 403.
**Purpose:** Admin manages who has access to HelpDesk Lite and what role they hold. The page is a single-table admin list with two inline actions per row: change role (one-action dropdown), toggle active status (one-action toggle). One row per user, alphabetical by name.

## User Context

Admin arrives from the Users tab on the Agent Kanban Dashboard (the same one-click gateway for non-Admin Support Agents, except Admin sees the tab). Admin's job here is operational: add a new team member's role, deactivate someone who left, promote an Agent to Admin during a coverage rotation. The work is one-action-per-row and the page must support batch-thinking ("who all needs changes today?") as well as single-row decisions ("is Eli still Employee?").

The page is not a daily-driver — Admin visits it weekly at most. The MVP team is 5–20 people; the list fits comfortably on one screen and stays scannable. The page should feel like an admin tool, not a user-management enterprise product — no tabs within tabs, no per-user detail pages, no audit-trail surface.

## Design Decisions (locked during discussion)

- **Sort: alphabetical by name (last name, then first name).** Stable, predictable, easy to find a person. No grouping. The list is small enough (≤20 rows) that grouping would add chrome without value.
- **Self-protection:** The Admin viewing the page can see themselves in the list, but the role dropdown and active toggle on their own row are **disabled**, with a small muted micro-label: "You cannot change your own role." This prevents the "last admin demoted themselves" foot-gun in a 5–20-person team. Admin can be modified by another Admin (rare; team has 1–2 admins). If a team has only one Admin, that Admin cannot demote or deactivate themselves — they must hand off Admin role to a Support Agent first (which means another Admin must exist, which means the team needs to grow Admin headcount before this becomes a constraint).
- **One-action inline controls.** Role dropdown + Active toggle. No separate "Edit user" page, no bulk actions, no detail view.
- **No "Add user" button** in MVP. Users are added via the auth backend's user-provisioning flow (out of scope for this UI). Admin's only job here is role/status management, not user creation.
- **Active toggle is a single click** — does not require a separate "Save" button. Server-side confirmation updates the row immediately; on failure, the toggle returns to its prior state with an inline error.
- **Role dropdown requires confirmation for role demotions from Admin → Support Agent or Admin → Employee** (loss of access scope). Other role changes apply immediately.

## Content & Actions

The page contains exactly these elements, in this order:

### 1. App-header chrome strip

Same shared strip as elsewhere: brand mark on left, My Profile / Logout on right.

### 2. Page heading row

- "Users" — 24px semibold, `#212529`, top-left of page content.
- *(No tab switcher on this page.)* Admin bounces between Dashboard and Users via the tab switcher on `/admin` (see `admin-dashboard.md`). The `/users` page is reached by clicking the Users tab on the Admin Dashboard; once there, the page heading is plain `Users` with no right-side tab switcher.
- **Active user count** — small muted text below the heading: `12 users · 11 active · 1 inactive`. Just a glance summary.

### 3. User list table

A simple table-style layout, 880px-wide content column centered at x=720. Five columns:

| Name | Email | Role | Status | Last active |
|---|---|---|---|---|
| Display name (e.g., "Eli Chen") | Full email (e.g., "eli.chen@company.com") | Role dropdown | Active toggle (● / ○) | Relative timestamp ("3 days ago" / "Never") |

- **Row height:** 64px (matches Employee Dashboard row height for visual consistency).
- **Row hover:** background `#f1f3f5` — confirms clickability is not needed for any row-level action (all actions are inline), so hover is purely an indicator that the row is interactive in some way. (Could omit hover tint; spec keeps it for parity with Employee Dashboard.)
- **Self-row highlight:** the row corresponding to the Admin viewing the page has a subtle left border `#212529` 3px and a muted micro-label below the row: "You cannot change your own role." The role dropdown and active toggle in that row render disabled (greyed-out, `cursor: not-allowed`).
- **Empty state** (theoretically possible if a team has zero users other than Admin, which can't happen): not in scope; the page always has at least 1 row.
- **Sort persistence:** alphabetical; no user-controlled re-sort in MVP. (If Admin needs a different order — e.g., most-recently-active — that's a v1.x follow-up.)

### 4. Action controls (per row)

#### Role dropdown

- `<select>` element styled like the Category/Priority dropdowns from Create Ticket.
- Options: `User · Support Agent · Admin`.
- Default value reflects the user's current role.
- **On change:** if the new role is a demotion from Admin (Admin → Support Agent or Admin → User), a confirmation dialog appears: "Demote <name> from Admin to <new role>? They will lose admin access immediately." Confirm → apply + activity log entry `Role changed: Admin → <new role> by <actor>`; Cancel → revert.
- **Non-demotion role changes** apply immediately with no dialog.
- **Disabled state** (self-row): dropdown is greyed out, micro-label appears.

#### Active toggle

- A single-click toggle, NOT a checkbox. Visually: `● Active` (filled green circle + "Active" label) or `○ Inactive` (empty grey circle + "Inactive" label, text `#868e96`). Click toggles between states.
- **On change:** immediate server-side update; row updates instantly. On server error, the toggle reverts to its prior state with an inline error: "Couldn't update status. Try again."
- **Confirmation dialog for deactivating an Admin:** "Deactivate <name>? They will be logged out and unable to log in." This is the Admin-demoted-by-self-prevention complement — deactivating an Admin is more impactful than changing a non-Admin's status.
- **Deactivating an active Agent / Employee:** no confirmation dialog; immediate apply.
- **Activating an inactive user:** no confirmation dialog; immediate apply.
- **Disabled state** (self-row): toggle is greyed out, micro-label appears.

## Behavior

### Page lifecycle

- **Entry from Agent Kanban Dashboard:** the Users tab in the heading row → `/users`.
- **Direct-arrival to `/users`** while logged in: served normally if Admin role, **403 Forbidden** card if non-Admin (rare race; UI flow prevents it from happening via navigation, but defense-in-depth at the route).
- **Direct-arrival while logged out:** redirect to `/login?return_to=/users`.

### Inline action lifecycle

- **Role change (non-demotion):** dropdown selection → PUT `/api/users/:id/role` with the new role → success: row updates, no toast; error: dropdown reverts, inline error.
- **Role change (demotion):** dialog → confirm → PUT; cancel: dropdown reverts, no-op.
- **Active toggle (non-Admin user):** click → PUT `/api/users/:id/status` → success: row updates; error: toggle reverts, inline error.
- **Active toggle (Admin target):** dialog → confirm → PUT; cancel: toggle reverts, no-op.
- **Disabled-state clicks:** self-row controls do not respond to clicks or keyboard input; the disabled cursor + micro-label communicate the constraint.

### Cross-page

- **Tab switcher on this page:** "Queue" tab returns to `/queue`; "Users" tab is the active one. The same tab pattern should be used elsewhere if / when more admin overlays are added (out of MVP).
- **Self-row highlight** is the only row-level visual differentiator; everything else is uniform.

## States

| State | Trigger | Display |
|---|---|---|
| **Default (loaded)** | Page loaded, Admin viewing | Heading "Users" + user list (sorted alphabetical, self-row highlighted with disabled controls). |
| **Default (loaded, single Admin)** | Same as Default, but only one Admin (the viewer themselves) | Self-row is the only Admin row; the disabled controls are visible. Other Admin-demotion paths don't exist (no other Admin to demote). |
| **Loading** | Initial fetch in flight | Heading + row skeletons (5 rows, 64px tall, grey bars where text would be). |
| **Server error** | Fetch fails | Inline error above the list: "Couldn't load users. Refresh to try again." Heading still rendered. |
| **Permission denied (non-Admin direct arrival)** | Non-Admin routes directly to `/users` | Single centered card: "You don't have access to this page. Back to Dashboard." (links to `/admin` for Admin, but non-Admin sees a link back to their own home: `/dashboard` for Employee, `/queue` for Support Agent.) |
| **Session expired** | Fetch returns 401 | Redirect to `/login?return_to=/users`. |
| **Action error** | A role/status change fails | Inline error below the affected row: "Couldn't update. Try again." The control reverts to its prior state. |
| **Confirmation dialog** (Admin demotion or Admin deactivation) | Admin triggers one of these actions | Modal dialog with the warning copy + Cancel + Confirm. Cancel closes; Confirm applies. |

**Note on the wireframe:** the canonical frame is **Default (loaded, single Admin viewing)** with a representative list of 8–10 users. The disabled self-row is rendered explicitly.

## Visual Tokens

Inherited from Login + Ticket Detail + Employee Dashboard + Agent Kanban. New tokens introduced:

- Disabled-control text color: `#adb5bd` (already in token table as border default; reused as disabled text color).
- Disabled-control background: `#f8f9fa` (same as page background — disabled controls blend into the surface).
- Self-row left border: `#212529` 3px (reuses primary).
- Active indicator (filled circle): `#2b8a3e` 8px radius (same green as Resolved badge — "live" semantic).
- Inactive indicator (empty circle): 8px radius, `#adb5bd` 1.5px stroke, no fill.

| Token | Value | Where used |
|---|---|---|
| Page background | `#f8f9fa` | Page surface |
| Surface (rows, app-header) | `#ffffff` | All rows, app-header strip |
| Primary | `#212529` | Heading text, self-row border |
| Border default | `#dee2e6` 1px | Row bottom borders, dropdown borders |
| Border strong (self-row) | `#212529` 3px | Left edge of the Admin's own row |
| Muted text | `#868e96` | Email text, timestamps, "Inactive" label, micro-label "You cannot change your own role." |
| Body text | `#495057` | Name text, role labels in dropdowns |
| Active green | `#2b8a3e` | "Active" indicator |
| Disabled text | `#adb5bd` | Disabled control labels |
| Type stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All text |
| Monospace stack | `ui-monospace, SFMono-Regular, Menlo, monospace` | (Not used here; names and emails use the regular stack) |

| Spacing & geometry | Value | Notes |
|---|---|---|
| Page width | 1440 | Design canvas |
| Content column width | 880px | Centered at x=720 |
| Page top margin | 32px below app-header strip | First content row |
| Heading row height | 40px | Heading + tab switcher aligned on baseline |
| Active-count micro-label | 12px, 8px below heading | `12 users · 11 active · 1 inactive` |
| Row height | 64px | Same as Employee Dashboard |
| Column widths (within 880px) | Name: 220px · Email: 280px · Role: 160px · Status: 120px · Last active: 100px | Flexible; total may exceed 880 with internal padding — adjust to fit |
| Avatar (name column) | 32px circle | Initials on `#adb5bd` bg |
| Self-row left border | 3px `#212529` | Visual marker for the viewer's own row |
| Disabled micro-label position | 12px below the self-row | Muted, "You cannot change your own role." |

### Wireframe-anchored layout coordinates (y-positions on a 900px canvas)

The canonical frame is **Default (loaded, single Admin viewing)** with 8 representative users.

- App-header chrome strip: y=0..64.
- Heading row: "Users" at x=280, y=108, 24px semibold. Tab switcher right-aligned at x=1000..1160.
- Active-count micro-label: x=280, y=132, 12px `#868e96`.
- Table header (column titles): y=160, 11px uppercase tracked `#868e96` — "NAME / EMAIL / ROLE / STATUS / LAST ACTIVE".
- Row 1: y=176..240. (Through Row 8 at y=688..752 if all 8 fit; spec allows up to ~10 rows comfortably on 900px canvas.)
- The Admin viewing the page (Sam Patel) sits in the row at the alphabetical position; self-row left border + disabled controls visible.

## Success

Admin lands here, scans 8–20 rows alphabetically, finds the person they need, makes the one-action change inline. Total time: 10 seconds for a single change, 30 seconds for a batch of changes during a coverage rotation. No page reload, no separate Edit screen, no confirmation dialog for routine changes (only Admin-demoting / Admin-deactivating, which are intentionally heavier).

The self-row protection ensures Admin can't accidentally lock themselves out. The alphabetical sort + the table-style layout means Admin can hand off "look up who has Support Agent role and switch them to Admin" to a colleague over Slack without ambiguity.

---

## Design System Reference

See `design-process/E-Design-System/01-design-tokens.md` for the consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring). All token values documented in this spec's Visual Tokens section are part of the unified design system used across every page in the app.

## Open Questions

None of the structural design decisions remain unresolved.

Implementation-level follow-ups (not blocking this spec):
- **Add-user flow:** out of MVP. User provisioning is in the auth backend, not this UI. If a team needs a self-serve Admin add-user flow, that's a v1.x feature.
- **Bulk actions** (deactivate-multiple, role-change-multiple): out of MVP. The list is small; single-row actions are sufficient.
- **Per-user detail page:** out of MVP. All actions are inline.
- **Audit log:** the spec mentions activity log entries for role/status changes; where they're stored and surfaced is the activity-log system (already specced on Ticket Detail). Users tab does not need its own audit surface in MVP.
- **Search/filter:** with ≤20 rows, alphabetical sort is sufficient. Search box is a v1.x follow-up.
- **Sort persistence:** alphabetical is the only sort. No user-controlled re-sort in MVP.
- **Last-active timestamp freshness:** relies on a server-tracked "last activity at" field. The spec assumes the backend tracks this; if not, last-active column can be omitted in MVP (would shrink the row).

---

_Produced by Freya — 2026-09-14_
_Source: 02-sam-runs-the-queue.md (Screen 6), design-process/A-Product-Brief/product-brief.md (Admin = permission overlay on Agent), design-process/D-UX-Design/employee-dashboard.md (row vocabulary, hover tint, app-header chrome), design-process/D-UX-Design/create-ticket.md (dropdown control styling)_
_Wireframe approved 2026-09-14; tokens + layout coordinates already in spec; no further sync needed._