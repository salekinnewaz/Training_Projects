# Dialog / Modal

**Category:** Molecule
**Composed of:** typography tokens + [button](../02-atoms/button.md) (primary + secondary) + scrim overlay
**Phase 4 source:** Logout confirmation dialog (Header / My Profile / Logout), Admin demotion / deactivation dialogs (Users tab)

---

## Overview

A centered modal dialog with a scrim overlay, used for confirmation moments that require a deliberate decision before continuing. The dialog always presents a Cancel option (secondary) and a Confirm option (primary), with a headline that states the consequence of confirming.

The dialog is used in four places across two surfaces:
1. **Logout** — "Log out of HelpDesk Lite?" (Header dropdown)
2. **Admin demotion** — "Demote <name> from Admin to <new role>?" (Users tab)
3. **Admin deactivation** — "Deactivate <name>?" (Users tab)
4. **Reopen / Confirm (close)** — Ticket Detail dialogs (cross-page pattern; see [confirmation-dialog](../05-patterns/confirmation-dialog.md))

All four use the same dialog shape — primary purpose of the molecule is to enforce a consistent confirmation interaction.

## Variants

### Standard confirmation dialog

- **Width:** 360px (Logout dialog) / 480px (Admin demotion / deactivation). Spec allows 360–480px range; the exact width depends on copy length.
- **Padding:** 24px on all sides.
- **Background:** `#ffffff`.
- **Border:** none (the dialog stands out via the scrim, not a border).
- **Radius:** 6px (matches dropdown panel).
- **Shadow:** `0 4px 12px rgba(33, 37, 41, 0.12)` (same as dropdown — consistent lift effect).

### Dialog content (top-down)

- **Headline:** 16px semibold `#212529`. States the consequence of confirming. Examples:
  - "Log out of HelpDesk Lite?"
  - "Demote Sam Patel from Admin to Support Agent? They will lose admin access immediately."
  - "Deactivate Sam Patel? They will be logged out and unable to log in."
- **Body:** optional supporting copy. None in MVP for Logout / Admin demotion / Admin deactivation — the headline carries the message. Reserved for dialogs that need explanation.
- **Actions (right-aligned in the dialog footer):**
  - **Cancel** (secondary): `#ffffff` fill, `#dee2e6` 1px border, `#495057` text. Closes the dialog without action.
  - **Confirm** (primary): `#212529` fill, `#ffffff` text. Applies the action.
  - Spacing: 8px gap between the two buttons.

### Modal scrim

- Full-viewport overlay: `rgba(33, 37, 41, 0.4)`.
- The page underneath is dimmed; only the dialog is interactive.
- Click on the scrim outside the dialog: closes the dialog (treats as Cancel). Some dialogs (e.g., Logout error) keep the dialog open on scrim click — see Usage Guidelines.

## States

| State | Display |
|---|---|
| Default (open) | Scrim + dialog; Cancel + Confirm buttons rendered |
| Hover (Cancel) | Border `#adb5bd`; subtle |
| Hover (Confirm) | Slightly darker fill `#000000` or `#343a40` (optional) |
| Focus (keyboard) | Outline ring `#4263eb` 2px on the focused button |
| Submitting (action in flight) | Both buttons disabled; spinner inside Confirm button; dialog remains open |
| Error (server error) | Inline error above the action row: "Couldn't <action>. Try again." Dialog stays open |
| Closed (success) | Dialog removed; action applied (logout, role changed, etc.) |
| Closed (cancel) | Dialog removed; no action applied |

## Tokens Used

- `color-surface` (`#ffffff`) for dialog background
- `color-primary` (`#212529`) for Confirm button fill, headline text
- `color-on-primary` (`#ffffff`) for Confirm button text
- `color-border-default` (`#dee2e6` 1px) for Cancel button border
- `color-body` (`#495057`) for Cancel button text
- `color-error` (`#c92a2a`) for inline error message
- `color-focus-ring` (`#4263eb` 2px) for keyboard focus outline
- `color-modal-scrim` (`rgba(33, 37, 41, 0.4)`) for scrim overlay
- `shadow-dropdown` (`0 4px 12px rgba(33, 37, 41, 0.12)`) for dialog lift
- `radius-dropdown` (6px)
- `font-size-body-lg` (16px), `font-weight-semibold` for headline
- `font-size-body` (14px) for button labels

## Used In

- **Header / My Profile / Logout** (`header-profile-logout.md`): Logout confirmation dialog.
- **Users tab** (`users-tab.md`): Admin demotion confirmation dialog, Admin deactivation confirmation dialog.
- **Ticket Detail** (`ticket-detail.md`): Reopen confirmation dialog, Confirm (close) confirmation dialog.

## Usage Guidelines

**When to use:**
- When the action is destructive, irreversible, or has significant consequences (logout, role demotion, ticket closure).
- When the user should explicitly confirm before the action proceeds.
- When the consequence isn't obvious from the trigger alone (e.g., "Demote from Admin to Support Agent" — the loss of admin access is a non-trivial side effect).

**When NOT to use:**
- For routine, reversible actions (e.g., changing a non-Admin user's role on Users tab — no dialog).
- For actions that can be undone via standard undo patterns (e.g., typing in a text field — no dialog).
- For pure informational prompts (use a toast or inline message instead).

**Focus management:**
- On open: focus moves to the Confirm button (the most-likely-next-click). For destructive actions where Confirm is dangerous to mis-click, focus defaults to Cancel instead — but in MVP all Confirm actions are explicit enough that Confirm-default is acceptable.
- On close: focus returns to the trigger that opened the dialog.

**Keyboard:**
- `Esc` cancels.
- `Enter` activates the focused button (Cancel or Confirm).
- `Tab` cycles between the two buttons (only two focusable elements in MVP).

**Scrim click:**
- Logout dialog: clicking the scrim closes the dialog (Cancel-equivalent).
- Admin demotion / deactivation: clicking the scrim also closes (Cancel-equivalent).
- Reopen / Confirm (close) on Ticket Detail: clicking the scrim also closes.
- Error states (Logout fails server-side): scrim click keeps the dialog open so the user can retry or explicitly Cancel.

**Why "no body copy"?**
- The headline carries the consequence. For MVP dialogs (Logout, Admin demotion, Admin deactivation), the headline is unambiguous: "Log out of HelpDesk Lite?" / "Demote X from Admin to Y? They will lose admin access immediately." No "Are you sure?" preamble — the headline IS the question.

## Accessibility

- **ARIA dialog pattern:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="<headline-id>"`. The dialog content (Cancel + Confirm buttons) is reachable via `Tab`.
- **Focus trap:** focus is trapped inside the dialog while it's open. `Tab` cycles between Cancel and Confirm. `Shift+Tab` cycles backwards.
- **Initial focus:** moves to the Confirm button by default (most-likely-next-click). For destructive-only dialogs (e.g., permanent deletion), focus moves to Cancel instead — not in MVP but reserved.
- **Screen reader announcement:** when the dialog opens, the screen reader announces the dialog's role and reads the headline. The user is immediately oriented.
- **Return focus:** when the dialog closes, focus returns to the trigger that opened it.
- **Color contrast:** headline `#212529` on `#ffffff` = 16.8:1 (AAA). Confirm button text `#ffffff` on `#212529` = 16.8:1 (AAA). Cancel button text `#495057` on `#ffffff` = 8.6:1 (AAA). Error message `#c92a2a` on `#ffffff` = 5.6:1 (AAA).
- **Scrim opacity:** `rgba(33, 37, 41, 0.4)` is sufficient to dim the page without making it fully inaccessible to screen readers (the underlying page is hidden from focus, but the page content remains in the DOM for screen-reader users who navigate via headings / landmarks).
