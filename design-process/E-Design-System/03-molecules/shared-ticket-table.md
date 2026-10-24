# Shared Ticket Table (molecule)

**Components:**
- `components/molecules/ticket-table/ticket-table.component.ts` — `<ticket-table>`
- `components/molecules/ticket-filter-bar/ticket-filter-bar.component.ts` — `<ticket-filter-bar>`
- `components/atoms/ticket-category-icon/ticket-category-icon.component.ts` — `<ticket-category-icon>`

**Shared query logic:** `services/ticket-table-query.ts`

**Used by:** all three role dashboards — the Employee Dashboard (`/dashboard`), the Support Agent's Tickets page (`/tickets`) and the Admin dashboard's Tickets tab (`/admin`).

## Purpose

One table design, one filter bar and one pagination model, shared verbatim by the **User**, the **Support Agent** and the **Admin**. The WDS-2026 reference defines a single ticket-table layout; the three roles are three *data scopes* of that layout, not three designs.

What differs per role is **only**:

| | User | Support Agent | Admin |
|---|---|---|---|
| **Data source** | `GET /api/tickets/mine` | `GET /api/tickets` | `GET /api/tickets` |
| **Scope** | the caller's own tickets, filtered **in SQL** | the whole queue | the whole queue |
| **Row actions** | none (the kebab is read-only in effect) | resolve / close | resolve / close |
| **Extra filter** | "More filters" toggles status | "More filters" toggles status | "More filters" toggles status |

Everything the reference draws — the filter bar, the ten columns, the row anatomy, the pagination footer — is identical across the three.

## The filter bar

```
┌──────────────────────────────────────┬────────────┬──────────────┬─────────────┬─────────────┬───────────────┐
│ Search tickets by ID, title, or key… │ All custo… │ All applica… │ All priorit…│ All assigne…│ Newest first  │ More filters │
└──────────────────────────────────────┴────────────┴──────────────┴─────────────┴─────────────┴───────────────┘
```

- The **search input** matches the ticket **number**, **title** and **description**, case-insensitively. It debounces at **200ms** (the same figure `header-chrome` and the Agent's older filter bar use) and trims its value.
- **Four dimension dropdowns** — customer, application, priority, assignee — plus a **sort** control. Five `<select>`s in total.
- The visible label is a **mirror** of the selected value: `All customers` when unfiltered, `Avery Chen` when that customer is chosen. The native `<select>` is transparent and sits over the label; the caret is painted by the wrapper's `::after`.
- **"More filters"** is the purple brand-gradient button. It is the affordance for dimensions that do not fit the row (status, date range); for now it toggles the status filter between `all` and `Open`.
- The dropdown **options are derived from the data**, not hard-coded — see `customerOptionsOf`, `applicationOptionsOf`, `assigneeOptionsOf` in `ticket-table-query.ts`. "Application" maps to the ticket's **category**; a null category reads as `General`. "Unassigned" is always offered for the assignee filter.

### Filter-bar test ids

`ticket-filter-bar` · `ticket-filter-search` · `ticket-filter-customer` · `ticket-filter-application` · `ticket-filter-priority` · `ticket-filter-assignee` · `ticket-filter-sort` · `ticket-filter-more`

## The table

Ten columns, in the reference's order:

| # | Column | Width | Notes |
|---|---|---|---|
| 0 | *(select-all)* | 44px | Tri-state header checkbox; hidden when `selectable` is false |
| 1 | *(category)* | 52px | `<ticket-category-icon>` — tinted tile, **distinct shape per category** |
| 2 | **ID** | 84px | `HD-101`, mono, primary colour |
| 3 | **Title** | auto | Bold title with a **muted description** line beneath |
| 4 | **Status** | 120px | `<badge-status>` pill |
| 5 | **Priority** | 104px | `<badge-priority>` pill |
| 6 | **Customer** | 156px | Avatar + name (the ticket's submitter) |
| 7 | **Assignee** | 156px | Avatar + name, or "Unassigned" |
| 8 | **Updated** | 96px | Relative time — "just now", "26m ago", "4d ago", "3mo ago" |
| 9 | *(actions)* | 52px | The `···` kebab |

`table-layout: fixed`, so the widths above are honoured exactly.

### The category glyph

The reference gives each category a **colour**. Colour alone is not accessible (WCAG 1.4.1), so each category also gets a **distinct shape**:

| Category | Colour | Glyph |
|---|---|---|
| IT | blue `#0674FE` on `#EAF2FE` | laptop |
| HR | red `#D92D20` on `#FEE2E2` | person |
| Finance | purple `#7433FE` on `#F0EAFE` | document |
| General | slate `#5D749D` on `#EBEEF6` | folder |

A null category falls back to General. The glyph is `aria-hidden` — the row's text carries the meaning.

### The pagination footer

```
Showing 1–10 of 156 tickets                    ‹ 1 2 3 4 5 … 16 ›   [10 / page ▾]
```

- The summary copy is **exactly** `Showing {start}–{end} of {total} tickets`, with an en dash. An empty result set reads `Showing 0–0 of 0 tickets`.
- The numbered pager is the existing `<pagination>` molecule.
- The page-size picker offers **10 / 25 / 50**, labelled `10 / page`.

### Table test ids

`ticket-table` · `ticket-table-summary` · `ticket-table-page-size`

## The horizontal-scroll contract

The reference keeps its column widths intact on a narrow screen and lets the **table scroll inside its wrapper** rather than squashing its columns. Three rules make that work, and all three are load-bearing:

1. **`.table { min-width: 1040px }`** — without a floor, `table-layout: fixed` squeezes the title column to **0px** at a 420px viewport.
2. **`.table-wrap { overflow-x: auto; position: relative }`** — the wrapper is the scroll container. It must also be a **containing block**: the `.sr-only` cells inside the table are absolutely positioned, and without a positioned ancestor they resolve against the **viewport**, so the visually hidden "Actions" label at the far right of the 1040px table stretched the whole page sideways (`documentElement.scrollWidth` 1073 at a 420px viewport).
3. **The page's grid column is `minmax(0, 1fr)`** and the host carries `min-width: 0` — an `auto` grid column is sized to its items' **min-content** width, so without the zero minimum the table's 1040px dragged the page's column out to that width and pulled the stat strip sideways with it.

Rule 3 is why all three pages set an explicit zero-minimum column.

## The query pipeline

`filterTickets → sortTickets → pageCountFor → pageSlice` — pure functions in `services/ticket-table-query.ts`, shared by all three pages. The pipeline is **filter → sort → paginate**, in that order.

- The sorts are **total and stable**: `newest`, `oldest`, `priority` (High → Medium → Low), `status` (Open → In Progress → Resolved → Closed).
- `filterTickets` and `sortTickets` **never mutate** their input.
- Changing a filter resets to **page 1**; changing the page size also resets to page 1.

## Verification

`qa/scripts/verify-shared-table.js` proves the reference against the live DOM for all three roles — **67 checks**:

1. The reference filter bar (placeholder verbatim, five selects, default labels, the gradient button)
2. The reference's ten columns, in order
3. A populated row (glyph, number, title + description, both pills, customer, assignee, relative time, kebab)
4. The pagination footer (summary copy, page-size options, numbered pager)
5. All three roles render the **same** layout — columns and filter labels compared role-to-role
6. The search filter narrows the rows
7. Each dropdown filter narrows the rows
8. The sort control reorders the rows
9. The pagination navigates between pages
10. The page-size picker changes the rows per page
11. An empty result set renders the empty row, not a broken table
12. A narrow phone scrolls the table rather than squashing it — and no page overflows sideways
13. The User sees only their own tickets (asserted at the **API**, `GET /api/tickets/mine`)

Run it with the stack up:

```bash
node qa/scripts/verify-shared-table.js
```
