# Sam the Support Agent — Persona 02

> Priority: Primary
> Business goals served: G1 (queue runs itself), G3 (every ticket has an owner)

---

## Who Sam Is

Sam is the person responsible for managing the ticket queue in a small team of 5–20. Sam takes ownership of incoming requests, responds to employees, and moves tickets through their lifecycle toward resolution. "Support Agent" is a role defined by permissions — Sam may hold it full-time or as part of a wider job — but the responsibility is the same either way: the queue is Sam's to keep honest.

Sam mainly supports colleagues within the same company, so they are internal teammates rather than external customers. Because Sam often knows the people they support, a high-priority label should be treated as a signal of urgency that helps Sam prioritize work, not as a personal request from a specific colleague.

## Psychological Profile

Sam takes pride in keeping the support queue organized and making sure employees get clear, timely responses. **The primary reward is not volume closed — it is the state of the queue itself.** Sam feels successful when every ticket has an owner, the queue is under control, and requests move through the lifecycle without getting lost or forgotten.

Sam especially values being able to look at the Kanban board and quickly understand what needs attention and what is already being handled. That at-a-glance clarity is what Sam considers a good day. Without it, the day becomes reactive — chasing status, re-deriving context, hunting for follow-ups — and Sam's sense of being effective collapses.

Sam's mental model is *less like a dispatcher moving tickets, more like a steward of a shared resource.* The product either preserves that mental model or quietly undermines it, depending on whether it makes the queue state legible.

## Internal State

Before HelpDesk Lite, Sam carries **invisible mental load** — the burden of knowing the queue exists across Slack threads, email chains, and direct messages, even when Sam isn't actively looking at any of them. That load produces a background anxiety: *did I miss something? is there a request sitting in someone's DM that no one else knows about?*

**Dominant emotions:** quiet vigilance, satisfaction when the queue is clean, a dull dread when something turns out to have been missed. Sam does not usually articulate this anxiety; they just feel the cost in focus and energy across the day.

The product's job here is to be the *relief mechanism* for this load — make the queue state, ownership, status, and history visible in one place, so Sam's vigilance can rest on something it can actually see.

## Usage Context

**How Sam finds the product:** Sam uses HelpDesk Lite as their primary working surface during the work day — opening it as the first action and returning to it frequently. There is no "discovery" event; Sam was given the Agent role when the tool was introduced and the dashboard is now where work happens.

**Emotional state on arrival:** alert, scanning. The first scan of the day is a triage ritual — looking for orphans, claims, and slips. Sam is calm when nothing has aged; mildly tense when something has. The dashboard has to answer Sam's morning questions in seconds or it has failed.

**Behavior pattern:** Sam moves fast across the board — column to column, ticket to ticket. Sam opens a ticket to read description and comments, updates status or priority when needed, writes a comment for the requester, and moves on. Sam rarely lingers on a single ticket; the work is *queue-scale*, not *ticket-scale*.

**Decision criteria:**
- *What's open and unowned?* — first thing Sam looks for.
- *Who owns what?* — second pass.
- *What status is each ticket in?* — used to decide what's actionable now and what's waiting.

Sam's frustration peaks when those three signals are unclear, when ownership sits in shadow, or when something needs attention but the queue doesn't surface it.

## Driving Forces

Format: WHAT + WHY + WHEN
Score: Frequency (1–5) + Intensity (1–5) + Fit (1–5) = Total /15

### Positive Forces

| # | Force | WHAT | WHY | WHEN | F | I | Fit | Total |
|---|-------|------|-----|------|---|---|-------|-------|
| + | **The queue looks right** | Open the dashboard and at-a-glance see what's open, what's owned, what's stale. | Confirms control before starting the day; removes mental load. | Every workday, first scan. | 5 | 5 | 5 | **15** |
| + | **Nothing falls through** | Every request lands in the queue, gets seen, gets resolved or escalated. | Relief from the dread of "did I miss something?"; the primary emotional reward. | Ongoing; resolves when each ticket closes. | 4 | 5 | 5 | **14** |
| + | **My work is traceable** | When Sam resolves a ticket, history shows who said what, when status changed, who owned it. | Defends Sam's work in retros and handoffs. | When context is needed later (handoff, dispute, review). | 3 | 4 | 5 | **12** |

### Negative Forces

| # | Force | WHAT | WHY | WHEN | F | I | Fit | Total |
|---|-------|------|-----|------|---|---|-------|-------|
| − | **A request falls through with no record** | Someone needed help, Sam didn't see it, no audit trail to reconstruct what happened. | The dread the product is supposed to eliminate; persistent background anxiety. | When discovered; recurrent every shift. | 3 | 5 | 5 | **13** |
| − | **The queue becomes a dumping ground** | Tickets pile up because everyone assumes "the support agent will handle it"; Sam becomes the catch-all. | Workload distortion, scope creep, loss of focus on real support work. | When load spikes and out-of-scope requests arrive. | 3 | 4 | 3 | **10** |
| − | **Ownership ambiguity** | Two agents both think the other is handling it, or no one picks it up because it doesn't look urgent. | The orphan problem; the queue either has visible owners or it doesn't. | On every shift, when volume is real. | 4 | 4 | 5 | **13** |
| − | **Resolving something that wasn't actually fixed** | Ticket is marked Resolved because the agent thinks it's done, but the requester reopens it. | Damages trust in Sam's work; hits the reopen-rate metric directly. | When a closure turns out to have been premature. | 2 | 4 | 4 | **10** |

## Relationship to Business Goals

- ✅ **G1 — The queue runs itself.** Sam *is* the person who makes the queue run. Their day starts on the dashboard; their work is the flow. Nothing about the queue runs without Sam, so the product's job for Sam is to make that flow legible and low-friction — otherwise Sam becomes the bottleneck instead of the operator. Reopen-loop mechanics (Resolved → reopen → Open while keeping history) directly serve G1 by giving Sam a clean way to handle the "I thought it was done, it wasn't" case without losing context.

- ✅ **G3 — Every ticket has an owner who can be held to it.** Sam is the primary carrier of ownership. The product serves G3 for Sam by surfacing orphans instantly, making reassignment a one-action event that produces a history entry, and never letting a ticket sit without an owner shown on the card.

---

_Produced by Saga — 2026-09-14_
_Source: Workshop 2, product-brief.md_
