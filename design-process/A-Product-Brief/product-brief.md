# Product Brief — HelpDesk Lite

2026-09-14

## Vision

Make every support request visible, owned, and traceable — without the weight of a tool built for someone else's scale.

HelpDesk Lite exists to give a small team (5–20 people) one simple place to manage support requests instead of losing them across Slack, email, and direct messages. Every request is visible, clearly owned, and traceable from creation to resolution. The product reduces confusion about who is responsible for a request, makes progress easy to see, and keeps the support workflow simple without adding unnecessary enterprise features.

## Positioning

HelpDesk Lite is the internal support tool for small teams (5–20 people) who have outgrown Slack-and-memory but refuse to adopt enterprise ITSM tooling.

- **Primary users:** Employees (request-side) and Support Agents (work-side), both inside small teams of 5–20.
- **Trigger for adoption:** the team has hit the ceiling of "Slack and memory" — requests getting lost, ownership unclear, history missing — and refuses the weight of a service-management suite.
- **The wedge:** employees get one obvious place to ask and check status; whoever holds the "Support Agent" permission gets a Kanban queue with clear ownership and full per-ticket history. Enterprise visibility and traceability, without enterprise overhead.

The product explicitly does **not** position as a Jira/ServiceNow/Zendesk competitor. The fit-for-scale argument is the wedge.

## Business Model

Internal tool, not a commercial product.

The company funds development and maintenance for its own small teams. There is no external monetization, no subscription tier, no SaaS distribution. Success is operational, not financial.

## Business Customers

Not applicable. HelpDesk Lite is an internal tool with no external buyer. The "business customer" question (buyer-vs-end-user split, procurement path) does not apply.

## Target Users

Three roles, two primary user archetypes; Admin is a permission overlay on the Agent role.

### Employee (request-side user)

Files a request when blocked, expects to come back to it days later without losing context, and uses ticket status as the *substitute for memory* — no more "where did I send that?". The product's job for this user is to make the request feel *deposited* (clearly received, clearly owned) rather than *dispatched and forgotten*.

**The 5-second problem.** Trust is decided in the first few seconds after submitting. The Employee must see all three at once: (1) a "ticket created" confirmation, (2) a unique ticket number they can refer back to, (3) the ticket in their list immediately. That triplet is what kills the Slack fallback.

### Support Agent (work-side user)

Owns the queue. The day starts on the Agent Dashboard — a Kanban board (Open / In Progress / Resolved / Closed) — and the work is triage, take ownership, respond, update status, close.

**At-a-glance needs, in priority order:**
1. What's open and unowned — the orphans. If the queue hides them, they vanish.
2. Who owns what — and whether the owner is *them* (today's work) or someone else (today's wait list).
3. Status — not for vanity, but because Resolved is the trigger to check back with the requester, Closed is the signal the loop is done, In Progress is what someone is mid-flight on.

The Agent's frustration is the *inverse of visibility* — scattered channels, vague ownership, opaque status.

### Admin (permission overlay, not a third archetype)

Uses the same Agent Dashboard as the Support Agent with one addition: a Users tab for basic user and role management, including activating or deactivating users. No separate dashboard or complex administration workflow.

## Product Concept

HelpDesk Lite is a lightweight internal support ticketing system for small teams — a single place where employees submit and track requests, while support agents manage, assign, and resolve those requests with clear ownership and status.

### Founding principle

**The ticket is the atomic unit of work.** Comments, status changes, ownership changes, and the complete history all belong to the ticket. The product's value comes from the completeness of one record, not from any single feature.

### Status semantics

- **Open → In Progress → Resolved → Closed** is the normal flow.
- **Resolved → Reopen → Open** is a loop. A Resolved ticket can be reopened and returns to Open while keeping its existing history and comments.
- **Closed is terminal.** A Closed ticket cannot be reopened. If the issue returns, a new ticket must be created.

The distinction matters: Closed means *done, audited, archived* (the Employee has confirmed); Resolved means *the Agent believes it's done but the Employee hasn't yet confirmed*.

## Success Criteria

Measured 12 months after launch. Operational metrics, not financial.

- **Adoption:** ≥80% of internal support requests flow through HelpDesk Lite within 90 days of launch. Below this, fallback channels are still winning.
- **Resolution time:** median time from ticket creation to Resolved is under 2 business days. Tight enough to detect queue bloat; loose enough that high-priority work doesn't dominate the number.
- **Reopen rate:** <15% of Resolved tickets are reopened within 14 days. Above this, either triage is wrong or the "Resolved" definition is loose.
- **Employee satisfaction:** ≥85% of employees report they can easily track the status of their requests (measured by a simple internal feedback survey). Catches a tool that is fast but cold.

Together, these four metrics cover visibility (adoption), flow (resolution time), quality (reopen rate), and request-side experience (satisfaction).

## Competitive Landscape

### Direct alternative #1 — Slack / email / DMs

Wins on friction; loses on durability, ownership, and status. The MVP does not try to out-Slack Slack; the failover mode is a **trust gap**, not a feature gap. Employees reach for Slack when they don't trust the ticket will be seen or acted on. The MVP earns that trust through immediate confirmation, a unique ticket number, clear ownership, visible status, and an easy way to track progress.

### Direct alternative #2 — enterprise ITSM (Jira Service Management, ServiceNow, Zendesk)

Wins on feature breadth; loses on fit-for-scale and time-to-value for teams of 5–20. The MVP deliberately does not carry the configuration surface those tools demand.

### Unfair advantage

Neither alternative offers both: a *permissioned, durable record* of every support request with *explicit ownership and status*, delivered with zero configuration overhead for a small team.

### Origin

Greenfield. No prior tool was tried and rejected. The project grew from the team's pain with managing support across Slack, email, and DMs.

## Constraints

Gating principle: every feature decision in the rest of this brief and downstream documents should be tested against these constraints.

**Hard walls for MVP:**
- **Build capacity is limited.** This is a training/MVP project. Every feature must justify its cost.
- **Time-to-useful is short.** First useful version must demonstrate the core ticket workflow; no enterprise features in MVP.
- **Tech stack is fixed.** Use the existing application stack. No new technologies introduced for the MVP.

**Deferred (to be confirmed with the first team):**
- Data integration
- Deployment environment
- SSO / identity provider
