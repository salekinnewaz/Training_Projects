# Form Field (label + select dropdown)

**Category:** Molecule
**Composed of:** [label](../02-atoms/label.md) + [select](../02-atoms/select.md)
**Phase 4 source:** Create Ticket (Category, Priority), Agent Kanban (Priority, Category, Owner filters), Users tab (Role)

---

## Overview

A vertical stack of a visible label above a `<select>` dropdown, sharing the same vertical rhythm as [form-field](form-field.md) but with a native HTML select control in place of the text input. Used wherever the user picks one value from a small, fixed set.

The molecule appears in two distinct contexts:
1. **Primary form context** (Create Ticket's Category / Priority) — sits in a form column with a visible label, full column width, 44px tall.
2. **Filter-strip context** (Agent Kanban's Priority / Category / Owner filters, Users tab's Role dropdown) — labels are inline (e.g., `Priority: All ▾`), 40px tall, fixed widths per filter.

## Variants

### Standard dropdown field

- **Label:** 14px medium `#495057`, baseline sits 12px above the field top.
- **Select:** 44px tall, 4px radius, `#adb5bd` 1px border, native `<select>` element.
- **Selected value text:** `#212529` 14px regular.
- **Caret:** standard [caret](../02-atoms/caret.md) at the right end of the field.
- **Padding:** 16px horizontal inside the select, with extra right padding to make room for the caret.
- **Width:** fills the parent column (100% within a 720px form column on Create Ticket).

### Filter dropdown (inline label)

- Label rendered inline as a prefix in the field's display value: `Priority: All ▾` / `Owner: Mine ▾`.
- 40px tall, 140px wide (Priority, Category) or 160px wide (Owner).
- Same radius, border, and color tokens as Standard.
- Used in the Agent Kanban filter strip and similar compact contexts.

### Role dropdown (Users tab)

- Renders inside a table row.
- Width: fits the Role column (≈160px).
- Height: matches row height (≈40px) — slightly shorter than the 44px form-field default to fit cleanly inside the 64px row.
- **Disabled state** for the self-row: see [self-row-table](self-row-table.md).

### Disabled / read-only

- Used on the Users tab's self-row role dropdown.
- Border `#dee2e6`, text `#adb5bd`, `cursor: not-allowed`.
- Surrounding context carries the explanation ("You cannot change your own role.").

## States

| State | Display |
|---|---|
| Default | `#adb5bd` 1px border, value `#212529`, caret `#495057` |
| Hover (open native menu) | Browser-rendered; menu inherits the select's styling tokens where possible |
| Focus | Border becomes `#212529` 1.5px; native focus ring on the select element |
| Selected (non-default value) | Text color stays `#212529`; the field's appearance doesn't change after selection |
| Required-but-empty (placeholder) | Placeholder text `#adb5bd` (e.g., `Select category…`); the field itself is not visually flagged until submit |
| Error (validation failed) | Border becomes `#c92a2a` 1.5px; inline error message `#c92a2a` 14px renders 8px below |
| Disabled | Border `#dee2e6`, text `#adb5bd`, caret `#adb5bd`, `cursor: not-allowed` |

## Tokens Used

- `color-label` (`#495057`) for label text
- `color-primary` (`#212529`) for value text and focused border
- `color-border-default` (`#adb5bd`) for default border
- `color-placeholder` (`#adb5bd`) for placeholder option text
- `color-disabled-text` (`#adb5bd`) for disabled value text
- `color-error` (`#c92a2a`) for validation error border + message
- `color-caret` (`#495057`) for dropdown caret
- `font-size-body` (14px), `font-weight-medium` for label
- `radius-input` (4px) on field radius
- `space-field-height` (44px in form, 40px in filter strip / table row)
- `space-label-field-gap` (12px)

## Used In

- **Create Ticket** (`create-ticket.md`): Category field (optional, defaults to placeholder), Priority field (required, defaults to Medium).
- **Agent Kanban** (`agent-kanban.md`): Priority, Category, Owner filters in the filter strip.
- **Users tab** (`users-tab.md`): Role dropdown per row (disabled on self-row).

## Usage Guidelines

**When to use:**
- When the user picks one value from a small, fixed set (typically ≤10 options).
- When the options are static and don't change based on context (otherwise an autocomplete / typeahead is more appropriate — out of MVP).

**When NOT to use:**
- For free-form text (use [form-field](form-field.md)).
- For binary on/off choices (use a toggle — out of MVP).
- For long option lists where the user needs to search (use a combobox — out of MVP).

**Placeholder vs. blank:**
- If the field is optional, the first option is a placeholder (`Select category…`, `All`, etc.) and does not represent a real selection. The submit payload omits the field if the placeholder is still chosen.
- If the field is required, default to a meaningful value (Priority defaults to Medium) so the field is never invalid by default.

**Filter strip usage:**
- Inline prefix label (`Priority: All ▾`) keeps the filter row compact. The "All" option is the reset value — `Clear filters` (a small `× Clear` link) appears only when at least one filter is non-default.

## Accessibility

- **Native `<select>`:** the browser handles keyboard navigation, screen reader announcements, and option list rendering. Do not replace with a custom dropdown for MVP.
- **Label association:** every select has a `<label for="id">` pairing. For the filter-strip variant, the label can be the visible prefix text inside the field's display value (e.g., `Priority: All ▾`); a visually-hidden `<label>` is still present in the DOM to keep the association accessible.
- **Required state:** `aria-required="true"` on required selects (Priority on Create Ticket).
- **Disabled state:** native `disabled` attribute; screen readers announce "dimmed" or "unavailable" depending on the platform.
- **Color contrast:** `#212529` selected value on `#ffffff` = 16.8:1 (AAA). Placeholder `#adb5bd` on `#ffffff` = 2.8:1 — relies on the placeholder being visually distinct (lighter weight) rather than on color contrast for its affordance.
