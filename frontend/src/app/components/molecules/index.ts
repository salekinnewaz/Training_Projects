/**
 * `components/molecules/` barrel — D6 slice.
 *
 * Selective re-export of the 9 molecule components and their
 * accompanying public types. **Additive only** — every existing
 * deep import path (`./dialog-modal/dialog-modal.component`,
 * etc.) keeps working unchanged. New consumers can write:
 *
 *   import {
 *     DialogModalComponent,
 *     FormFieldComponent,
 *   } from '../../components/molecules';
 *
 * instead of the full path. Each re-export is explicit (no
 * `export *`) — same rationale as `components/atoms/index.ts`.
 *
 * No new pattern — this is the standard ES module barrel. See
 * `_bmad-output/implementation-artifacts/spec-d6-component-barrels.md`
 * for the slice spec.
 */

export { DialogModalComponent } from './dialog-modal/dialog-modal.component';
export { DropdownPanelComponent } from './dropdown-panel/dropdown-panel.component';
export { EmptyStateComponent } from './empty-state/empty-state.component';
export { FormFieldComponent } from './form-field/form-field.component';
export { HeaderChromeComponent } from './header-chrome/header-chrome.component';
export { KanbanCardComponent } from './kanban-card/kanban-card.component';
export { StatStripComponent } from './stat-strip/stat-strip.component';
export type {
  StatStripAccent,
  StatStripItem,
} from './stat-strip/stat-strip.component';
export { TicketRowComponent } from './ticket-row/ticket-row.component';
export { TimelineEntryComponent } from './timeline-entry/timeline-entry.component';
export type { ActorLookup } from './timeline-entry/timeline-entry.component';
export { UserRowComponent } from './user-row/user-row.component';

/* WDS-2026 shared ticket table — used by the User, Support Agent
   and Admin dashboards alike. */
export { TicketTableComponent } from './ticket-table/ticket-table.component';
export type { TicketTableRow } from './ticket-table/ticket-table.component';
export { TICKET_TABLE_PAGE_SIZES } from './ticket-table/ticket-table.component';
export { TicketFilterBarComponent } from './ticket-filter-bar/ticket-filter-bar.component';
export type {
  SharedTicketFilterState,
  SharedTicketSort,
} from './ticket-filter-bar/ticket-filter-bar.component';
