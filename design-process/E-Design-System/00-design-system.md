# HelpDesk Lite — Design System

**Project:** HelpDesk Lite
**Phase:** 5 — Design System (extracted from Phase 4 page specs)
**Status:** Complete, ready for Phase 6 (Mimir) handoff
**Last updated:** 2026-09-14

---

## What this is

This folder is the **consolidated component library and design tokens** for HelpDesk Lite. It was extracted from the 9 Phase 4 page specs (Login, Ticket Detail, Submission Confirmation, Create Ticket, Employee Dashboard, Agent Kanban, Admin Dashboard, Users tab, Header / My Profile / Logout). The visual vocabulary was already consistent across those specs; Phase 5 reorganizes that work into atomic-design tiers for clean handoff to implementation.

**Phase 5 is documentation, not new design.** No wireframes, no new components — every component documented here already appears in at least one Phase 4 spec. Use this folder as the *single source of truth* for what exists; the Phase 4 specs remain the source for *why* a decision was made.

## How to read this folder

```
00-design-system.md            ← you are here (index + scope)
01-design-tokens.md            ← colors, typography, spacing, shadows, radii, borders
02-atoms/                      ← 13 basic building blocks
03-molecules/                  ← 11 atoms combined
04-organisms/                  ← 6 page-level compositions
05-patterns/                   ← 7 cross-page behavior patterns
README.md                      ← handoff quick-start for Phase 6 (Mimir)
```

**Reading order for handoff:**
1. `01-design-tokens.md` — vocabulary.
2. `02-atoms/` — building blocks.
3. `03-molecules/` — composed components (most code reuse lives here).
4. `04-organisms/` — page-level structure.
5. `05-patterns/` — cross-page behavior (role-aware matrix, dialogs, errors).
6. Each Phase 4 spec for source-of-truth on intent: see `D-UX-Design/`.

## Scope

**In scope (MVP):**
- Web app, desktop-first, English.
- 3 roles: Employee, Support Agent, Admin (Admin = dedicated home at `/admin`).
- Visual tokens (colors, type, spacing, shadows, radii, borders).
- 30 reusable components across atoms / molecules / organisms.
- 7 cross-page behavior patterns.

**Out of scope (deferred to v1.x or not adopted):**
- **Figma component library export** — project hasn't adopted Figma; the 9 SVG wireframes in `D-UX-Design/wireframes/` serve as the visual reference.
- **Interactive HTML component showcase** — markdown docs + wireframes are sufficient for MVP; a renderable showcase is a v1.x enhancement.
- **Dark mode / theme switcher** — out of MVP (per `header-profile-logout.md` §Open Questions).
- **Touch / mobile layouts** — desktop-first per existing Phase 4 stance.
- **Implementation code** (React components, etc.) — this is the design system, not the implementation. Phase 6 / Mimir handoff consumes these docs to write code.

## Component inventory

### Atoms (13)

| Atom | Purpose | Used in |
|---|---|---|
| [button](02-atoms/button.md) | Primary / secondary action trigger | Login, Ticket Detail, Submission Confirmation, Create Ticket, Employee Dashboard, Header / My Profile / Logout |
| [input-text](02-atoms/input-text.md) | Single-line text field | Login, Create Ticket, Ticket Detail composer, Agent Kanban search |
| [textarea](02-atoms/textarea.md) | Multi-line text field | Create Ticket (Description), Ticket Detail composer |
| [select](02-atoms/select.md) | Dropdown for single-option selection | Create Ticket (Category, Priority), Agent Kanban (Priority, Category, Owner filters), Users tab (Role) |
| [label](02-atoms/label.md) | Form field label, status badge label, role badge label | (Universal) |
| [badge-status](02-atoms/badge-status.md) | Status pill (Open / In Progress / Resolved / Closed) | Ticket Detail, Submission Confirmation, Employee Dashboard, Agent Kanban, Admin Dashboard |
| [badge-priority](02-atoms/badge-priority.md) | Priority pill (Low / Medium / High) | Ticket Detail, Employee Dashboard, Agent Kanban |
| [badge-role](02-atoms/badge-role.md) | Role pill (Employee / Support Agent / Admin) | Header dropdown, Ticket Detail (owner border), Agent Kanban (owner border) |
| [avatar](02-atoms/avatar.md) | Initials-on-grey circle, 24/32 px | Ticket Detail, Agent Kanban, Users tab, Header dropdown |
| [link](02-atoms/link.md) | Inline text link (Back links, etc.) | Submission Confirmation, Create Ticket, Ticket Detail, Users tab, Agent Kanban (orphan Unassigned badge) |
| [divider](02-atoms/divider.md) | Horizontal hairline | Header dropdown panel, table rows, app-header bottom |
| [check-circle](02-atoms/check-circle.md) | Submission confirmation glyph | Submission Confirmation |
| [caret](02-atoms/caret.md) | Dropdown indicator (▾) | Header trigger, all `<select>` elements |

### Molecules (11)

| Molecule | Purpose | Used in |
|---|---|---|
| [form-field](03-molecules/form-field.md) | Label + required/optional micro-label + input + helper text + error | Login, Create Ticket, Ticket Detail composer |
| [form-field-dropdown](03-molecules/form-field-dropdown.md) | Label + dropdown control | Create Ticket (Category, Priority) |
| [ticket-row](03-molecules/ticket-row.md) | Mono number + title + status badge + priority badge + timestamp | Employee Dashboard |
| [kanban-card](03-molecules/kanban-card.md) | Title + meta row (number / priority / owner) | Agent Kanban |
| [status-summary-card](03-molecules/status-summary-card.md) | Status badge + count + recent-tickets list | Admin Dashboard |
| [self-row-table](03-molecules/self-row-table.md) | Table row with disabled controls + micro-label | Users tab (only) |
| [app-header-chrome](03-molecules/app-header-chrome.md) | Persistent 64px chrome strip (brand mark + My Profile ▾) | All 7 post-login pages |
| [tab-switcher](03-molecules/tab-switcher.md) | Right-aligned text tabs with active underline | Admin Dashboard |
| [dropdown-panel](03-molecules/dropdown-panel.md) | Anchored panel below trigger | Header / My Profile |
| [dialog-modal](03-molecules/dialog-modal.md) | Centered modal with scrim + headline + buttons | Header logout, Users tab (Admin demotion, Admin deactivation) |
| [empty-state](03-molecules/empty-state.md) | Centered muted CTA surface | Employee Dashboard (no tickets), Create Ticket (post-submit) |

### Organisms (6)

| Organism | Purpose | Phase 4 source |
|---|---|---|
| [login-form](04-organisms/login-form.md) | Email + password fields + Submit | `login.md` |
| [ticket-detail-page](04-organisms/ticket-detail-page.md) | Role-aware ticket page (header card + description + comments + activity log) | `ticket-detail.md` |
| [kanban-board](04-organisms/kanban-board.md) | 4-column drag-and-drop board with filter strip | `agent-kanban.md` |
| [admin-dashboard-page](04-organisms/admin-dashboard-page.md) | Two-tab page (Dashboard / Users) | `admin-dashboard.md` |
| [users-table-page](04-organisms/users-table-page.md) | User list with inline role + active controls | `users-tab.md` |
| [create-ticket-form](04-organisms/create-ticket-form.md) | 5-field ticket form with drag-drop attachment | `create-ticket.md` |

### Patterns (7)

| Pattern | Purpose | Used in |
|---|---|---|
| [app-chrome](05-patterns/app-chrome.md) | Persistent chrome vocabulary + brand-mark home navigation | All 7 post-login pages |
| [confirmation-dialog](05-patterns/confirmation-dialog.md) | Reusable confirm-before-destructive-action pattern | Logout, Admin demotion, Admin deactivation |
| [role-aware-action-matrix](05-patterns/role-aware-action-matrix.md) | Employee vs Agent × status visibility matrix | Ticket Detail (primary), Kanban (drag validation), Admin Dashboard (click-to-open) |
| [empty-state](05-patterns/empty-state.md) | "Nothing here yet" centered CTA | Employee Dashboard, Agent Kanban (column-scoped) |
| [loading-skeleton](05-patterns/loading-skeleton.md) | Grey-bar skeleton for in-flight fetches | All fetch-driven pages |
| [server-error-state](05-patterns/server-error-state.md) | Inline error above content | All fetch-driven pages |
| [inline-error](05-patterns/inline-error.md) | Field-level or row-level error | Login, Create Ticket, Ticket Detail composer, Users tab |

## Handoff-ready check

| Tier | Count | Status |
|---|---|---|
| Design tokens | 1 doc | ✓ |
| Atoms | 13 docs | ✓ |
| Molecules | 11 docs | ✓ |
| Organisms | 6 docs | ✓ |
| Patterns | 7 docs | ✓ |
| README | 1 doc | ✓ |

**Total: 39 documentation files.** All Phase 4 source pages are referenced. No components invented outside the existing 9 specs.

---

_Produced by Freya — 2026-09-14_
_Source: 9 Phase 4 page specs at `design-process/D-UX-Design/`. WDS Phase 5 guide at `/Users/bs00902/.claude/wds/docs/method/phase-5-design-system-guide.md`._
