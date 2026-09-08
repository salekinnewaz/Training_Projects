---
title: HelpDesk Lite — Product Brief
status: ready for review
created: 2026-09-06
updated: 2026-09-06
project: Training_3
author: Salekinnewaz
---

# HelpDesk Lite

## Problem

A small team (5–20 people) loses support requests across Slack, email, and DMs. Nothing has a clear owner, priorities are invisible, and there's no record of what was asked, what was fixed, and what was reopened. When someone is on holiday, their open questions vanish with them.

## Who It's For

**Employees** at a small company who need one obvious place to ask for help and check what's happening with their request.

**Support agents** who need a clear queue, visible ownership and priority, and the history of every ticket so context isn't lost between handoffs.

The team size is 5–20 people total — the product is built for this scale on purpose and is not intended to scale beyond it for the MVP.

## What It Is

A simple web-based ticket management system. Employees create tickets; support agents work them through a clear lifecycle; the system keeps a complete record of every request and every status change.

The MVP borrows two familiar patterns deliberately so the product feels obvious on first use:
- A **Trello-style board** for the agent queue — tickets as cards, status columns (Open, In Progress, Resolved, Closed), drag-to-update, filter and search.
- A **GitHub Issues-style detail view** — description, status, priority, assignee, and comments together in one place.

## Why It Matters

Replacing scattered conversations with a single, traceable workflow gives the team:
- **One source of truth** — no more hunting through Slack threads to find what was promised.
- **Visible ownership** — every ticket has one agent responsible for it.
- **Persistent history** — when a ticket is reopened, the original context, conversation, and prior resolution are right there.
- **Triageable backlog** — priority is visible at a glance, so urgent work doesn't hide.

## Scope

### In scope (MVP)

- **2 roles**: User, Support Agent
- **3 entities**: User, Ticket, Comment
- **Ticket fields**:
  - Title (required)
  - Description (required)
  - Category — IT / HR / Finance / General (optional at create)
  - Priority — Low / Medium / High
  - Status — Open → In Progress → Resolved → Closed
  - Assignee — current responsible agent
  - Auto-managed: Ticket ID, Created By, Created Date, Updated Date
- **Comments**: simple notes for agent updates and user replies — a shared conversation history on each ticket
- **Workflow**:
  - Agents can create tickets on behalf of users (walk-up/phone scenarios)
  - Status changes follow: Open → In Progress → Resolved → Closed
  - User can reopen a ticket **only while it is in Resolved** — once Closed, the user must create a new ticket
- **Auth & access**:
  - Email/password login
  - Role-based UI (User sees their own tickets; Agent sees the full queue)
- **UI**:
  - User Dashboard — my tickets, create new
  - Agent Dashboard — Trello-style board with filter + search
  - Create Ticket — minimal form (title, description, optional category)
  - Ticket Details — GitHub Issues-style layout
  - User Management — single combined view (profile + role)

### Out of scope (parked for later)

- Admin role and admin dashboard
- File attachments on tickets
- Advanced notifications (email digests, push, Slack integration)
- Analytics beyond "what's open / what's mine"
- SLA timers, escalation rules
- Multi-tenancy, audit logs, SSO

## Done Looks Like

The MVP is complete when, end to end, an employee can submit a request, an agent can pick it up, work it through the workflow, and the team has a preserved record — including reopen — for at least 5–20 users, with role-based access working throughout.

Specifically:
1. An employee signs in, creates a ticket with title, description, and optional category. It appears as Open.
2. An agent signs in, sees the Open ticket on the board, assigns it to themselves, and moves it to In Progress.
3. The agent adds comments as they work; the user can read them.
4. The agent marks it Resolved. The user reopens it because the issue is not actually fixed; the ticket returns to In Progress with full history intact.
5. The agent re-resolves; the user confirms by marking it Closed. Closed is terminal.

## Success Criteria

- A real team of 5–20 uses HelpDesk Lite instead of Slack/email/DMs for support requests
- Every ticket has a visible owner at all times
- Reopening a resolved ticket preserves the full history without manual copying
- New tickets can be created and updated in under 30 seconds

## Open Questions

- Deployment target: self-hosted on a single VM, or a small PaaS (Fly.io, Railway, Render)? — to be decided at architecture phase
- Authentication: simple email/password with hashed credentials, or magic-link email login? — to be decided at architecture phase
- Data store: a relational DB (Postgres/SQLite) is implied; engine to be confirmed at architecture phase

## Notes

This brief was produced from a brainstorming session whose full decision log lives at `_bmad-output/brainstorming/brainstorm-helpdesk-lite-2026-09-06/.memlog.md`. Decisions on MVP simplification (2 roles, 3 entities, no admin, no attachments, no advanced notifications) are anchored there.
