# Feature Impact Analysis — HelpDesk Lite

> Phase 2 — Trigger Mapping · Workshop 5
> Derived from: 02-persona-sam-the-support-agent.md, 03-persona-eli-the-end-user.md
> Status: Draft — for review

---

## Scoring Method

Each candidate feature is scored against every persona's driving forces on a 0–3 scale:

- **0** — no impact on this force
- **1** — minor indirect impact
- **2** — meaningful impact
- **3** — directly addresses this force

Each score is weighted by the force's FIA total (divided by 15). Per-persona weighted totals are summed into a final **weighted impact score**. Higher score = stronger alignment with user psychology and business goals.

Two personas (Sam, Eli), 13 driving forces total (Sam: 7 forces P1/N1/15, P2/14, P3/12, N3/13, N2/10, N4/10; Eli: 6 forces P1/14, P2/14, P3/13, P4/11, N1/12, N3/11). Features are derived strictly from the forces; no features invented.

---

## Feature Scores

Per-persona weighted score = sum over each persona's driving forces of (feature_score × FIA_total / 15).
Total = Sam weighted + Eli weighted. Ranked by Total.

| Rank | Feature | Sam weighted | Eli weighted | Total | Priority |
|------|---------|--------------|--------------|-------|----------|
| 1 | **Agent Kanban board** (Open / In Progress / Resolved / Closed) | 9.87 | 2.40 | **12.27** | High |
| 2 | **Ticket detail view** (description, comments, status, owner, history) | 5.93 | 6.20 | **12.13** | High |
| 3 | **Owner field on every ticket card** | 5.53 | 4.20 | **9.73** | High |
| 4 | **Status transition control** (with audit trail) | 5.40 | 1.60 | **7.00** | High |
| 5 | **Comment thread per ticket** (with author + timestamp) | 1.60 | 4.07 | **5.67** | High |
| 6 | **My-tickets list / user dashboard** (visible immediately after submission) | 0.00 | 4.67 | **4.67** | High |
| 7 | **Submission confirmation screen** (ticket number, status, link) | 0.80 | 2.80 | **3.60** | High |
| 8 | **Reopen action on Resolved tickets** (preserves history) | 1.33 | 2.20 | **3.53** | High |
| 9 | **Ticket submission form** (title, description, priority, category) | 0.80 | 1.87 | **2.67** | High |
| 10 | **Admin Users tab** (activate/deactivate, assign role) | 0.67 | 0.00 | **0.67** | Medium |

---

## High Priority

Features that address the top-scored driving forces. Must be in the core product.

### 1. Agent Kanban board (Open / In Progress / Resolved / Closed) — Total 12.27
- **Forces addressed:** Sam P1 queue looks right (3), N3 ownership ambiguity (3), P2 nothing falls through (2), N1 fall-through no record (2), N2 dumping ground (1); Eli P3 visible traction (1), N1 silent ticket (1), N3 Slack fallback (1).
- **Design implication:** Sam's morning ritual. Columns = status. Cards carry title + owner + priority + age. The board must answer "what's open, who owns it, what's stale?" in one glance, every time. This is Sam's #1 force (score 15) and the highest-weighted single feature on the map.

### 2. Ticket detail view (description, comments, status, owner, history) — Total 12.13
- **Forces addressed:** Eli P2 returnable context (3), P3 visible traction (3), N1 silent ticket (1); Sam P3 my work is traceable (3), P2 nothing falls through (2), N4 closing-but-not-fixed (1).
- **Design implication:** One place that holds everything: description, status, owner, comment thread, full history (status changes, reassignments, reopen events). This is the atomic unit of the product (per the founding principle in the brief). Without this, no other feature has meaning — it's where the request *lives*.

### 3. Owner field on every ticket card (visible at-a-glance) — Total 9.73
- **Forces addressed:** Sam N3 ownership ambiguity (3), P1 queue looks right (2), P2 nothing falls through (1); Eli P3 visible traction (3), N1 silent ticket (2).
- **Design implication:** Owner shown on every list/card/detail. Goal 3's ownership-visibility objective (≥95%) lives or dies here. Without it, the orphan problem cannot be detected at-a-glance and Eli's silent ticket dread is unaddressed.

### 4. Status transition control (with audit trail) — Total 7.00
- **Forces addressed:** Sam P1 queue looks right (2), P2 nothing falls through (2), N3 ownership ambiguity (1), N2 dumping ground (1); Eli P3 visible traction (1), P4 closure that's real (1).
- **Design implication:** Transitions along the lifecycle (Open → In Progress → Resolved → Closed) with the Resolved↔Open reopen loop. Audit trail required for Goal 3 (handover integrity) and Goal 1 (queue hygiene). Closed is terminal.

### 5. Comment thread per ticket (with author + timestamp) — Total 5.67
- **Forces addressed:** Eli N2 explaining twice (3), P2 returnable context (2); Sam P3 my work is traceable (2).
- **Design implication:** Per-ticket threaded comments with author and timestamp. The history that lets Eli come back without re-explaining and lets Sam hand off without losing context. Comments belong to the ticket (the founding principle).

### 6. My-tickets list / user dashboard (visible immediately after submission) — Total 4.67
- **Forces addressed:** Eli P2 returnable context (3), P1 confident deposit (2).
- **Design implication:** Eli's return surface. The list is updated in the same request that creates the ticket; visible before the user navigates away from confirmation. The surface that converts "submission" into "long-term confidence."

### 7. Submission confirmation screen (ticket number, status, link) — Total 3.60
- **Forces addressed:** Eli P1 confident deposit (3); Sam P3 my work is traceable (1).
- **Design implication:** This is the 5-second problem. One screen, three signals: confirmation message, ticket number, link to the ticket (and immediate appearance in My-Tickets). The highest-weight single force addressed here is Eli's P1 (confident deposit, FIA 14).

### 8. Reopen action on Resolved tickets (with history preserved) — Total 3.53
- **Forces addressed:** Eli P4 closure that's real (2), N3 Slack/DM fallback (1); Sam N4 closing-but-not-fixed (2).
- **Design implication:** Visible only on Resolved tickets (not Closed). Single click. Status returns to Open; full history preserved. The product's quality mechanism for Goal 1 (reopen rate <15%).

### 9. Ticket submission form (title, description, priority, category) — Total 2.67
- **Forces addressed:** Eli P1 confident deposit (2); Sam P3 my work is traceable (1).
- **Design implication:** Fewest fields possible. Title (required), description (required), priority (default Medium), category (optional). Submission is the *entry point* — friction here directly costs adoption. Note: category was scoped optional per the brief.

---

## Medium Priority

Address if feasible. Enhances the experience without blocking core value.

### 10. Admin Users tab
- **Forces addressed:** Sam N2 dumping ground (1).
- **Design implication:** Activate/deactivate users and assign roles (User, Support Agent, Admin). Same dashboard, additional tab. Optional in MVP per the brief's deferral (user management is a soft requirement, not a hard wall).

---

## Deprioritized

Low impact on current driving forces. Consider in future iterations.

- **Email/Slack ingestion of incoming requests** — would lower Eli's friction further, but budget/capacity is constrained by the brief's "no enterprise features in MVP" gating principle. Flag as a post-MVP investigation if Goal 2 adoption lags at the 90-day check.
- **Attachments / file uploads on tickets** — initially deprioritized in MVP (Eli's friction framed as *trust*, not *feature gap*). **Decision updated 2026-09-14:** attachment field included on Create Ticket form to address the screenshot-fallback path that pushes Eli to Slack instead. Now part of the MVP; see Create Ticket form spec.
- **SLA / time-to-response timers** — would support Sam's queue-hygiene monitoring, but Goal 1 already measures resolution latency; adding timers would duplicate with no additional force addressed. Out for MVP.
- **Custom workflows / per-category routing** — explicitly forbidden by the brief's no-enterprise-features constraint. Out.
- **Reporting / dashboards for managers** — would serve a persona we don't have (no manager archetype). Out.
- **SSO / advanced identity integration** — explicitly deferred to first-team validation per the brief's constraints section. Out for MVP, review at first deployment.

---

## Gap Analysis

High-scored forces with no strong product response. Flag for Freya (UX Scenarios phase).

| Force | Persona | FIA Score | Gap |
|-------|---------|-----------|-----|
| P2 Nothing falls through | Sam | 14 | The tool provides visibility and ownership, but cannot *guarantee* a request gets seen. The gap is between tool-supported trust and human-attentiveness — outside the product's reach. Addressable only via Sam's workflow discipline + the audit trail making misses reconstructible. |
| N1 Silent ticket | Eli | 12 | The product surfaces owner and status but cannot force Sam to act. If Sam is overloaded or distracted, Eli's ticket can still go silent. Mitigation outside the product: workload balancing in Sam's hands. Addressable inside the product only via notifications, which is a post-MVP feature. |
| N3 Slack/DM fallback | Eli | 11 | Best prevented by ensuring status/owner/check-back eliminate the *trigger*. Cannot be prevented at 100%. Mitigation: visible movement signals (any status change → Eli sees update). |
| N3 Ownership ambiguity | Sam | 13 | Largely addressed by owner field (feature #4) but two-agent handoff still creates transient ambiguity. Mitigation: one-action reassignment that updates the history. |

The gap analysis points to one **post-MVP** consideration that *would* close the largest remaining gap: **passive notifications / "something changed" surface for Eli** — not Slack-style noise, but a quiet indicator that the ticket has moved since Eli's last check. Flag for the next phase if adoption (Goal 2) is below 80% at the 90-day check.

---

_Produced by Saga — 2026-09-14_
_Derived autonomously from: 02-persona-sam-the-support-agent.md, 03-persona-eli-the-end-user.md_
_Review: share with client before handoff to Freya_
