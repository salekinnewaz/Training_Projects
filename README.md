# HelpDesk Lite

An internal web-based ticket management system for small teams (5–20 people). Employees create tickets; Support Agents work them through a clear lifecycle; the system keeps a complete record of every request and every status change.

This repository contains the **design artifacts** (PRD, product brief, UX specs, design system, tech stack lock) and the **implementation** (Angular 17 frontend + Express/TypeScript backend + MySQL via Sequelize).

---

## Repository layout

```
Training_Projects/
├── PRD.md                                # Product requirements (source of truth)
├── project_idea.md
├── design-process/                       # WDS design artifacts (Phases 1–5)
│   ├── A-Product-Brief/                  # Phase 1
│   ├── B-Trigger-Map/                    # Phase 2
│   ├── C-UX-Scenarios/                   # Phase 3
│   ├── D-UX-Design/                      # Phase 4 — 9 page specs + wireframes
│   ├── E-Design-System/                  # Phase 5 — tokens + atoms + molecules + organisms + patterns
│   ├── F-Tech-Stack/                     # Locked tech stack (2026-09-15)
│   └── G-Mimir-Handoff/                  # Phase 6 kickoff brief (16 stories)
├── frontend/                             # Angular 17 standalone + plain CSS
├── backend/                              # Express + TypeScript + Sequelize
├── docker-compose.yml                    # MySQL 8 for local dev
├── package.json                          # npm workspaces root
└── .env.example                          # Template — copy to .env
```

---

## Prerequisites

- **Node.js 20+** (tested on Node 26.8 / npm 11)
- **Docker Desktop** (for MySQL 8 container)
- **Angular CLI is NOT required** — the repo uses `npx @angular/cli@17` so the version is pinned

---

## Quick start

```bash
# 1. Install all workspace dependencies
npm install

# 2. Start MySQL (container)
npm run docker:up

# 3. Copy environment template
cp .env.example .env
cp backend/.env.example backend/.env   # backend reads its own .env via dotenv

# 4. Run migrations (currently a single bootstrap migration in HD-001)
npm run db:migrate

# 5. Start both apps concurrently (Angular on 4200, Express on 3000)
npm run dev
```

Open `http://localhost:4200` in a browser — the Angular shell routes to `/login` and renders a styled placeholder using the design system tokens. `curl http://localhost:3000/api/health` returns `{ "status": "ok", ... }`.

---

## Common scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run dev:backend` | Start only the backend (port 3000) |
| `npm run dev:frontend` | Start only the Angular dev server (port 4200) |
| `npm run build` | Build both workspaces for production |
| `npm run typecheck` | Type-check the backend (`tsc --noEmit`) |
| `npm run db:migrate` | Apply pending Sequelize migrations |
| `npm run db:migrate:undo` | Roll back the most recent migration |
| `npm run db:migrate:undo:all` | Roll back every migration (use before `db:reset`) |
| `npm run db:reset` | Undo all → migrate → seed (HD-002 onwards) |
| `npm run docker:up` / `docker:down` | Start/stop the MySQL container |
| `npm run docker:logs` | Tail MySQL container logs |
| `npm run docker:ps` | Show container status |

---

## Tech stack (locked 2026-09-15)

| Layer | Choice |
|---|---|
| Frontend | Angular 17 (standalone components, plain CSS) |
| Backend | Node.js 20+ / Express |
| Database | MySQL 8 |
| ORM | Sequelize |
| Auth | Email + password, JWT, bcrypt (lands in HD-003) |

Full rationale and open questions: `design-process/F-Tech-Stack/tech-stack.md`.

---

## Implementation status

This repo is at **WDS Phase 6 / Story HD-001 (scaffolding)**. The plan is 16 stories total — see `design-process/G-Mimir-Handoff/phase-6-kickoff.md` for the full breakdown.

Subsequent stories land in independent slices:

- **Milestone A — Foundation (P0):** HD-001 scaffolding → HD-002 models → HD-003 auth → HD-004 chrome → HD-005 login page → HD-006 route guards
- **Milestone B — Employee flow (P0):** HD-007 dashboard → HD-008 create ticket → HD-009 submission confirmation → HD-010 ticket detail → HD-011 comments + activity log
- **Milestone C — Agent + Admin (P1):** HD-012 kanban → HD-013 admin Dashboard tab → HD-014 admin Users tab → HD-015 tickets API filters → HD-016 attachments

---

## Source of truth

When in doubt, refer back to the design artifacts (in this order):

1. `PRD.md` — what we're building
2. `design-process/D-UX-Design/*.md` — how every page is supposed to behave
3. `design-process/E-Design-System/01-design-tokens.md` — visual vocabulary
4. `design-process/G-Mimir-Handoff/phase-6-kickoff.md` — what to build next
