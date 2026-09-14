# Submission Confirmation

**Route:** `/tickets/:id/created` (reached immediately after Create Ticket submit; e.g., `/tickets/HD-47/created`)
**Scenario:** Eli the End-User only (priority 03). Sam does not pass through here — Agents don't create tickets in MVP.
**Purpose:** Convert "submission" into a returnable artifact. In under five seconds Eli must understand (1) her request was received, (2) it has a unique identifier she can come back to, and (3) she has a clear next move. The page is a single, calm success moment — no marketing, no onboarding, no upsell.

## User Context

Eli just clicked Submit on Create Ticket. Her cognitive state: small relief + small uncertainty ("did it really go through?"). She wants confirmation that doesn't make her re-read to be sure. She is still inside the support flow — the next two clicks she takes will either go deeper (View ticket → Ticket Detail) or back to the list (Back to My Tickets). There is no third path from here.

This is the **5-second trust moment**. The product brief calls out adoption (G2) as the make-or-break metric for the first 90 days; if Eli doesn't feel "I asked for help, it's recorded, I can come back to it," she will revert to Slack DM — the silent-ticket failure mode that breaks G2. The page has exactly one job: prove the artifact exists and is hers.

## Design Decisions (locked during discussion)

- **Dominant visual:** large green check circle at top-center, then "Ticket created" headline, then the ticket number `#HD-47` prominently displayed, then the initial status "Open" as a chip. Three signals stacked, each addressing one part of Eli's question: was it received (✓), what's it called (number), where does it sit (status).
- **Primary CTA:** "View ticket" — full-width-ish button, primary `#212529`, takes Eli to Ticket Detail (`/tickets/:id`).
- **Secondary action:** "← Back to My Tickets" — muted text link, returns to Employee Dashboard (`/dashboard`) where the new ticket is now visible at the top of the list.
- **No other content.** No celebration confetti, no "What happens next" timeline, no email confirmation copy, no "Tell us how we did" prompt, no signup-prompt for additional features, no share-with-team. The page is finished the moment the three signals are visible.

## Content & Actions

The page has exactly six elements:

1. **App-header chrome strip** — same strip as on Ticket Detail / Dashboards: brand mark on left, My Profile / Logout on right. Shared across all post-login screens. (Spec reuses the chrome introduced on Ticket Detail.)
2. **Success check** — 64×64 green circle (`#d3f9d8` fill, `#2b8a3e` 2.5px stroke check) centered horizontally near the top of the content area. Not animated (per MVP "no ceremony"); the static glyph is the signal.
3. **Headline** — `Ticket created` — 28px semibold, `#212529`, centered, single line.
4. **Ticket number** — `#HD-47` — 32px monospace (`ui-monospace, SFMono-Regular, Menlo, monospace`), `#212529`, centered. The number is the artifact ID — copy-to-clipboard on click, toast confirms. (Implementation detail.)
5. **Status chip** — `Open` pill, same color tokens as Ticket Detail (`#fff5d6` bg, `#7a5c00` text, 22px tall pill, 12px semibold label). Centered, sits below the ticket number with a small label "Initial status" above it in 12px muted `#868e96` to make the chip's meaning unambiguous.
6. **Primary CTA** — `View ticket` — `#212529` fill, white 16px semibold label, 48px tall, 6px radius, full content-column width (880px). Sits below the status chip with comfortable spacing.
7. **Secondary action** — `← Back to My Tickets` — 14px `#868e96` text link, centered below the CTA.

**No other content.** No "What happens next" panel. No timeline. No "we've emailed you" copy (no email notification in MVP — Eli finds new responses by returning to her dashboard). No share-with-team affordance.

## Behavior

- **Page lifecycle:** Reached only via the Create Ticket submit flow. The route itself is not bookmarkable in a meaningful sense — it's a one-shot destination immediately after creation. Bookmarking it and returning later would either show the same confirmation again (confusing, since the ticket already exists) or redirect to Ticket Detail (the better behavior). **Implementation note:** if `/tickets/:id/created` is hit directly (e.g., back-button after refresh), redirect to `/tickets/:id`.
- **Auto-focus:** none. The page has no input fields.
- **Click on `View ticket`** → navigate to `/tickets/:id` (Ticket Detail, Employee view, status=Open).
- **Click on `← Back to My Tickets`** → navigate to `/dashboard` (Employee Dashboard). The new ticket is at the top of the list (per Dashboard spec).
- **Click on the ticket number `#HD-47`** → copy the number to clipboard. Toast confirms: "Copied." (Implementation detail; placeholder for now.)
- **Keyboard:** Enter on either action triggers its corresponding navigation. (Buttons are natively keyboard-focusable.)
- **Refresh:** page re-renders identically — the page is purely presentational, no in-flight API state. Safe to refresh.
- **Back-button after arriving:** browser back from Submission Confirmation goes back to Create Ticket with the form fields preserved (so Eli can correct-and-resubmit if she realizes something was wrong). If she actually wants to abandon creation, the back link from Create Ticket (to be specified) leads her away.

## States

| State | Trigger | Display |
|---|---|---|
| **Default** | Page loaded after Submit | All six elements rendered as specified. |
| **Direct-arrival** | User hits `/tickets/:id/created` directly (e.g., refresh, deep link) | Same render — but see Lifecycle: this should redirect to `/tickets/:id` in implementation. Spec documents the redirect; default frame is what users see 99% of the time. |
| **Ticket-not-found** | Server returns 404 (e.g., very rare race if ticket creation rolled back) | Single centered card: "Ticket not found." + "Back to Dashboard" button. No success signal. |
| **Session expired** | User submits Create Ticket while session was about to expire, gets redirected through auth, and lands here after re-auth | The post-re-auth redirect should NOT land on `/created` (stale) — should land on `/tickets/:id` directly. Edge case for implementation; spec requires the redirect chain to honor this. |

## Visual Tokens

Inherited from Login + Ticket Detail. No new tokens introduced on this page (the success-check uses status-badge green, already in the token table).

| Token | Value | Where used |
|---|---|---|
| Page background | `#f8f9fa` | Page surface |
| Surface | `#ffffff` | App-header strip |
| Primary (button bg) | `#212529` | "View ticket" CTA |
| Success fill | `#d3f9d8` | Success-check circle background |
| Success stroke | `#2b8a3e` 2.5px | Check glyph stroke |
| Headline / strong text | `#212529` | "Ticket created" |
| Muted text | `#868e96` | "← Back to My Tickets", "Initial status" micro-label |
| Status chip (Open) | `#fff5d6` bg, `#7a5c00` text | "Open" pill below ticket number |
| Ticket number text | `#212529` | `#HD-47` (monospace) |
| Type stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All text except ticket number |
| Monospace stack | `ui-monospace, SFMono-Regular, Menlo, monospace` | Ticket number only |

| Spacing & geometry | Value | Notes |
|---|---|---|
| Page width | 1440 | Design canvas |
| Content column width | 880px | Centered at x=720 (matches Ticket Detail / future dashboard) |
| App-header strip | 64px tall | Same as Ticket Detail; brand mark + My Profile + Logout |
| Page top margin | 64px | Below app-header strip; generous, sets the calm tone |
| Success check diameter | 64px | Centered horizontally |
| Headline baseline | ~y=380 | Below check with ~40px gap |
| Ticket number size | 32px | Centered, ~32px gap below headline |
| Initial status micro-label | 12px, ~12px gap above chip | Above the Open pill |
| Open chip | 22px tall pill, 12px semibold | Below the micro-label |
| Primary CTA | 880×48, 6px radius | 64px gap above; full content-column width |
| Secondary link | 14px, ~24px gap above | Below CTA, centered |

### Wireframe-anchored layout coordinates (y-positions on a 900px canvas)

- App-header chrome strip: y=0..64.
- Success-check circle: cx=720, cy=240, r=32 (so y=208..272). Check glyph is a polyline inside.
- "Ticket created" headline baseline: y=320, font-size 28px, centered.
- Ticket number `#HD-47` baseline: y=380, font-size 32px, monospace, centered.
- "Initial status" micro-label: y=410, font-size 12px, centered, `#868e96`.
- Open status chip: y=420..442, centered.
- "View ticket" primary button: x=280..1160, y=512..560 (880×48, 6px radius).
- "← Back to My Tickets" link: y=600, font-size 14px, centered.

## Success

In under five seconds Eli has answered three questions:

1. **Did it go through?** — Yes (green check).
2. **What's it called?** — `#HD-47` (large monospace, prominent).
3. **Where does it sit now?** — "Open" status chip below the number.

She has a single deliberate next move (View ticket), and a fallback move (Back to My Tickets) for when she wants to return to scanning her queue instead of diving into the new ticket. Both moves are unambiguous. The artifact is named, owned, and findable — the trust handshake is complete.

The success criterion that matters most: when Eli lands on this page, the Slack-DM fallback temptation goes away. She now has a returnable surface. Adoption (G2, 90-day window) is built one such moment at a time.

---

## Design System Reference

See `design-process/E-Design-System/01-design-tokens.md` for the consolidated token reference (colors, typography, spacing, shadows, radii, borders, focus ring). All token values documented in this spec's Visual Tokens section are part of the unified design system used across every page in the app.

## Open Questions

None. The page is constrained and small; the design decisions were resolved during discussion.

Implementation-level follow-ups (not blocking this spec):
- **No animated checkmark in MVP** — the static glyph is sufficient; animation can be added in v1.x if feedback calls for it.
- **Clipboard toast position** — implementation detail, recommended bottom-center 24px from viewport bottom.
- **Email notification** — not in MVP. If added later, it would NOT change this page (no "we've emailed you" copy); it would only change the activity log entry on Ticket Detail ("Email sent" event).

---

_Produced by Freya — 2026-09-14_
_Source: 01-eli-files-and-tracks-ticket.md (Screen 4), design-process/D-UX-Design/login.md (visual tokens), design-process/D-UX-Design/ticket-detail.md (status badge tokens, app-header chrome)_
_Wireframe approved 2026-09-14; tokens + layout coordinates already in spec; no further sync needed._
