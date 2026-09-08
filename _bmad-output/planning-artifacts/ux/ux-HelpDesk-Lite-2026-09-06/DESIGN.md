---
title: HelpDesk Lite — Design
status: final
created: 2026-09-06
updated: 2026-09-06
project: Training_3
form_factor: web
---

# HelpDesk Lite — Design

> Visual identity per the Google Labs design.md spec. Visual specs only. Behavior lives in EXPERIENCE.md.

## Brand & Style

A calm, professional, low-friction internal tool. Nothing playful, nothing enterprise-heavy. The product should feel like a tidy desk: nothing in the way, everything where you'd expect it. Status, priority, and assignee are the visual heroes of every surface.

**Voice cues for visual design:**
- Restrained color: the surface is neutral; status and priority are the only saturated elements
- Generous whitespace: each ticket card and row breathes
- Hierarchy by weight and size, not decoration
- Iconography is functional, not expressive

## Colors

| Token | Value | Use |
|---|---|---|
| `colors.surface.base` | `#FFFFFF` | Page background (light mode) |
| `colors.surface.subtle` | `#F7F8FA` | Card rows, secondary panels |
| `colors.surface.muted` | `#EEF1F4` | Hover, dividers, Kanban column bg |
| `colors.border.default` | `#E4E7EB` | Default 1px borders |
| `colors.border.strong` | `#CBD2D9` | Focused/active borders |
| `colors.text.primary` | `#1F2933` | Body, headings |
| `colors.text.secondary` | `#52606D` | Labels, metadata |
| `colors.text.muted` | `#7B8794` | Timestamps, helper text |
| `colors.text.inverse` | `#FFFFFF` | Text on saturated status pills |
| `colors.action.primary` | `#2563EB` | Primary buttons, focus rings |
| `colors.action.primaryHover` | `#1D4ED8` | Primary hover |
| `colors.status.open` | `#2563EB` | Status pill: Open |
| `colors.status.inProgress` | `#D97706` | Status pill: In Progress |
| `colors.status.resolved` | `#059669` | Status pill: Resolved |
| `colors.status.closed` | `#6B7280` | Status pill: Closed |
| `colors.priority.high` | `#DC2626` | Priority pill: High |
| `colors.priority.medium` | `#D97706` | Priority pill: Medium |
| `colors.priority.low` | `#6B7280` | Priority pill: Low |
| `colors.danger` | `#DC2626` | Destructive actions (deactivate) |

**Accessibility:** Status and priority pills always pair color with a text label and an icon glyph. Color is never the sole signal.

## Typography

| Token | Value | Use |
|---|---|---|
| `typography.fontFamily.base` | `"Inter", system-ui, -apple-system, sans-serif` | All UI text |
| `typography.fontFamily.mono` | `"JetBrains Mono", ui-monospace, monospace` | Ticket IDs (#1001) |
| `typography.size.xs` | `12px` | Timestamps, helper |
| `typography.size.sm` | `14px` | Body, table cells |
| `typography.size.md` | `16px` | Card titles, form labels |
| `typography.size.lg` | `20px` | Page headings |
| `typography.size.xl` | `28px` | Login/register hero |
| `typography.weight.regular` | `400` | Body |
| `typography.weight.medium` | `500` | Labels, table headers |
| `typography.weight.semibold` | `600` | Card titles, section headings |
| `typography.weight.bold` | `700` | Page titles (rare) |
| `typography.lineHeight.tight` | `1.25` | Headings |
| `typography.lineHeight.normal` | `1.5` | Body, descriptions |
| `typography.lineHeight.relaxed` | `1.625` | Comment threads |

## Layout & Spacing

| Token | Value | Use |
|---|---|---|
| `spacing.unit` | `4px` | Base unit |
| `spacing.xs` | `4px` | Inline icon gaps |
| `spacing.sm` | `8px` | Tight stacks (label → input) |
| `spacing.md` | `16px` | Card padding, form gaps |
| `spacing.lg` | `24px` | Section separation |
| `spacing.xl` | `32px` | Page padding, modal padding |
| `spacing.2xl` | `48px` | Auth hero vertical rhythm |
| `radius.sm` | `4px` | Pills, tags |
| `radius.md` | `6px` | Buttons, inputs |
| `radius.lg` | `8px` | Cards, modals |
| `container.maxWidth` | `1280px` | Page content max-width |
| `container.formMaxWidth` | `480px` | Create Ticket, Login forms |

**Grid:** 8-pt spacing system. Card padding = `spacing.md` (16px). Page gutters = `spacing.xl` (32px).

## Elevation & Depth

| Token | Value | Use |
|---|---|---|
| `elevation.none` | `none` | Flat surfaces, table rows |
| `elevation.subtle` | `0 1px 2px rgba(31, 41, 51, 0.06)` | Cards on neutral bg |
| `elevation.raised` | `0 4px 12px rgba(31, 41, 51, 0.08)` | Modals, dropdowns |
| `elevation.overlay` | `0 12px 32px rgba(31, 41, 51, 0.16)` | Top-level dialogs |

Shadows are quiet. The product relies on whitespace and borders more than elevation.

## Shapes

| Token | Value | Use |
|---|---|---|
| `shape.button` | `radius.md` (6px) | All buttons |
| `shape.input` | `radius.md` (6px) | All form inputs |
| `shape.pill` | `radius.sm` (4px), full padding-y 2px | Status, priority pills |
| `shape.card` | `radius.lg` (8px) | Ticket cards, panel containers |
| `shape.modal` | `radius.lg` (8px) | Modal container |

## Components

### Button
- **Primary**: `colors.action.primary` bg, white text, `radius.md`
- **Secondary**: white bg, `colors.border.strong` border, primary text
- **Danger**: `colors.danger` bg, white text — used only for "Deactivate user" with confirmation
- **Ghost**: transparent bg, primary text, used in cards
- Padding: `spacing.sm` vertical, `spacing.md` horizontal
- Font: `typography.size.sm`, `typography.weight.medium`
- Disabled state: 50% opacity, no pointer events

### Input (text, textarea, select)
- `colors.surface.base` bg, `colors.border.default` border
- Focus: `colors.border.strong` border + 2px `colors.action.primary` outer ring
- Error: `colors.danger` border + helper text below in `colors.danger`
- Padding: `spacing.sm` vertical, `spacing.md` horizontal
- Label above input, `typography.size.sm`, `typography.weight.medium`, `colors.text.secondary`

### Status Pill
- `radius.sm`, padding `2px 8px`
- Saturated bg at ~12% opacity + saturated text at full strength
- Always paired with a small status glyph (icon) and the text label
- Statuses: Open · In Progress · Resolved · Closed (mapped to `colors.status.*`)

### Priority Pill
- Same shape as Status Pill
- Priorites: Low · Medium · High (mapped to `colors.priority.*`)
- Always paired with an arrow/glyph and the text label

### Ticket Card (Kanban)
- `radius.lg`, `colors.surface.base` bg, `elevation.subtle`
- Padding `spacing.md`
- Layout: title (semibold), then row of [Priority pill · Status pill], then row of [#ID · Assignee avatar]
- Hover: `elevation.raised`, slight `colors.border.strong` border
- Drag handle: subtle 6-dot glyph top-right when hovered (Kanban only)

### Ticket Row (table fallback — used minimally)
- 1px bottom border `colors.border.default`
- Cells: #ID (mono) · Title · Priority pill · Status pill · Assignee · Updated
- Hover: `colors.surface.subtle` bg

### Top Bar
- 56px tall, white bg, 1px bottom border
- Left: logo / "HelpDesk Lite" wordmark
- Center: global search (agents only, hidden for users)
- Right: profile menu (avatar + dropdown with Profile, Logout)

### Comment Bubble
- Avatar + author name + relative timestamp on first line
- Body text in `typography.lineHeight.relaxed`
- Author roles distinguished subtly: agent comments get a small "Agent" badge after the name
- User comments plain

### Modal
- `radius.lg`, `elevation.raised`
- Max-width 480px, padding `spacing.xl`
- Title (lg), body, action row right-aligned (Cancel secondary, Confirm primary)

### Empty State
- Centered icon (muted), one-line explanation, primary action button
- Examples: "No tickets yet — create your first one"

## Do's and Don'ts

**Do**
- Pair every color with a text label and icon glyph (status, priority)
- Make the active ticket's status, priority, and assignee the first thing the eye lands on
- Keep the Create Ticket form to one screen, no tabs, no progressive disclosure
- Use the Kanban board as the agent's home, not a secondary view

**Don't**
- Don't use color alone to signal status or priority
- Don't add decorative icons, illustrations, or imagery
- Don't introduce a sidebar nav (top bar only — 10 screens don't justify it)
- Don't darken or saturate the page chrome — the ticket cards are the visual focus
- Don't add animation beyond 150ms color/opacity transitions on hover
