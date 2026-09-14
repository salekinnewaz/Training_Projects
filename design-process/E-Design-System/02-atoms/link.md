# Link

**Category:** Atom
**Phase 4 source:** Submission Confirmation ("← Back to My Tickets"), Create Ticket ("‹ Back to My Tickets"), Ticket Detail, Users tab, Agent Kanban (Unassigned badge)

---

## Overview

An inline text link for navigation or action. Always paired with a caret or arrow indicator (←, →, ‹) for affordance. Links are not buttons — they navigate, they don't submit or commit.

## Variants

### Back link

- **Text:** `color-muted` (`#868e96`), `font-size-body` (14px), `font-weight-regular`
- **Leading glyph:** ← or ‹
- **Hover:** text darkens to `color-label` (`#495057`)
- **Examples:**
  - "← Back to My Tickets" (Submission Confirmation, Create Ticket)
  - "‹ Back to Dashboard" (Employee Dashboard)

### Forward / action link

- **Text:** `color-label` (`#495057`), `font-size-body` (14px), `font-weight-medium`
- **Trailing glyph:** →
- **Hover:** text darkens to `color-primary` (`#212529`)
- **Examples:**
  - "View all in Queue →" (deferred — see Admin Dashboard §Card footer)

### Unassigned badge link (Agent Kanban)

A specialization: the Unassigned badge is rendered as a link (because clicking it could deep-link to a filtered view — out of MVP), but visually reads as a badge. See [badge-status](badge-status.md) for the styling.

## States

| State | Display |
|---|---|
| Default | `color-muted` or `color-label` text |
| Hover | darkens by one step (muted → label, label → primary) |
| Active (pressed) | same as hover (no visual change beyond color) |
| Visited | same as default (no special visited styling in MVP) |
| Focus (keyboard) | `focus-ring` (2px `#4263eb`) on the link |
| Disabled | `color-disabled-text`, cursor `default`, no hover |

## Tokens Used

- `color-muted`, `color-label`, `color-primary`, `color-disabled-text`
- `font-size-body`, `font-weight-regular` or `font-weight-medium`
- `focus-ring`

## Used In

- **Submission Confirmation** (`submission-confirmation.md`): "← Back to My Tickets" link, centered below the primary CTA.
- **Create Ticket** (`create-ticket.md`): "‹ Back to My Tickets" link, top-left of page content (in the heading row).
- **Employee Dashboard** (`employee-dashboard.md`): "‹ Back to Dashboard" link, top-left of page content.
- **Agent Kanban** (`agent-kanban.md`): "Unassigned" badge (technically a link-style badge — same color family as status pills).
- **Users tab** (`users-tab.md`): "Active" / "Inactive" toggle text (technically a button, but visually link-like).
- **Header / My Profile / Logout** (`header-profile-logout.md`): "Logout" action inside the dropdown panel (technically a button-styled link, but visually a primary action).

## Usage Guidelines

**When to use:**
- Navigation between pages.
- Optional actions that don't commit state.
- "Back" affordance.

**When NOT to use:**
- For actions that commit state (use [button](button.md)).
- For destructive actions (use [button](button.md) primary or secondary).
- Inside form fields (use [label](label.md)).

## Accessibility

- **Keyboard:** native `<a href="...">` is keyboard accessible.
- **Focus visible:** `focus-ring` (2px `#4263eb`) on keyboard focus.
- **Visited state:** out of MVP; spec defers to implementation choice.
- **Underline:** spec uses color-only differentiation (no underline) — relies on context (leading arrow glyph) and hover behavior for affordance. If accessibility audit shows this is insufficient, add underline on hover.
- **Color contrast:** `color-label` (`#495057`) on white = 8.6:1 (AAA). `color-muted` (`#868e96`) on white = 4.6:1 (passes AA for normal text, but hover darkens to `color-label` for clarity).
