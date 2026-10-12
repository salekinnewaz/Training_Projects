/**
 * kanban-card — molecule (HD-012).
 *
 * One card in the Agent Kanban board. Renders the ticket's
 * title (2-line clamp) + meta row (mono number · priority
 * pill · owner avatar+name OR "Unassigned" badge) and exposes
 * a `draggable` boolean reflecting `isDragDisabled`.
 *
 * The component is presentational — the host page owns the
 * dragstart / dragend / click handlers and the optimistic
 * move / PATCH. This keeps the molecule reusable in HD-015+
 * where the same card shape may surface in search results
 * or saved-filter widgets.
 *
 * Orphan styling: when `ticket.owner === null` AND the ticket
 * status is `Open` (the only column where orphans float to the
 * top), the card renders the existing `--color-kanban-orphan-tint`
 * background and an "Unassigned" badge in place of the avatar.
 * The page passes a separate `isOrphan` input so the same molecule
 * stays usable in non-Open columns where a null owner doesn't get
 * the same treatment.
 *
 * Reuses:
 *   - <badge-priority>  priority pill
 *   - <chrome-avatar>   owner avatar (when assigned)
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { Ticket } from '../../../models/ticket';
import { BadgePriorityComponent } from '../../atoms/badge-priority/badge-priority.component';
import { ChromeAvatarComponent } from '../../atoms/chrome-avatar/chrome-avatar.component';

@Component({
  selector: 'kanban-card',
  standalone: true,
  imports: [BadgePriorityComponent, ChromeAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="card"
      [class.orphan]="isOrphan()"
      [attr.draggable]="isDragDisabled() ? 'false' : 'true'"
      [attr.aria-grabbed]="isDragDisabled() ? null : 'false'"
      [attr.data-ticket-id]="ticket().id"
    >
      <h3 class="title" [title]="ticket().title">{{ ticket().title }}</h3>
      <div class="meta">
        <span class="number">{{ ticket().number }}</span>
        <badge-priority [priority]="ticket().priority" />
        @if (ticket().owner; as owner) {
          <span class="owner" [title]="owner.displayName">
            <chrome-avatar [displayName]="owner.displayName" [size]="24" />
            <span class="owner-name">{{ owner.displayName }}</span>
          </span>
        } @else {
          <span class="unassigned-badge" data-testid="unassigned-badge">Unassigned</span>
        }
      </div>
    </article>
  `,
  styles: [`
    :host {
      display: block;
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 12px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      cursor: grab;
      box-sizing: border-box;
      transition: box-shadow 120ms ease, transform 120ms ease, border-color 120ms ease;
    }
    .card:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-card-hover);
    }
    .card:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 2px;
    }
    .card:active {
      cursor: grabbing;
    }
    /* Orphan variant — the cream tint the design doc seeds in :root */
    .card.orphan {
      background: var(--color-kanban-orphan-tint);
      border-color: var(--color-kanban-orphan-tint);
    }
    .title {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--color-primary);
      /* 2-line clamp per the design doc; overflow:hidden keeps
         long titles from stretching the card height. */
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .number {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--color-muted);
      letter-spacing: 0.5px;
    }
    .owner {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .owner-name {
      font-size: 12px;
      color: var(--color-label);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .unassigned-badge {
      display: inline-block;
      min-height: 18px;
      padding: 0 8px;
      border-radius: 9px;
      background: var(--color-surface-subtle);
      color: var(--color-muted);
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
    }
  `],
})
export class KanbanCardComponent {
  readonly ticket = input.required<Ticket>();
  /**
   * Disables HTML5 native drag (draggable="false"). Set true for
   * cards in the Closed column (read-only history) per the spec.
   * The page still wants the card to look clickable so the user
   * can open the detail view; the cursor becomes `not-allowed` via
   * the page's column-level CSS rather than this molecule.
   */
  readonly isDragDisabled = input<boolean>(false);
  /**
   * Applies the orphan tint + Unassigned badge. The page passes
   * true for Open-column tickets with `owner === null`; the same
   * ticket in a non-Open column passes false (no special styling).
   */
  readonly isOrphan = input<boolean>(false);

  // computed kept to leave room for future derived flags (priority
  // sort hint, owner-initials contrast, etc.); intentionally unused
  // right now so the molecule stays a flat presentational shell.
  readonly _unused = computed(() => this.ticket().id);
}
