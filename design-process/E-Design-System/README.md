# HelpDesk Lite — Design System (handoff to Mimir / Phase 6)

This folder is the **single source of truth** for HelpDesk Lite's design system. It contains the consolidated visual tokens and component library extracted from the 9 Phase 4 page specs. Phase 6 (Mimir implementation) consumes these docs as the handoff contract.

---

## How to read this folder

1. **Start with [`00-design-system.md`](00-design-system.md)** — index, scope, and how this folder is organized.
2. **Then [`01-design-tokens.md`](01-design-tokens.md)** — every visual token (color, type, spacing, shadow, radius, border, focus ring) in one place. Cross-referenced from every component.
3. **Atoms, molecules, organisms, patterns** — the component library, organized by atomic-design tier:
   - [`02-atoms/`](02-atoms/) — 13 basic building blocks (button, input, badge, avatar, etc.).
   - [`03-molecules/`](03-molecules/) — 11 composed components (form field, kanban card, status card, etc.).
   - [`04-organisms/`](04-organisms/) — 6 page-level compositions (Login form, Ticket Detail, Kanban board, etc.).
   - [`05-patterns/`](05-patterns/) — 7 cross-page behavior patterns (app chrome, confirmation dialog, role-aware action matrix, etc.).
4. **Phase 4 specs** in `design-process/D-UX-Design/` — the source of truth for each component's context, behavior, and acceptance criteria. Each component doc in this folder cross-references its source spec(s).

---

## Source-of-truth map (Phase 4 → Phase 5)

Every component and pattern in this folder traces back to one or more Phase 4 specs. The Phase 4 specs include wireframes, in-context screenshots, and acceptance criteria; the Phase 5 docs consolidate the reusable parts.

| Phase 4 spec | Phase 5 components / patterns |
|---|---|
| [`D-UX-Design/login.md`](../D-UX-Design/login.md) | [login-form](04-organisms/login-form.md), [form-field](03-molecules/form-field.md), [button](../02-atoms/button.md), [link](../02-atoms/link.md) |
| [`D-UX-Design/ticket-detail.md`](../D-UX-Design/ticket-detail.md) | [ticket-detail-page](04-organisms/ticket-detail-page.md), [comment composer variant of form-field](03-molecules/form-field.md), [role-aware-action-matrix](05-patterns/role-aware-action-matrix.md), [confirmation-dialog](05-patterns/confirmation-dialog.md), [inline-error](05-patterns/inline-error.md) |
| [`D-UX-Design/submission-confirmation.md`](../D-UX-Design/submission-confirmation.md) | [check-circle](../02-atoms/check-circle.md), [button](../02-atoms/button.md), [link](../02-atoms/link.md) |
| [`D-UX-Design/create-ticket.md`](../D-UX-Design/create-ticket.md) | [create-ticket-form](04-organisms/create-ticket-form.md), [form-field](03-molecules/form-field.md), [form-field-dropdown](03-molecules/form-field-dropdown.md), [inline-error](05-patterns/inline-error.md), [server-error-state](05-patterns/server-error-state.md) |
| [`D-UX-Design/employee-dashboard.md`](../D-UX-Design/employee-dashboard.md) | [ticket-row](03-molecules/ticket-row.md), [empty-state](03-molecules/empty-state.md), [loading-skeleton](05-patterns/loading-skeleton.md), [server-error-state](05-patterns/server-error-state.md) |
| [`D-UX-Design/agent-kanban.md`](../D-UX-Design/agent-kanban.md) | [kanban-board](04-organisms/kanban-board.md), [kanban-card](03-molecules/kanban-card.md), [form-field-dropdown](03-molecules/form-field-dropdown.md), [role-aware-action-matrix](05-patterns/role-aware-action-matrix.md) |
| [`D-UX-Design/admin-dashboard.md`](../D-UX-Design/admin-dashboard.md) | [admin-dashboard-page](04-organisms/admin-dashboard-page.md), [status-summary-card](03-molecules/status-summary-card.md), [tab-switcher](03-molecules/tab-switcher.md) |
| [`D-UX-Design/users-tab.md`](../D-UX-Design/users-tab.md) | [users-table-page](04-organisms/users-table-page.md), [self-row-table](03-molecules/self-row-table.md), [form-field-dropdown](03-molecules/form-field-dropdown.md), [confirmation-dialog](05-patterns/confirmation-dialog.md) |
| [`D-UX-Design/header-profile-logout.md`](../D-UX-Design/header-profile-logout.md) | [app-header-chrome](03-molecules/app-header-chrome.md), [dropdown-panel](03-molecules/dropdown-panel.md), [dialog-modal](03-molecules/dialog-modal.md), [app-chrome](05-patterns/app-chrome.md) |

---

## What's in MVP vs deferred

### In MVP

- 13 atom components (button, input-text, textarea, select, label, badge-status, badge-priority, badge-role, avatar, link, divider, check-circle, caret).
- 11 molecule components (form-field, form-field-dropdown, ticket-row, kanban-card, status-summary-card, self-row-table, app-header-chrome, tab-switcher, dropdown-panel, dialog-modal, empty-state).
- 6 organisms (login-form, ticket-detail-page, kanban-board, admin-dashboard-page, users-table-page, create-ticket-form).
- 7 patterns (app-chrome, confirmation-dialog, role-aware-action-matrix, empty-state, loading-skeleton, server-error-state, inline-error).
- Consolidated visual tokens (colors, typography, spacing, shadows, radii, borders, focus ring).

### Deferred to v1.x or beyond

These are explicitly out of MVP and appear in Phase 4 spec §Open Questions but are NOT in this design system:

- **Figma library export** — project hasn't adopted Figma; markdown docs + wireframes are the visual reference.
- **Dark mode** — out of MVP; theme tokens single-mode only.
- **Interactive HTML component showcase** — would be valuable for QA / engineer handoff but out of scope for Phase 5 documentation.
- **Profile picture upload** — avatars are initials-on-grey; no image upload in MVP.
- **Email notifications** — none in MVP; no "email sent" copy.
- **Editable profile fields** — name, email, password change are via the auth backend, not the UI.
- **"Active sessions" list** — see / sign out of other devices is out of MVP.
- **Notification preferences** — out of MVP.
- **Live updates / websockets** — out of MVP; pages refresh on navigation.
- **Search / sort / filter on Users tab** — alphabetical sort only; search box is v1.x.
- **Pagination / infinite scroll on dashboards** — pages are scrollable; "Load more" is v1.x.
- **Touch / mobile drag-and-drop on Kanban** — desktop-first; touch is v1.x.
- **Keyboard shortcuts** (J/K comments, `c` focus composer, `r` Reopen, `e` Confirm) — out of MVP spec.
- **Attachment MIME whitelist** — all file types accepted in MVP; v1.1 hardening.
- **Description Markdown / rich text** — plain text with line breaks preserved.
- **Auto-save on blur** — form state preserved client-side only on 401-redirect.
- **Status-filter drill-down on Admin Dashboard cards** — card top is display-only in MVP.
- **"Show all N →" expansion on Admin Dashboard card footer** — footer is muted and non-interactive in MVP.
- **Date-range filter on Admin Dashboard Closed card** — all-time totals in MVP.
- **Column-collapse on Kanban** — all 4 columns visible in MVP.
- **Saved filter presets on Kanban** — out of MVP.

---

## Handoff-ready checklist

The following is the handoff status as of Phase 5 close. Each line is a category that Mimir (Phase 6) needs to deliver the implementation:

| Category | Status | Notes |
|---|---|---|
| Visual tokens documented | ✅ Complete | See [`01-design-tokens.md`](01-design-tokens.md). |
| Component library documented | ✅ Complete | 13 atoms + 11 molecules + 6 organisms + 7 patterns = 37 component docs. |
| Source-of-truth cross-references | ✅ Complete | Every component doc cites its Phase 4 spec. |
| Wireframes (Phase 4) | ✅ Complete | 9 wireframes at 1440×900 PNG. Source for visual layout decisions. |
| Action matrix | ✅ Complete | See [role-aware-action-matrix](05-patterns/role-aware-action-matrix.md). Single source of truth. |
| Empty / loading / error patterns | ✅ Complete | See [empty-state](03-molecules/empty-state.md), [loading-skeleton](05-patterns/loading-skeleton.md), [server-error-state](05-patterns/server-error-state.md), [inline-error](05-patterns/inline-error.md). |
| Confirmation dialog pattern | ✅ Complete | See [confirmation-dialog](05-patterns/confirmation-dialog.md). 5 instances use the same shape. |
| Figma library | ❌ Deferred | Out of MVP. Markdown + wireframes serve as visual reference. |
| Interactive HTML showcase | ❌ Deferred | Out of MVP. Optional v1.x enhancement. |
| Dark mode tokens | ❌ Deferred | Out of MVP. |

---

## Open questions

None of the structural design decisions remain unresolved as of Phase 5 close.

Phase 4 spec §Open Questions remain open at the implementation level (see individual spec files). They are deferred to Phase 6 / Mimir handoff discussions.

---

## How this folder was produced

Phase 5 is a documentation pass, not a design pass. The work has been done alongside Phase 4 (each spec already documents tokens + uses consistent vocabulary); Phase 5 reorganizes that work into atomic design tiers (tokens → atoms → molecules → organisms → patterns).

Per the WDS Phase 5 guide, no new visual design or wireframes are introduced here. The Phase 4 specs and their wireframes remain the canonical visual reference; the Phase 5 docs are the structural cross-reference for implementation handoff.

---

_Produced by Freya — 2026-09-14_
_Source: design-process/D-UX-Design/*.md (9 Phase 4 specs), design-process/A-Product-Brief/product-brief.md (MVP scope), WDS Phase 5 guide (atomic design tiers)._
