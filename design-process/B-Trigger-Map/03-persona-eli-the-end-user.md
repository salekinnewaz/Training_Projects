# Eli the End-User — Persona 03

> Priority: Secondary
> Business goals served: G1 (queue runs itself), G2 (one obvious front door), G3 (every ticket has an owner)

---

## Who Eli Is

Eli is an employee at a small company of 5–20 people who needs help from the support team and uses HelpDesk Lite to ask for it. Eli files a request when blocked, expects to come back to it days later without losing context, and uses ticket status as the *substitute for memory*. Before HelpDesk Lite, Eli would typically ask for help through Slack, email, or a direct message to a teammate. The main problem with that workflow was that requests became difficult to track later, especially when Eli needed to follow up after several days.

HelpDesk Lite is Eli's primary interface to the support team. Eli doesn't triage, doesn't manage the queue, doesn't reassign — Eli *files, checks, and resolves*.

## Psychological Profile

Eli is **someone who can ask clearly and follow through** without having to chase people for updates. That quiet self-image matters: the product should let Eli look organized, not like someone who has to ping three people to find out what's happening with a request.

When Eli is blocked, the cost is **lost time and frustration**. Eli wants a clear way to request help without repeatedly chasing someone for an update. Eli cares most about getting a useful resolution and being able to see progress without having to ask repeatedly. Eli values a clear status, visible ownership, timely responses, and keeping the context of the original request so they don't have to explain the problem again.

Eli does not think of support work as "their job" — Eli has their own job, and getting unblocked is what matters. Anything the product asks of Eli beyond *file, check, resolve* is friction.

## Internal State

When Eli submits a request, the first few seconds decide whether Eli trusts the tool. **Dominant emotions:** brief uncertainty ("did it go through?") that resolves into confidence, or stays as doubt. After submission, Eli's state becomes one of **patient waiting with a watchful eye** — Eli returns to the ticket to check status, reads comments, and watches for traction.

If a ticket sits unowned and silent for several days, Eli will usually follow up through Slack or a direct message to ask whether the request was seen. If the issue is urgent, Eli may also look for a workaround rather than continue waiting. **The critical failure mode:** Eli loses confidence that the ticket is being handled and falls back to the old communication channels. That fallback is the inverse of the adoption objective — every Slack DM about an existing ticket is a sign the product has failed Eli.

When Eli comes back to a Resolved ticket and the issue is not actually fixed, the emotion is *frustration compounded by wasted time*. Eli should be able to reopen the ticket rather than start over. That's the contract HelpDesk Lite makes with Eli.

## Usage Context

**How Eli finds the product:** Eli opens HelpDesk Lite from a known place (bookmark, team link, app launcher) when they realize they're blocked. There is no "exploration" event — Eli arrives already knowing they need help.

**Emotional state on arrival:** blocked, mildly frustrated, sometimes time-pressured. Eli wants to get the request down and get back to work. The fewer steps between "I need help" and "I've asked for help," the better.

**Behavior pattern:** Eli moves quickly. Eli opens the create-ticket screen, writes a title and description, picks a priority, submits, looks at the confirmation, and returns to their work. Later — minutes, hours, or days — Eli comes back, opens the ticket list, finds the ticket, reads the comments, sees status and owner. If Eli needs to push back on a Resolved that wasn't actually fixed, Eli clicks reopen. The whole arc is short, intermittent, and ticket-scale (not queue-scale).

**Decision criteria:**
- *Was the request clearly received?* — Eli decides in the first 5 seconds.
- *Can I find this request later?* — Eli decides based on whether the ticket appears in their list immediately.
- *Is anything happening with it?* — Eli decides each time they check back, based on status, owner, and comments.
- *Is this actually fixed?* — Eli decides at the Resolved → Closed transition.

## Driving Forces

Format: WHAT + WHY + WHEN
Score: Frequency (1–5) + Intensity (1–5) + Fit (1–5) = Total /15

### Positive Forces

| # | Force | WHAT | WHY | WHEN | F | I | Fit | Total |
|---|-------|------|-----|------|---|---|-------|-------|
| + | **Confident deposit** | When Eli hits Submit, something visible tells them the request landed: a confirmation, a unique ticket number, the ticket appearing in their list. | Removes the "did it actually go through?" doubt. | In the first 5 seconds after submitting. | 5 | 4 | 5 | **14** |
| + | **Returnable context** | Eli can come back hours or days later, find the ticket, read the description and the comments, and pick up where they left off without re-explaining. | Replaces memory with the record. | When Eli checks status or picks up the thread. | 4 | 5 | 5 | **14** |
| + | **Visible traction** | Eli can see status, owner, and any progress without asking anyone. | Kills the "is anyone on this?" anxiety. | Every time Eli checks back. | 4 | 4 | 5 | **13** |
| + | **Closure that's real** | When Eli is told something is fixed, it's actually fixed and Eli isn't surprised a week later. | Confidence in the loop; the Resolved → Close / Reopen contract works as written. | When Eli moves from Resolved to Closed. | 3 | 4 | 4 | **11** |

### Negative Forces

| # | Force | WHAT | WHY | WHEN | F | I | Fit | Total |
|---|-------|------|-----|------|---|---|-------|-------|
| − | **Silent ticket** | Eli submits, and nothing happens — no confirmation, no owner, no update. | The silent-failure dread; persistent until resolved. | Persistent background anxiety while waiting. | 3 | 5 | 4 | **12** |
| − | **Explaining the problem twice** | Eli has to retell the issue because the ticket lost context, or to a new person who didn't see the original. | Experience of being treated as a fresh requester. | When handoffs happen or tickets are stale. | 2 | 4 | 5 | **11** |
| − | **Falling back to Slack/DM to chase** | Eli goes around the system because the ticket isn't moving and they need confidence. | The adoption-killer failure; the inverse of the front-door goal. | When waiting exceeds tolerance. | 3 | 4 | 4 | **11** |

## Relationship to Business Goals

- ✅ **G1 — The queue runs itself.** A queue that runs itself means Eli doesn't have to chase. The silent-ticket → Slack-fallback chain breaks G1 from Eli's side, because every DM is a sign the queue leaked. Resolved → reopen loop preserves G1's quality dimension: real closure, not paper closure.

- ✅ **G2 — One obvious front door.** Eli *is* the front door. The product serves G2 for Eli by making submission fast and the receipt unambiguous — confident deposit in 5 seconds — and by making return visits trivial — returnable context and visible traction. Every interaction that doesn't go through the tool weakens G2.

- ✅ **G3 — Every ticket has an owner.** Eli needs to see ownership without asking. The product serves G3 for Eli by surfacing owner on every ticket card and update, which is exactly what kills the silent-ticket dread and prevents the Slack fallback.

---

_Produced by Saga — 2026-09-14_
_Source: Workshop 3, product-brief.md_
