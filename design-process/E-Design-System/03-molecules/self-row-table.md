# Self-Row Table Pattern (Users tab self-row)

**Category:** Molecule
**Composed of:** [divider](../02-atoms/divider.md) (3px strong left border) + [avatar](../02-atoms/avatar.md) + [select](../02-atoms/select.md) (disabled) + Active toggle (disabled)
**Phase 4 source:** Users tab (the Admin viewing the page)

---

## Overview

A row in the Users table that has been visually distinguished as "this is you, the Admin viewing the page." The row uses a strong left border, a slightly muted background, and disabled controls (Role dropdown + Active toggle) to prevent the Admin from changing their own role or status — a defensive guard against the "last admin demoted themselves" foot-gun in a 5–20-person team.

The pattern applies to any user-management table where the viewer has edit privileges but should not be able to edit their own row. It's a structural protection, not just a UX nicety.

## Variants

### Self-row visual treatment

- **Left border:** 3px `#212529` (primary), full row height. This is the same `color-border-emphasis` token used elsewhere — a heavy visual marker that distinguishes the row at a glance.
- **Background:** `#ffffff` (no tint; the left border is the differentiator). Optional subtle background `#f8f9fa` is reserved for an even-more-emphasized variant (not used in MVP).
- **Disabled control text:** `#adb5bd` (same `color-disabled-text` token used elsewhere).
- **Micro-label below the row:** "You cannot change your own role." — 12px `#868e96`, sits 12px below the row's bottom border.

### Disabled Role dropdown

- Native `<select>` with `disabled` attribute.
- Border: `#dee2e6` (lighter than the active `#adb5bd`).
- Text: `#adb5bd`.
- Caret: `#adb5bd`.
- `cursor: not-allowed`.

### Disabled Active toggle

- Renders as `○ Inactive` (empty circle + label) with all colors desaturated to `#adb5bd`.
- `cursor: not-allowed`.
- Click is a no-op.

## States

| State | Display |
|---|---|
| Default (self-row visible) | Left border, disabled controls, micro-label below |
| Hover | No change (disabled controls don't respond; row hover is permitted for parity but does nothing) |
| Keyboard focus attempt | Disabled controls are skipped in `Tab` order (`tabindex="-1"`) |

## Tokens Used

- `color-border-emphasis` (`#212529` 3px) for self-row left border
- `color-disabled-text` (`#adb5bd`) for disabled control text
- `color-disabled-border` (`#dee2e6`) for disabled control borders
- `color-muted` (`#868e96`) for the micro-label
- `color-surface` (`#ffffff`) for row background
- `font-size-small` (12px) for micro-label
- `space-row-height` (64px) for row height (matches standard Users table row)

## Used In

- **Users tab** (`users-tab.md`): the row corresponding to the Admin viewing the page (Sam Patel, the typical case).

## Usage Guidelines

**When to use:**
- Whenever a user-management surface shows the viewer's own row in an editable list.
- Whenever a destructive / irreversible action would lock the viewer out of the system if applied to themselves.

**When NOT to use:**
- For tables where the viewer doesn't have edit privileges (no need for protection).
- For per-row actions that are reversible and don't threaten access (e.g., changing a row's display color).

**Why a 3px border, not a different background?**
- Background tints can be subtle and easy to miss in a long list. A 3px solid left border is unmistakable in peripheral vision and follows the established "strong divider" vocabulary from the rest of the design system.

**Micro-label wording:**
- "You cannot change your own role." — neutral, factual, not condescending.
- The label sits below the row (not in it) to avoid distorting the row's height.
- The label is muted (`#868e96`) so it doesn't compete with primary content.

**Edge case — single Admin:**
- If a team has only one Admin, that Admin cannot demote or deactivate themselves. They must hand off Admin role to a Support Agent first (which means another Admin must exist, which means the team needs to grow Admin headcount before this becomes a constraint). The pattern enforces this gracefully — the disabled controls communicate the constraint without an error message.

## Accessibility

- **Disabled controls:** native `disabled` attribute on the `<select>` and the toggle. Screen readers announce "dimmed" or "unavailable" depending on platform. The controls are skipped in `Tab` order.
- **Micro-label association:** the label sits directly below the row in the DOM order, so screen readers encounter it as part of the row's content (after the disabled controls).
- **Self-row identification:** the row also carries a `data-self="true"` attribute or equivalent, useful for testing and for screen-reader landmarks (`aria-label="Your own row"` on the `<tr>`).
- **Color contrast:** left border `#212529` on `#ffffff` = 16.8:1 (AAA). Disabled text `#adb5bd` on `#ffffff` = 2.8:1 — relies on the `disabled` attribute and the disabled cursor to communicate the constraint, not on color contrast. Micro-label `#868e96` on `#ffffff` = 4.6:1 (AA for normal text).
- **Keyboard alternative:** if the disabled controls prevent a screen reader user from understanding the constraint, the micro-label provides the explanation textually.
