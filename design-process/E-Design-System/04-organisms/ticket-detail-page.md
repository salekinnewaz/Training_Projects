# Ticket Detail Page (organism)

**Category:** Organism
**Composed of:** [app-header-chrome](../03-molecules/app-header-chrome.md) + "Back to Dashboard" link + header card (ticket metadata + role-aware action zone) + Description block + Comments block (with composer) + Activity log block
**Phase 4 source:** Ticket Detail (`ticket-detail.md`)

---

## Overview

The atomic unit of the product: every other screen pivots on a click that lands here. The page shows everything about one ticket — header, description, comments, activity log — and provides role-aware, state-dependent actions so the right person can move the ticket forward without ceremony.

The page is a single 880px-wide content column centered at x=720. The action zone in the header is the only piece that changes based on role + status; the rest of the layout is identical across all (role × status) combinations.

## Anatomy (top-down)

1. **App-header chrome strip** (y=0..64) — shared with all post-login pages.
2. **"‹ Back to Dashboard" link** (y=108) — 14px `#868e96`, top-left. Routes to role-correct Dashboard.
3. **Header card** (y=120..288, 880×168, 6px radius, `#dee2e6` 1px border):
   - **Left column (stacked metadata):**
     - Ticket number `#HD-47` (13px monospace `#868e96`, click to copy)
     - Title (24px semibold `#212529`, single-line ellipsised)
     - Status badge pill + Priority badge pill (y=210..232)
     - Metadata row: Owner / Submitter / Created / Category (labels y=262, values y=278)
   - **Right column (action zone, role- and state-dependent):**
     - **Open / In Progress, Agent or Admin:** `[+ Comment] [Change status ▾] [Reassign] [Change priority ▾]`
     - **Open / In Progress, Employee:** `[+ Comment]`
     - **Resolved, Employee:** `[+ Comment] [Reopen] [Confirm (close)]`
     - **Resolved, Agent:** `[+ Comment] [Reassign] [Change priority ▾]`
     - **Closed (any role):** single subdued text `Closed · read-only`. No buttons.
4. **Description block** (y=316..) — section heading "DESCRIPTION" (11px uppercase tracked `#868e96`), then the original Create Ticket Description rendered as the first message of the conversation thread (not duplicated).
5. **Comments block** — section heading "COMMENTS (N)", then each comment:
   - Author name + role badge "Employee" / "Support Agent" + timestamp
   - Subtle 3px left border in the role-badge color (Employee `#adb5bd`, Support Agent `#4263eb`)
   - Body text below the meta
   - **Composer at the bottom:** single-line textarea growing to 4 lines max, placeholder "Type a comment…", Send button right-aligned.
6. **Activity log** — section heading "ACTIVITY LOG", then each entry:
   - `• <event-type> — <actor> <human-timestamp>` on a single line
   - Read-only
   - Chronological (oldest first)

## Layout dimensions

- Content column: 880px wide, centered at x=720 (x=280..1160)
- Section spacing: 32px vertical between header / Description / Comments / Activity
- Header card padding: 24px
- Comment meta → body spacing: 8px
- Comment-to-comment spacing: 16px
- Activity log row spacing: 4px (compact, designed for skimming)
- Section heading style: 11px uppercase, tracked, `#868e96`

## Action matrix (cross-reference)

| Role | Status | Add comment | Change status | Reassign owner | Change priority | Reopen | Confirm (close) |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Employee | Open | ✓ | — | — | — | — | — |
| Employee | In Progress | ✓ | — | — | — | — | — |
| Employee | Resolved | ✓ | — | — | — | ✓ | ✓ |
| Employee | Closed | — | — | — | — | — | — |
| Agent | Open | ✓ | ✓ | ✓ | ✓ | — | — |
| Agent | In Progress | ✓ | ✓ | ✓ | ✓ | — | — |
| Agent | Resolved | ✓ | — | ✓ | ✓ | — | — |
| Agent | Closed | — | — | — | — | — | — |
| Admin | (same as Agent) | ✓ | ✓ | ✓ | ✓ | — | — |

Full matrix lives in [role-aware-action-matrix](../05-patterns/role-aware-action-matrix.md).

## States (cross-reference)

- **Default (Open / In Progress, Employee)** — action zone has `[+ Comment]` only.
- **Default (Open / In Progress, Agent)** — full action zone.
- **Resolved (Employee)** — Reopen + Confirm dialogs become available.
- **Resolved (Agent)** — `Change status` is hidden (Eli owns the Resolved → Open / Closed transitions).
- **Closed (any role)** — composer hidden; action zone collapses to "Closed · read-only".
- **Loading** — skeleton placeholders for header + sections. No spinner.
- **Not found (404)** — single centered card "Ticket not found." + "Back to Dashboard".
- **Forbidden (403)** — single centered card "You don't have access to this ticket. Back to Dashboard."

## Tokens Used

- All app-header-chrome tokens
- All [badge-status](../02-atoms/badge-status.md) tokens (Open / In Progress / Resolved / Closed colors)
- All [badge-priority](../02-atoms/badge-priority.md) tokens
- [avatar](../02-atoms/avatar.md) tokens (with role border for Owner)
- [button](../02-atoms/button.md) tokens for action-zone buttons
- [form-field](../03-molecules/form-field.md) tokens for the comment composer
- [dialog-modal](../03-molecules/dialog-modal.md) tokens for Reopen / Confirm confirmation dialogs
- [divider](../02-atoms/divider.md) tokens for 1px section separators
- [link](../02-atoms/link.md) tokens for "Back to Dashboard"
- `color-role-employee` (`#adb5bd`), `color-role-support-agent` (`#4263eb`) for comment left borders
- `space-content-column` (880px), `space-section-gap` (32px)

## Used In

- **Ticket Detail** (`ticket-detail.md`): the canonical organism. The 9 Phase 4 page specs all reference this page as the destination for click-through navigation.

## See also

- [app-header-chrome](../03-molecules/app-header-chrome.md) — persistent strip.
- [form-field](../03-molecules/form-field.md) — comment composer atom-level spec.
- [confirmation-dialog](../05-patterns/confirmation-dialog.md) — Reopen / Confirm pattern.
- [role-aware-action-matrix](../05-patterns/role-aware-action-matrix.md) — the cross-page pattern that determines which action buttons render.
- [inline-error](../05-patterns/inline-error.md) — error pattern for the composer + action-zone POSTs.
