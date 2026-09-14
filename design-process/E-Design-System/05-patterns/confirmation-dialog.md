# Confirmation Dialog Pattern

**Category:** Pattern
**Phase 4 source:** Logout confirmation, Admin demotion / deactivation, Reopen / Confirm (close) on Ticket Detail

---

## Overview

A cross-page pattern for confirmation moments that require a deliberate decision before continuing. The pattern enforces:
- **Headline-only copy** — no "Are you sure?" preamble. The headline IS the question.
- **Two-button layout** — Cancel (secondary, left) + Confirm (primary, right).
- **Modal scrim** — page is dimmed; only the dialog is interactive.
- **Predictable keyboard** — `Esc` cancels; `Enter` activates focused button; `Tab` cycles between the two.
- **Same shape across instances** — the same dialog renders for all 4 use cases, so users learn the interaction once.

## When to use

- The action is destructive, irreversible, or has significant consequences (logout, role demotion, ticket closure).
- The user should explicitly confirm before the action proceeds.
- The consequence isn't obvious from the trigger alone (e.g., "Demote from Admin to Support Agent" — the loss of admin access is a non-trivial side effect).

## When NOT to use

- For routine, reversible actions (e.g., changing a non-Admin user's role on Users tab — no dialog).
- For actions that can be undone via standard undo patterns (e.g., typing in a text field — no dialog).
- For pure informational prompts (use a toast or inline message instead).

## Use cases in MVP

1. **Logout** (Header / My Profile / Logout) — "Log out of HelpDesk Lite?" + Cancel + Log out.
2. **Admin demotion** (Users tab) — "Demote <name> from Admin to <new role>? They will lose admin access immediately." + Cancel + Demote.
3. **Admin deactivation** (Users tab) — "Deactivate <name>? They will be logged out and unable to log in." + Cancel + Deactivate.
4. **Reopen** (Ticket Detail, Employee at Resolved) — "Reopen this ticket? Sam will be notified and the ticket will return to Open with full history preserved." + Cancel + Reopen.
5. **Confirm (close)** (Ticket Detail, Employee at Resolved) — "Confirm this issue is resolved? The ticket will close and cannot be reopened." + Cancel + Confirm.

## Anatomy

- **Width:** 360px (Logout) / 480px (Admin demotion / deactivation). Spec allows 360–480px range.
- **Padding:** 24px on all sides.
- **Background:** `#ffffff`.
- **Border:** none.
- **Radius:** 6px.
- **Shadow:** `0 4px 12px rgba(33, 37, 41, 0.12)`.
- **Modal scrim:** `rgba(33, 37, 41, 0.4)` over the full viewport.

### Layout

- **Headline:** 16px semibold `#212529`. Top of dialog, left-aligned.
- **Body:** optional supporting copy. None in MVP — headline carries the message.
- **Actions (right-aligned in dialog footer):**
  - **Cancel** (secondary): `#ffffff` fill, `#dee2e6` 1px border, `#495057` text.
  - **Confirm** (primary): `#212529` fill, `#ffffff` text.
  - 8px gap between buttons.

## Behavior (consolidated across all 5 use cases)

### Open

- Trigger: user clicks the action that opens the dialog (Logout action inside dropdown; Demote option; Deactivate option; Reopen button; Confirm button).
- Focus: moves to the Confirm button (most-likely-next-click). For destructive-only dialogs, focus could move to Cancel instead — not in MVP but reserved.
- ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="<headline-id>"`.

### Cancel

- Trigger: click Cancel button; press `Esc`; click scrim outside dialog.
- Result: dialog closes, no action applied, focus returns to trigger that opened it.
- Used when the user changed their mind or clicked accidentally.

### Confirm

- Trigger: click Confirm button; press `Enter` while Confirm is focused.
- Result: dialog stays open while the action is in flight (button shows spinner, both buttons disabled); on success, dialog closes and the action is applied; on server error, dialog stays open with an inline error above the action row ("Couldn't <action>. Try again.").
- Used when the user explicitly accepts the consequence.

### Submitting (in flight)

- Both buttons disabled.
- Spinner inside Confirm button.
- Cancel remains keyboard-accessible but visually disabled (defensive: prevents cancel-during-flight race).

### Error

- Inline error above the action row: "Couldn't <action>. Try again."
- Dialog stays open.
- User can retry Confirm or explicitly Cancel.
- Used when the server returns 5xx or network fails.

## Composition

- **Dialog modal** — see [dialog-modal](../03-molecules/dialog-modal.md) for the atom-level spec.
- **Button** — see [button](../02-atoms/button.md) for primary + secondary button styling.

## Accessibility (consolidated)

- **ARIA dialog pattern:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby="<headline-id>"`. Tab cycles between Cancel and Confirm.
- **Focus trap:** focus is trapped inside the dialog while it's open.
- **Initial focus:** moves to Confirm button by default.
- **Return focus:** when dialog closes, focus returns to the trigger that opened it.
- **Screen reader announcement:** when the dialog opens, the screen reader announces the dialog's role and reads the headline. The user is immediately oriented.
- **Color contrast:** headline `#212529` on `#ffffff` = 16.8:1 (AAA). Confirm button `#ffffff` on `#212529` = 16.8:1 (AAA). Cancel button `#495057` on `#ffffff` = 8.6:1 (AAA).
- **Scrim opacity:** `rgba(33, 37, 41, 0.4)` — sufficient to dim the page without removing underlying content from the DOM (screen-reader users can still navigate via headings / landmarks).

## Why "no body copy"?

- The headline carries the consequence. For MVP dialogs (Logout, Admin demotion, Admin deactivation, Reopen, Confirm close), the headline is unambiguous: "Log out of HelpDesk Lite?" / "Demote X from Admin to Y? They will lose admin access immediately." No "Are you sure?" preamble — the headline IS the question.
- Body copy is reserved for dialogs that genuinely need explanation (e.g., "This action will affect 47 records"). None of the MVP dialogs need this.

## See also

- [dialog-modal](../03-molecules/dialog-modal.md) — the molecule-level spec.
- [button](../02-atoms/button.md) — primary + secondary button styling.
- [app-chrome](app-chrome.md) — Logout dialog lives inside the dropdown panel.
- [users-table-page](../04-organisms/users-table-page.md) — Admin demotion / deactivation dialogs.
- [ticket-detail-page](../04-organisms/ticket-detail-page.md) — Reopen / Confirm dialogs.
