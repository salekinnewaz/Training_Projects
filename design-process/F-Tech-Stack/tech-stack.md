---
title: HelpDesk Lite — Tech Stack
status: locked
locked_on: 2026-09-15
project: Training_3
phase: Phase 6 preparation (Mimir handoff)
---

# HelpDesk Lite — Tech Stack (Phase 6 Handoff Contract)

This document is the locked implementation contract between Phase 5 (Design System) and Phase 6 (Mimir implementation). Mimir must build HelpDesk Lite against this stack unless an explicit override is approved.

---

## Frontend

| Decision | Value |
|---|---|
| Framework | **Angular 17+** |
| Component style | **Standalone components** (no NgModules) |
| Styling | **Plain CSS** — component-scoped `styleUrls` |
| UI library | **None** — no Angular Material, no PrimeNG, no Tailwind |
| Routing | Angular Router |

**Rationale:**
- The Phase 5 design system is framework-agnostic (atoms/molecules/organisms/patterns). Angular components map 1:1 to those tiers.
- "Plain CSS, no UI library" matches the design philosophy in `E-Design-System/00-design-system.md`: *"Phase 5 is documentation, not new design"*. A UI library would impose its own theming and diverge from the approved wireframes.
- The wireframes use Bootstrap-flavored tokens (`#212529`, `#495057`, etc.) but **the project did not adopt Bootstrap**. Plain CSS keeps the visual vocabulary exactly as documented in `E-Design-System/01-design-tokens.md`.

**Component mapping (WDS tier → Angular):**

| WDS tier | Angular artifact |
|---|---|
| Atom (13) | Standalone component in `src/app/components/atoms/<name>/` |
| Molecule (11) | Standalone component in `src/app/components/molecules/<name>/` |
| Organism (6) | Standalone component in `src/app/pages/<page-name>/` |
| Pattern (7) | Service or directive in `src/app/patterns/` |

---

## Backend

| Decision | Value |
|---|---|
| Runtime | **Node.js** (LTS, 20.x or later) |
| Framework | **Express** |
| ORM | **Sequelize** against MySQL |
| Auth | **JWT (short-lived) + bcrypt** |
| API style | REST (resource-oriented) |
| Migrations | Sequelize migrations |

**Rationale:**
- Express + Sequelize is the standard "boring technology" choice for Node + MySQL. Fits WDS's preference for boring tech over flashy stacks.
- JWT + bcrypt matches the Phase 4 `login.md` decision: *"Login = email + password, no SSO"*.
- REST resource-oriented API fits the 5 entities (users, tickets, comments, attachments, activity_log) implied by the 9 page specs.

---

## Database

| Decision | Value |
|---|---|
| Engine | **MySQL** (8.x) |
| Schema status | **To be designed by Mimir in Phase 6** |

**Implied entities from Phase 4 specs (Mimir must produce schema for):**

| Entity | Source |
|---|---|
| `users` | login.md, users-tab.md, header-profile-logout.md |
| `tickets` | ticket-detail.md, create-ticket.md, employee-dashboard.md, agent-kanban.md, admin-dashboard.md, submission-confirmation.md |
| `comments` | ticket-detail.md |
| `activity_log` | ticket-detail.md (every status change recorded) |
| `attachments` | create-ticket.md (drag-drop zone; storage strategy TBD) |

---

## Authentication

| Decision | Value |
|---|---|
| Method | **Email + password** (no SSO; SSO deferred) |
| Password hashing | **bcrypt** (cost factor 10–12) |
| Token | **JWT**, short-lived (e.g., 1-hour expiry) |
| Storage | **Open question** — see below |

---

## Open Questions for Mimir (Phase 6)

These are decisions that must be resolved during Mimir implementation. They are not blockers for handoff but must be answered before specific code is written:

1. **JWT storage** — `localStorage` (simpler, XSS-exposed) vs `httpOnly cookie` (CSRF concerns, more secure). Recommendation: `httpOnly cookie` for an internal tool; confirm with stakeholder.
2. **Attachment storage** — filesystem path on the Express server vs S3-compatible object store vs MySQL BLOB. Recommendation: filesystem for MVP (single-server deployment), with a service abstraction so S3 can be swapped in v1.x.
3. **Project layout** — monorepo (`frontend/` + `backend/` at project root with a top-level `package.json` for orchestration) vs two separate repos. Recommendation: monorepo for the MVP; matches the single-team deployment story.
4. **Sequelize migration runner** — `sequelize-cli` vs custom scripts. Recommendation: `sequelize-cli` (standard).
5. **CORS** — needed because frontend (Angular) and backend (Express) are separate dev servers in development. Recommendation: `cors` middleware with allowlist for the Angular dev server origin.
6. **Environment config** — `dotenv` with `.env.development` / `.env.production`. Standard.
7. **Testing** — Jest for both frontend (Angular's default) and backend (Express). Phase 5 deferred interactive testing; Mimir's standard test setup applies.

---

## Routes (locked from Phase 4 specs)

| Route | Component / Page | Source |
|---|---|---|
| `/login` | Login | login.md |
| `/dashboard` | Employee Dashboard (My Tickets) | employee-dashboard.md |
| `/tickets/new` | Create Ticket | create-ticket.md |
| `/tickets/:id` | Ticket Detail View (role-aware) | ticket-detail.md |
| `/tickets/:id/created` | Submission Confirmation | submission-confirmation.md |
| `/queue` | Agent Kanban (Support-Agent-only) | agent-kanban.md |
| `/admin` | Admin Dashboard (two tabs: Dashboard \| Users) | admin-dashboard.md |
| `/users` | Users tab | users-tab.md |
| (header overlay) | My Profile dropdown + Logout dialog | header-profile-logout.md |

---

## What stays out of MVP

These are explicit v1.x+ items per `E-Design-System/00-design-system.md` §Open Questions:

- Figma library export, interactive HTML showcase, dark mode
- Live updates / websockets (pages refresh on navigation)
- Email notifications
- Profile picture upload (avatars are initials-on-grey)
- Pagination / infinite scroll
- Touch / mobile drag-and-drop on Kanban
- Keyboard shortcuts
- Attachment MIME whitelist (all types accepted in MVP)
- Description Markdown / rich text (plain text with line breaks)
- Search / sort / filter on Users tab (alphabetical only)
- Status-filter drill-down on Admin Dashboard cards
- Date-range filter on Admin Dashboard Closed card
- Column-collapse on Kanban
- Saved filter presets on Kanban
- SSO (deferred to first-team deployment)

---

_Locked by: Salekinnewaz, 2026-09-15_
_Source: Phase 4 specs (`design-process/D-UX-Design/`), Phase 5 design system (`design-process/E-Design-System/`)._
