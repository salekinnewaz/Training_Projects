# Loading Skeleton Pattern

**Category:** Pattern
**Phase 4 source:** Every authenticated page's loading state

---

## Overview

A cross-page pattern for indicating that a page's data is being fetched. The pattern uses skeleton placeholders — grey bars where text and content would be — instead of a spinner overlay. This communicates "the system is working on it" without hiding the page layout, so the user sees the page shape while it loads.

The skeleton is the load signal. No spinner on top of the page chrome; the skeleton IS the loading state.

## When to use

- On initial page load when the page has content to display (rows, cards, comments, etc.).
- Whenever the user is waiting for the server to respond with primary page content.

## When NOT to use

- For actions that take <300ms (no skeleton — just disable the trigger and show the result).
- For file uploads / progress (use a progress bar instead — out of MVP).
- For inline actions that don't refetch the whole page (use a local spinner on the trigger button, not a skeleton).

## Anatomy (per surface)

### Skeleton bar

- **Height:** matches the content it replaces. Common heights:
  - 16px tall for single-line text (e.g., table row text, micro-labels)
  - 20px tall for body text
  - 24px tall for headings
- **Width:** matches the content's natural width. For full-width rows, the bar spans the row width minus padding.
- **Background:** `#e9ecef` (a step lighter than the page background, so it's distinguishable but not noisy).
- **Border-radius:** 4px (matches input / button radius).
- **No animation in MVP.** A subtle pulse animation could be added in v1.x.

### Per-page skeleton composition

#### Ticket Detail

- Header card skeleton: 6 grey bars where ticket number / title / metadata would be.
- Description block: 3 grey bars where the description text would be.
- Comments: 2-3 grey comment cards (avatar placeholder + name placeholder + body placeholder).
- Composer: textarea placeholder + button placeholder.

#### Employee Dashboard

- Heading row: heading placeholder (left) + button placeholder (right).
- List area: 5 row skeletons, each 64px tall with 3 grey bars (ticket number placeholder, title placeholder, timestamp placeholder).

#### Agent Kanban

- Heading row: heading placeholder.
- Filter strip: 4 control placeholders (search box, 3 dropdowns).
- Kanban board: 4 columns each with 3 card skeletons (96px tall, 2 grey bars per card).

#### Admin Dashboard

- Heading row: heading placeholder + tab switcher placeholders.
- Dashboard tab: 4 card skeletons (rounded, 720px tall, grey bars where text would be).
- Users tab: 5 row skeletons (64px tall, 5 grey bars per row).

#### Users tab

- Heading row: heading placeholder + active-count placeholder.
- Table: 5 row skeletons (64px tall, 5 grey bars per row).

#### Create Ticket

- **No skeleton in MVP** — Create Ticket's initial load is fast (no fetch); the empty form is rendered directly. If the form ever needs to pre-populate from the server, the skeleton would apply to the fields.

#### Login

- **No skeleton in MVP** — Login has no data to fetch; the form renders immediately.

#### Submission Confirmation

- **No skeleton in MVP** — the page is reached only after a successful POST; the data is in the navigation state.

## Behavior

- **Initial render:** the page renders with skeleton placeholders immediately (no flash of empty content).
- **Fetch resolves:** placeholders are replaced with real content. No transition animation in MVP — instant replacement.
- **Fetch fails:** skeleton is replaced with the [server-error-state](server-error-state.md) inline error pattern.
- **No refresh button** on the skeleton. The fetch is in flight; the user waits.

## Tokens Used

- `color-skeleton-bg` (`#e9ecef`) for skeleton bar background
- `radius-skeleton` (4px) for skeleton bar radius
- `space-skeleton-row-height` (matches the content it replaces — 16px / 20px / 24px / 40px / 64px / 96px)

## Why skeleton, not spinner?

- **Skeleton shows the page shape.** The user sees the heading row, the filter strip, the columns. They know what's coming. A spinner covers the page and gives no shape information.
- **Skeleton feels faster.** Even when it's not, the perceived load time is lower because the user is looking at a populated page shape, not a blank canvas with a spinning circle.
- **Skeleton is consistent.** The same pattern applies to every page, so the user learns "skeleton = loading" once.

## Accessibility

- **ARIA live region:** the loading container has `aria-live="polite"` and `aria-busy="true"`. Screen readers announce "loading" when the skeleton appears and stop announcing when the content replaces it.
- **Skip-to-content still works:** the persistent chrome's skip link (see [app-chrome](app-chrome.md)) remains functional during loading. The user can skip past the chrome even while the skeleton is showing.
- **No focus trap:** the skeleton is not interactive. Focus remains on whatever was focused before the navigation.
- **Color contrast:** `#e9ecef` on `#f8f9fa` = 1.15:1 — intentionally low. The skeleton is meant to be visually subordinate to the page chrome, not a focus point.
- **No reliance on color alone:** the skeleton is identifiable by shape (bars where text would be) and by `aria-busy="true"`, not just by its color.

## See also

- [empty-state](../03-molecules/empty-state.md) — for the empty (no items) variant.
- [server-error-state](server-error-state.md) — for the fetch-failed variant.
- [app-chrome](app-chrome.md) — for the persistent chrome that includes the skip link.
