/**
 * ticket-row — molecule (HD-007 + WDS-2026).
 *
 * One row in the Employee Dashboard list. Renders the row per
 * WDS wireframe (mockups/02-user-dashboard.html line 137-138,
 * 246-253) — six columns:
 *   ticket number (mono) · title · status pill · priority pill ·
 *   assignee (avatar + name | "Unassigned" muted) ·
 *   updated-at (right-aligned, "2 hours ago" style)
 *
 * Implementation note: the spec considered two interaction models:
 *
 *   1. Native `<button>` + `(rowClick)` event
 *   2. Single `<a routerLink>` so the whole row is one focusable element
 *
 * Per the spec's "Ticket-row click vs link semantics" decision,
 * we use option (2) — an `<a routerLink="/tickets/:id">` wraps
 * the row content. This gives native Enter-to-activate keyboard
 * support and one focusable element per row (matches the UX
 * spec exactly: "Tab moves through rows as a single focusable
 * element each"). Removes the need for a `(rowClick)` event.
 *
 * The `relativeTime` input lets the host pass a pre-formatted
 * "2 hours ago" / "Yesterday" string so this component doesn't
 * ship a date-formatting dependency (kept within MVP scope).
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Ticket } from '../../../models/ticket';
import { BadgeStatusComponent } from '../../atoms/badge-status/badge-status.component';
import { BadgePriorityComponent } from '../../atoms/badge-priority/badge-priority.component';
import { ChromeAvatarComponent } from '../../atoms/chrome-avatar/chrome-avatar.component';

@Component({
  selector: 'ticket-row',
  standalone: true,
  imports: [RouterLink, BadgeStatusComponent, BadgePriorityComponent, ChromeAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <li class="row-wrap">
      <a
        class="row"
        [routerLink]="linkHref()"
        [attr.aria-label]="ariaLabel()"
      >
        <span class="number">{{ ticket().number }}</span>
        <span class="title">{{ ticket().title }}</span>
        <span class="status">
          <badge-status [status]="ticket().status" />
        </span>
        <span class="priority">
          <badge-priority [priority]="ticket().priority" />
        </span>
        <span class="assignee">
          @if (ticket().owner; as owner) {
            <chrome-avatar [displayName]="owner.displayName" [size]="20" />
            <span class="assignee-name">{{ owner.displayName }}</span>
          } @else {
            <span class="unassigned">Unassigned</span>
          }
        </span>
        <time class="timestamp" [attr.datetime]="ticket().updatedAt">
          {{ relativeTime() }}
        </time>
      </a>
    </li>
  `,
  styles: [`
    :host {
      display: block;
    }
    .row-wrap {
      list-style: none;
    }
    .row {
      display: grid;
      /* ID · Title · Status · Priority · Assignee · Updated */
      grid-template-columns: 80px 1fr 120px 120px 140px 110px;
      align-items: center;
      gap: 16px;
      height: 64px;
      padding: 0 16px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      color: var(--color-label);
      text-decoration: none;
      cursor: pointer;
      box-sizing: border-box;
      transition: background-color 120ms ease;
    }
    .row:hover {
      background: var(--color-surface-subtle);
      text-decoration: none;
    }
    .row:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: -2px;
      background: var(--color-surface-subtle);
    }
    .number {
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--color-muted);
      letter-spacing: 0.5px;
    }
    .title {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-label);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .status, .priority {
      display: inline-flex;
      align-items: center;
    }
    .assignee {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--color-label);
      min-width: 0;
    }
    .assignee-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .unassigned {
      color: var(--color-muted);
      font-style: italic;
    }
    .timestamp {
      font-size: 13px;
      color: var(--color-muted);
      justify-self: end;
    }
  `],
})
export class TicketRowComponent {
  readonly ticket = input.required<Ticket>();
  readonly relativeTime = input<string>('');

  readonly linkHref = computed(() => `/tickets/${this.ticket().id}`);

  readonly ariaLabel = computed(() => {
    const t = this.ticket();
    const assignee = t.owner ? t.owner.displayName : 'Unassigned';
    return `Ticket ${t.number}, ${t.title}, ${t.status}, ${t.priority} priority, assigned to ${assignee}`;
  });
}
