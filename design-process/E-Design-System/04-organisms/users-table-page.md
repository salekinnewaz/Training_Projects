# Users Table Page (organism)

**Category:** Organism
**Composed of:** [app-header-chrome](../03-molecules/app-header-chrome.md) + heading + active-count micro-label + table (5 columns: Name · Email · Role · Status · Last active) with [self-row-table](../03-molecules/self-row-table.md) pattern
**Phase 4 source:** Users tab (`users-tab.md`); reused as the Users tab content on Admin Dashboard

---

## Overview

Admin's user-management surface: a single-table admin list with two inline actions per row (change role via dropdown; toggle active status). One row per user, alphabetical by name. The page is reached either directly at `/users` or as the Users tab content on `/admin`.

The page is Admin's operational tool for role changes and active-status toggles — typically visited weekly at most. The MVP team is 5–20 people; the list fits comfortably on one screen. The page should feel like an admin tool, not a user-management enterprise product — no tabs within tabs, no per-user detail pages, no audit-trail surface.

## Anatomy (top-down)

1. **App-header chrome strip** (y=0..64) — shared with all post-login pages.
2. **Heading row** (y=88..128):
   - **Heading text** (left, x=280, y=108): "Users" — 24px semibold `#212529`.
   - *(No tab switcher on this page.)* Admin navigates between Dashboard and Users via the tab switcher on `/admin`. The `/users` page itself is plain `Users` with no right-side tab switcher.
3. **Active-count micro-label** (x=280, y=132): `12 users · 11 active · 1 inactive` — 12px `#868e96`. Glance summary below the heading.
4. **Table** (y=160.., 880px content column centered at x=720):
   - **Table header** (y=160, 11px uppercase tracked `#868e96`): "NAME / EMAIL / ROLE / STATUS / LAST ACTIVE".
   - **Rows** (y=176..240 for Row 1, 64px row stride; up to ~10 rows fit on a 900px canvas):
     - **Name column (220px):** [avatar](../02-atoms/avatar.md) (32px circle, initials on `#adb5bd` bg) + display name.
     - **Email column (280px):** Full email, `#868e96`.
     - **Role column (160px):** [form-field-dropdown](../03-molecules/form-field-dropdown.md) (Role dropdown, 160px wide, fits inside the 64px row).
     - **Status column (120px):** Active toggle — `● Active` (filled `#2b8a3e` circle + label) or `○ Inactive` (empty `#adb5bd` circle + label, `#868e96` text).
     - **Last active column (100px):** relative timestamp ("3 days ago" / "Never").
   - **Self-row** (the Admin viewing the page): 3px `#212529` left border + greyed-out controls + micro-label below the row ("You cannot change your own role.").
5. **No footer / pagination** — out of MVP. The list is small enough (≤20 rows).

## Behavior summary

### Page lifecycle

- **Entry from Admin Dashboard tab switcher:** click "Users" tab on `/admin` → serves Users tab content (in-page navigation).
- **Direct-arrival to `/users`** while logged in: served if Admin, 403 Forbidden card if non-Admin (rare race; UI flow prevents it via navigation), redirect to `/login?return_to=/users` if logged out.

### Inline action lifecycle

- **Role change (non-demotion):** dropdown selection → PUT `/api/users/:id/role` → success: row updates; error: dropdown reverts, inline error.
- **Role change (demotion from Admin):** dialog → confirm → PUT; cancel: dropdown reverts.
- **Active toggle (non-Admin user):** click → PUT `/api/users/:id/status` → success: row updates; error: toggle reverts, inline error.
- **Active toggle (Admin target):** dialog → confirm → PUT; cancel: toggle reverts.
- **Disabled-state clicks** (self-row): controls don't respond; disabled cursor + micro-label communicate the constraint.

### Sort

- **Alphabetical by name (last name, then first name).** Stable, predictable. No re-sort controls in MVP.
- The Admin viewing the page is in their alphabetical position; the self-row visual treatment distinguishes them without resorting them.

## Layout dimensions

- Page width: 1440
- Content column: 880px, centered at x=720 (x=280..1160)
- Page top margin: 32px below app-header strip
- Heading row height: 40px
- Active-count micro-label: 12px, 8px below heading
- Row height: 64px
- Column widths (within 880px): Name 220px · Email 280px · Role 160px · Status 120px · Last active 100px
- Avatar (Name column): 32px circle
- Self-row left border: 3px `#212529`
- Disabled micro-label position: 12px below the self-row

## States (cross-reference)

- **Default (loaded)** — heading + active-count + table sorted alphabetical, self-row highlighted.
- **Default (loaded, single Admin)** — self-row is the only Admin row; disabled controls visible.
- **Loading** — heading + row skeletons (5 rows, 64px tall, grey bars where text would be).
- **Server error** — inline error above the list: "Couldn't load users. Refresh to try again."
- **Permission denied (non-Admin direct arrival)** — centered card: "You don't have access to this page. Back to Dashboard."
- **Session expired** — redirect to `/login?return_to=/users`.
- **Action error** — inline error below the affected row: "Couldn't update. Try again." Control reverts.
- **Confirmation dialog** (Admin demotion / deactivation) — modal with warning copy + Cancel + Confirm.

## Tokens Used

- All app-header-chrome tokens
- All [self-row-table](../03-molecules/self-row-table.md) tokens
- All [form-field-dropdown](../03-molecules/form-field-dropdown.md) tokens (Role dropdown)
- [avatar](../02-atoms/avatar.md) tokens (Name column)
- [divider](../02-atoms/divider.md) tokens (row separators + 3px self-row border)
- [dialog-modal](../03-molecules/dialog-modal.md) tokens (Admin demotion / deactivation)
- `color-active-green` (`#2b8a3e`) for Active indicator
- `color-disabled-text` (`#adb5bd`) for inactive indicator + disabled controls
- `space-content-column` (880px), `space-row-height` (64px)

## Used In

- **Users tab** (`users-tab.md`): the canonical organism at `/users`.
- **Admin Dashboard** (`admin-dashboard.md`): as the Users tab content on `/admin` — same table, same controls, same self-row highlight.

## See also

- [app-header-chrome](../03-molecules/app-header-chrome.md) — persistent strip.
- [self-row-table](../03-molecules/self-row-table.md) — the self-row pattern.
- [form-field-dropdown](../03-molecules/form-field-dropdown.md) — Role dropdown atom-level spec.
- [dialog-modal](../03-molecules/dialog-modal.md) — Admin demotion / deactivation dialogs.
- [confirmation-dialog](../05-patterns/confirmation-dialog.md) — the cross-page pattern.
- [server-error-state](../05-patterns/server-error-state.md) — fetch error pattern.
- [loading-skeleton](../05-patterns/loading-skeleton.md) — initial fetch loading pattern.
