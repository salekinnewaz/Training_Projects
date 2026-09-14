# Business Goals — HelpDesk Lite

> Phase 2 — Trigger Mapping · Workshop 1
> Source: `design-process/A-Product-Brief/product-brief.md`, Workshop 1 (2026-09-14)
> Status: Draft — pending review

---

## Vision

The company is known for handling internal support requests in a clear, reliable, and accountable way — organized without process overhead.

Every request lands in a place the team can trust, every agent knows what they're responsible for, and nothing leaves a trail-less gap.

---

## Strategic Goals

### Goal 1 — The queue runs itself

Requests flow visibly from Open through Resolved/Closed, aging gracefully, without dropping, piling up in anyone's head, or escaping to Slack.

| # | Objective | Target |
|---|-----------|--------|
| 1.1 | **Resolution latency.** Median time from ticket creation to Resolved. | < 2 business days, measured at 6 months post-launch. |
| 1.2 | **Resolution quality.** Reopen rate of Resolved tickets within 14 days. | < 15%, measured at 6 months post-launch. |
| 1.3 | **Queue hygiene.** Share of Open tickets older than 14 days with no owner or status update. | < 10%, surfaced via system-generated report (no manual audit cadence assumed). |

---

### Goal 2 — One obvious front door

Every Employee knows exactly where to file a request. No request lives only in someone's memory, and Slack/email/DM is no longer the default.

| # | Objective | Target |
|---|-----------|--------|
| 2.1 | **Adoption reach.** Internal support requests flowing through HelpDesk Lite. | ≥ 80% within 90 days of launch. |
| 2.2 | **Front-door satisfaction.** Employees reporting they can easily file and track a request. | ≥ 85% on internal survey at 90 days. |
| 2.3 | **Channel collapse.** Share of internal support requests still being handled exclusively through Slack/email/DM. | < 20% within 90 days of launch. _(Measurement method TBD — to be defined once the data collection approach is established.)_ |

---

### Goal 3 — Every ticket has an owner who can be held to it

Ownership is visible at-a-glance. Reassignment is trivial and traceable. Resolution is attributable to a person, not to a channel.

| # | Objective | Target |
|---|-----------|--------|
| 3.1 | **Ownership visibility.** Open tickets with an assigned owner displayed on the ticket. | ≥ 95%, surfaced via system-generated report (no manual audit cadence assumed). |
| 3.2 | **Ownership handover integrity.** Every agent reassignment produces a timestamped history entry. | 100% of reassignment events reflect reassigned-by and timestamp in ticket history. |
| 3.3 | **Requester-side clarity.** Employees reporting they can identify the owner of an open ticket without asking anyone. | ≥ 80% on internal survey at 90 days. |

---

### Measurement-window summary

| Objective | Measurement window |
|-----------|--------------------|
| 1.1, 1.2, 1.3 | 6 months post-launch |
| 2.1, 2.2, 2.3 | 90 days post-launch |
| 3.1, 3.2, 3.3 | 90 days post-launch (3.3 survey) / continuous (3.1, 3.2 system-generated) |

### Notes on measurement

- All objectives use **system-generated metrics** derived from HelpDesk Lite's own ticket data. No manual audit cadence has been defined by the team, so reporting cadence is left to be determined along with operational process.
- Objective 2.3 (channel collapse) requires observing Slack/email/DM traffic directly. **Measurement method is TBD** until the data-collection approach is established. Until then, 2.3 is informational; the operational signal comes from 2.1 and 2.2.

---

_Produced by Saga — 2026-09-14_
_Source: `product-brief.md`, Workshop 1_
