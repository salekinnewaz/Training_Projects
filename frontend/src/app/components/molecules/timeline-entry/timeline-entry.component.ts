/**
 * timeline-entry — molecule (HD-010).
 *
 * Single row in the activity timeline below the comments thread.
 * Renders: actor `<chrome-avatar [size]="24">` + actor display
 * name (or "System" when `actor` is null) + relative timestamp +
 * event-specific description derived from `eventType` + `payload`.
 *
 * Description templates (per spec):
 *   Created           → "Ticket created"
 *   Assigned          → "Assigned to {name}" (lookup assigneeId)
 *   Reassigned        → "Reassigned from {prev} to {new}"
 *   StatusChanged     → "Status changed from {from} to {to}"
 *   PriorityChanged   → "Priority changed from {from} to {to}"
 *   Reopened          → "Reopened by {actor}"
 *   ConfirmedClosed   → "Closed by {actor}"
 *   CommentAdded      → "{author} commented"
 *
 * OnPush. Standalone. No animation. Reuses the existing
 * `<chrome-avatar>` atom for the actor glyph — no new tokens.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import { ChromeAvatarComponent } from '../../atoms/chrome-avatar/chrome-avatar.component';
import type {
  ActivityEventPayload,
  ActivityLog,
} from '../../../models/activity-log';
import type { UserPublic } from '../../../models/user';

/**
 * Map of known assignee/reassignee user names for description
 * derivation. The page passes this in alongside the activity row
 * because the wire shape (`payload.assigneeId` / `fromUserId` /
 * `toUserId`) is just an id — the human-readable name comes from
 * the page's already-loaded agents + ticket submitter / owner
 * lookup table.
 *
 * Keys are user ids (numbers). Missing keys fall back to "Someone"
 * so the row never shows a literal `undefined`.
 */
export type ActorLookup = Record<number, string>;

@Component({
  selector: 'timeline-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChromeAvatarComponent],
  template: `
    <article class="entry" data-testid="timeline-entry">
      <chrome-avatar
        [displayName]="actorDisplayName()"
        [size]="24"
      />
      <div class="entry-body">
        <p class="entry-headline">
          <span class="actor-name">{{ actorDisplayName() }}</span>
          <span class="entry-description">{{ description() }}</span>
        </p>
        <time class="entry-time" [attr.datetime]="createdAt()">
          {{ relativeTime() }}
        </time>
      </div>
    </article>
  `,
  styles: [`
    :host {
      display: block;
    }
    .entry {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
    }
    .entry-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .entry-headline {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-primary);
    }
    .actor-name {
      font-weight: 600;
      margin-right: 6px;
    }
    .entry-description {
      color: var(--color-label);
    }
    .entry-time {
      font-size: 12px;
      color: var(--color-muted);
    }
  `],
})
export class TimelineEntryComponent {
  /** The event type from the wire. */
  readonly eventType = input.required<ActivityLog['eventType']>();

  /** The actor user (null = system event, e.g. legacy Created rows). */
  readonly actor = input<UserPublic | null>(null);

  /** ISO timestamp from the wire. */
  readonly createdAt = input.required<string>();

  /**
   * The event-type discriminated payload from the wire. The
   * description derivation switches on `eventType` (payload is
   * typed correctly because of the discriminated union).
   */
  readonly payload = input<ActivityEventPayload | null>(null);

  /**
   * Lookup table of user-id → displayName. Used to turn numeric
   * `fromUserId` / `toUserId` / `assigneeId` into the human
   * strings the timeline-entry template needs.
   */
  readonly lookup = input<ActorLookup>({});

  /** Display name shown next to the avatar. */
  readonly actorDisplayName = computed(() => {
    const a = this.actor();
    if (a) return a.displayName;
    return 'System';
  });

  /** Event-specific description derived from eventType + payload. */
  readonly description = computed(() => {
    const type = this.eventType();
    const payload = this.payload();
    const lookup = this.lookup();
    return describe(type, payload, lookup);
  });

  /** Human-readable relative timestamp ("2 hours ago" etc.). */
  readonly relativeTime = computed(() => formatRelative(this.createdAt()));
}

/**
 * Convert an ISO timestamp to a coarse relative label. We intentionally
 * avoid pulling in a date-fns dep — the spec only requires
 * "2 hours ago"-style labels, so a small hand-rolled helper is
 * fine. Tests stub the locale by using `Math.floor` against
 * numeric thresholds; locale-aware formatting lands in HD-011 if
 * needed.
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';

  const sec_ = Math.floor(diffMs / 1000);
  if (sec_ < 45) return 'just now';
  const min = Math.floor(sec_ / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month === 1 ? '' : 's'} ago`;
  const year = Math.floor(day / 365);
  return `${year} year${year === 1 ? '' : 's'} ago`;
}

/**
 * Derive the per-event description string.
 *
 * The function is pure + exhaustive: TypeScript's discriminated
 * union for `ActivityEventPayload` means every `case` narrows
 * correctly. If a future `eventType` is added without a case, the
 * compiler will error here (better than a silent fallback).
 */
function describe(
  type: ActivityLog['eventType'],
  payload: ActivityEventPayload | null,
  lookup: ActorLookup,
): string {
  switch (type) {
    case 'Created':
      return 'created this ticket';
    case 'Assigned':
      if (payload && payload.eventType === 'Assigned') {
        const name = lookup[payload.assigneeId] ?? 'someone';
        return `assigned the ticket to ${name}`;
      }
      return 'assigned the ticket';
    case 'Reassigned':
      if (payload && payload.eventType === 'Reassigned') {
        const fromName =
          payload.fromUserId !== null
            ? (lookup[payload.fromUserId] ?? 'someone')
            : 'Unassigned';
        const toName = lookup[payload.toUserId] ?? 'someone';
        return `reassigned the ticket from ${fromName} to ${toName}`;
      }
      return 'reassigned the ticket';
    case 'StatusChanged':
      if (payload && payload.eventType === 'StatusChanged') {
        return `changed status from ${payload.from} to ${payload.to}`;
      }
      return 'changed status';
    case 'PriorityChanged':
      if (payload && payload.eventType === 'PriorityChanged') {
        return `changed priority from ${payload.from} to ${payload.to}`;
      }
      return 'changed priority';
    case 'Reopened':
      return 'reopened this ticket';
    case 'ConfirmedClosed':
      return 'closed this ticket';
    case 'CommentAdded':
      return 'commented';
    default: {
      // Exhaustiveness guard — a future eventType without a case
      // will trigger this `never` assignment.
      const _exhaustive: never = type;
      return String(_exhaustive);
    }
  }
}