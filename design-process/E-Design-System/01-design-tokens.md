# Design Tokens

**Phase:** 5 — Design System
**Source:** Consolidated from the 9 Phase 4 page specs.
**Status:** Complete, single source of truth for visual vocabulary.

---

## How to use this document

Every color, type size, spacing value, shadow, and border style used in HelpDesk Lite is documented here. When a Phase 4 spec or a component doc references a token, this is the source. When implementing, every value comes from here.

Tokens are referenced by name (e.g., `color-primary`, `font-size-body`) — implementation layers (CSS variables, Tailwind config, JS constants) translate these names to actual values. The Phase 5 docs use the raw values for clarity.

---

## 1. Colors

### Surface colors

| Token | Value | Purpose |
|---|---|---|
| `color-page-bg` | `#f8f9fa` | Page background (the "outside" color) |
| `color-surface` | `#ffffff` | Cards, app-header strip, table rows, dropdown panel, modal dialog |
| `color-surface-hover` | `#f1f3f5` | Row hover, drag-target highlight |
| `color-surface-disabled` | `#f8f9fa` | Disabled control background (matches page bg to "blend in") |

### Text colors

| Token | Value | Purpose |
|---|---|---|
| `color-primary` | `#212529` | Headings, primary button fill, primary text, count display |
| `color-label` | `#495057` | Body text, secondary headings, form input text, link default state |
| `color-muted` | `#868e96` | Captions, timestamps, micro-labels, disabled text-on-disabled, footer copy |
| `color-on-primary` | `#ffffff` | Text on `color-primary` fill (e.g., primary button label, modal scrim contrast) |
| `color-disabled-text` | `#adb5bd` | Disabled control labels (e.g., disabled role dropdown on self-row) |

### Border colors

| Token | Value | Purpose |
|---|---|---|
| `color-border-default` | `#dee2e6` | Default 1px borders (table rows, cards, app-header bottom, dropdown panel outline) |
| `color-border-strong` | `#adb5bd` | Strong 1px borders (form input outlines, dropdown control outlines) |
| `color-border-emphasis` | `#212529` | 3px border for self-row on Users tab (rare) |

### Status colors

Reused across all surfaces that display ticket status. Pill shape: 22px tall, 11px semibold text.

| Status | Background | Text | Hex (bg / text) |
|---|---|---|---|
| Open | warm cream | warm brown | `#fff5d6` / `#7a5c00` |
| In Progress | cool blue | navy blue | `#d0ebff` / `#1864ab` |
| Resolved | soft green | dark green | `#d3f9d8` / `#2b8a3e` |
| Closed | light grey | medium grey | `#f1f3f5` / `#868e96` |

### Priority colors

Pill shape: 20px tall, 11px semibold text.

| Priority | Background | Text | Hex |
|---|---|---|---|
| Low | light grey | dark grey | `#e9ecef` / `#495057` |
| Medium | warm cream | warm brown | `#fff5d6` / `#7a5c00` |
| High | soft red | dark red | `#ffe3e3` / `#c92a2a` |

### Role colors

Used for role borders / role badges.

| Role | Border / text | Background | Hex (border+text / bg) |
|---|---|---|---|
| Employee | medium grey | (no badge — border only) | `#adb5bd` |
| Support Agent | bright blue | light blue | `#4263eb` / `#edf2ff` |
| Admin | warm brown | (no pill in chrome — border only on owner rows) | `#7a5c00` |

### State / semantic colors

| Token | Value | Purpose |
|---|---|---|
| `color-success` | `#2b8a3e` | "Active" indicator on Users tab, Resolved status text |
| `color-error` | `#c92a2a` | Server error text, inline field error |
| `color-focus-ring` | `#4263eb` | Keyboard focus ring (2px, focus-visible only) |

### Special-purpose colors

| Token | Value | Purpose |
|---|---|---|
| `color-unassigned-bg` | `#fff5d6` | "Unassigned" badge bg on Agent Kanban (same as Open status pill — deliberate visual reuse) |
| `color-unassigned-text` | `#7a5c00` | "Unassigned" badge text |
| `color-orphan-tint` | `rgba(255, 245, 214, 0.12)` | Warm tint on orphan cards in Open column (12% alpha of unassigned color) |
| `color-invalid-drop-bg` | `#fff5f5` | Invalid drop target highlight on Kanban |
| `color-modal-scrim` | `rgba(33, 37, 41, 0.4)` | Modal dialog backdrop overlay |

---

## 2. Typography

### Font stacks

| Token | Value | Use |
|---|---|---|
| `font-system` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | All UI text |
| `font-mono` | `ui-monospace, SFMono-Regular, Menlo, monospace` | Ticket numbers (e.g., `#HD-47`) |

### Font sizes

| Token | Value | Use |
|---|---|---|
| `font-size-micro` | 11px | Small caps headers, micro-labels, badge labels, annotation text, error footer |
| `font-size-mono` | 12px | Mono ticket numbers in card meta rows, table micro-cells |
| `font-size-body-sm` | 13px | Table cell body, table column content |
| `font-size-body` | 14px | Body text, form input text, button labels, link text |
| `font-size-dialog-headline` | 16px | Modal dialog headline |
| `font-size-wordmark` | 22px | "HelpDesk Lite" wordmark in chrome |
| `font-size-page-heading` | 24px | Page heading (top-left of each post-login page) |
| `font-size-count` | 28px | Status summary card count on Admin Dashboard |

### Font weights

| Token | Value | Use |
|---|---|---|
| `font-weight-regular` | 400 | Body text |
| `font-weight-medium` | 500 | Button labels, dropdown labels, table row primary text |
| `font-weight-semibold` | 600 | Page headings, wordmark, badge labels, active tab text, dialog headline |

### Letter spacing

| Token | Value | Use |
|---|---|---|
| `letter-spacing-caps` | 1.2 | Small-caps column headers (e.g., "NAME", "EMAIL", "ROLE") |

---

## 3. Spacing

### Spacing scale (px)

| Token | Value | Use |
|---|---|---|
| `space-1` | 4 | Tight internal padding (e.g., between icon and label) |
| `space-2` | 8 | Standard internal padding for small surfaces (e.g., button vertical) |
| `space-3` | 12 | Standard internal padding (e.g., card content, form input vertical) |
| `space-4` | 16 | Card padding, dropdown panel padding, page top margin below chrome |
| `space-6` | 24 | Dialog internal padding, between sections |
| `space-8` | 32 | Page outer margins |
| `space-16` | 64 | App-header chrome height |

### Semantic spacing

| Token | Value | Use |
|---|---|---|
| `chrome-height` | 64px | App-header chrome strip |
| `filter-strip-height` | 56px | Single horizontal filter row |
| `heading-row-height` | 40px | Page heading row (heading + tab switcher) |
| `row-height-table` | 64px | Employee Dashboard rows, Users table rows |
| `row-height-card-body` | 40px | Status summary card body rows (Admin Dashboard) |
| `column-width-kanban` | 320px | Kanban column width |
| `column-gap-kanban` | 16px | Gap between Kanban columns |
| `form-column-width` | 720px | Create Ticket form column |
| `content-column-width` | 880px | Employee Dashboard, Users table content column |
| `form-column-width-login` | 400px | Login form column |

---

## 4. Shadows

| Token | Value | Use |
|---|---|---|
| `shadow-dropdown` | `0 4px 12px rgba(33, 37, 41, 0.12)` | Dropdown panel lift (My Profile dropdown) |
| `shadow-card-lift` | `0 4px 8px rgba(33, 37, 41, 0.08)` | Kanban card hover/drag lift |
| `shadow-modal-scrim` | `rgba(33, 37, 41, 0.4)` overlay | Modal dialog backdrop |

---

## 5. Border radius

| Token | Value | Use |
|---|---|---|
| `radius-input` | 4px | Text input, select dropdown, button |
| `radius-card` | 6px | Card, dropdown panel, modal dialog |
| `radius-pill` | 11px | Status badge, priority badge, role pill (half of 22px pill height) |
| `radius-avatar` | 50% (full circle) | Avatar |

---

## 6. Borders

| Token | Value | Use |
|---|---|---|
| `border-default` | `1px solid #dee2e6` | Default borders |
| `border-strong` | `1px solid #adb5bd` | Strong borders (form inputs, active dropdown outlines) |
| `border-emphasis` | `3px solid #212529` | Self-row left border on Users tab (rare) |

---

## 7. Focus ring

| Token | Value | Use |
|---|---|---|
| `focus-ring` | `2px solid #4263eb` (focus-visible only) | Keyboard focus indicator on any interactive element. Inset or outset per surface; spec defers to implementation choice. |

The focus ring color matches the Support Agent role-border color — deliberate visual consistency so the focus vocabulary is one color across the app.

---

## 8. Drop-shadow filters (SVG)

When rendering the wireframes via SVG, the dropdown shadow is approximated by `feDropShadow`:

```xml
<filter id="panel-shadow">
  <feDropShadow dx="0" dy="4" stdDeviation="6"
                flood-color="#212529" flood-opacity="0.12"/>
</filter>
```

This produces a shadow equivalent to CSS `0 4px 12px rgba(33,37,41,0.12)` at 1440×900.

---

## Cross-reference to Phase 4 specs

Each Phase 4 spec has its own "Visual Tokens" section that documents the tokens used on that page. This consolidated document is the **source of truth**; the per-spec token sections are kept for in-context reference but should not diverge from this file.

| Phase 4 spec | Token sections |
|---|---|
| `login.md` | Login (page bg, type stack, form column, button radius) |
| `ticket-detail.md` | Ticket Detail (4 status colors, 3 priority colors, 2 role-border colors, content column 880px) |
| `submission-confirmation.md` | Submission Confirmation (reuses Login + Ticket Detail) |
| `create-ticket.md` | Create Ticket (reuses all prior; no new tokens) |
| `employee-dashboard.md` | Employee Dashboard (reuses all prior; no new tokens) |
| `agent-kanban.md` | Agent Kanban (introduces card lift shadow, orphan tint, invalid-drop bg) |
| `admin-dashboard.md` | Admin Dashboard (reuses all status colors; introduces count font 28px, status badge mini-pill 18px) |
| `users-tab.md` | Users tab (active green, disabled text/bg, self-row border) |
| `header-profile-logout.md` | Header / My Profile / Logout (dropdown shadow, modal scrim, focus ring) |

---

_Phase 5 — extracted 2026-09-14 from the 9 Phase 4 specs at `design-process/D-UX-Design/`._
