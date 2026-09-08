# Brief Discovery Notes

## Problem (sharpened)
A small team (5–20 people) loses support requests across Slack, email, and DMs — no single source of truth, ownership is fuzzy, and there's no record of what was asked, fixed, or reopened.

## Product
HelpDesk Lite — a simple web-based ticket management system that gives employees one place to ask for help and support agents a clear queue to work it.

## Why
Replace scattered conversations with a single, traceable ticket workflow.

## Scope (MVP)
- 2 roles: User, Support Agent
- 3 entities: User, Ticket, Comment
- Ticket fields: title, description, priority (Low/Med/High), status (Open → In Progress → Resolved → Closed), assignee, category (IT/HR/Finance/General, optional at create), auto IDs + dates
- Comments: simple notes (agent updates + user reply)
- Workflow: agent can create on behalf of user; user can reopen only while Resolved (Closed = terminal)
- Auth + role-based access
- UI: Trello-style board for agents, GitHub Issues-style detail view, minimal create form
- Magnified: status, priority, assignee visible at a glance
- Minimized: creation form, comment surface

## Out of MVP (parked)
- Admin role
- Attachments
- Advanced notifications
- Categories beyond the four listed
- Any analytics/dashboard beyond "what's open / what's mine"

## Done looks like
An employee creates a ticket, an agent resolves it through the workflow, history is preserved across reopen — auth and roles work for 5–20 users.
