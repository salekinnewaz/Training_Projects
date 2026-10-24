/**
 * notifications-panel — molecule (HD-019).
 *
 * Anchored, right-aligned menu under the chrome bell. Renders the
 * caller's notification feed newest-first, with:
 *
 *   - a header row ("Notifications", "Mark all as read" link)
 *   - the feed list (button-per-row, click marks read + deep-links
 *     to the ticket when `ticketId` is set)
 *   - an empty state ("You're all caught up")
 *   - a load-state copy when the first fetch is in flight
 *
 * No Angular CDK dependency — the panel is anchored by `dropdown-panel`
 * already; this component is just the inside content.
 *
 * Every cell is a real `<button>` rather than a `<div role="button">`
 * so keyboard navigation (Tab into the dropdown, Enter to open the
 * ticket) works without per-cell wiring. Click marks the row read
 * via NotificationsService; if the row carries a `ticketId` we also
 * route to the ticket detail page (route handles its own auth).
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  NotificationsService,
  type NotificationItem,
} from '../../../services/notifications.service';

@Component({
  selector: 'notifications-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="panel-inner" data-testid="notifications-panel">
      <div class="head">
        <span class="head-title">Notifications</span>
        @if (svc.unreadCount() > 0) {
          <button
            type="button"
            class="head-action"
            (click)="markAllRead()"
            data-testid="notifications-mark-all"
          >Mark all as read</button>
        }
      </div>

      @if (svc.loading() && svc.items().length === 0) {
        <div class="empty">Loading…</div>
      } @else if (svc.items().length === 0) {
        <div class="empty">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d="M5 9 a5 5 0 0 1 10 0 v3.5 l1.5 2 H3.5 l1.5 -2 z"
              fill="none" stroke="currentColor" stroke-width="1.7"
              stroke-linecap="round" stroke-linejoin="round" />
            <path d="M8 16 a2 2 0 0 0 4 0" fill="none" stroke="currentColor"
              stroke-width="1.7" stroke-linecap="round" />
          </svg>
          <p>You're all caught up.</p>
        </div>
      } @else {
        <ul class="list" role="list">
          @for (item of svc.items(); track item.id) {
            <li class="row-wrap" [class.unread]="item.unread">
              <button
                type="button"
                class="row"
                (click)="onRowClick(item)"
                [attr.aria-label]="item.title"
              >
                <span
                  class="dot"
                  [class.visible]="item.unread"
                  aria-hidden="true"
                ></span>
                <div class="body">
                  <div class="title">{{ item.title }}</div>
                  @if (item.body) {
                    <div class="sub">{{ item.body }}</div>
                  }
                  <div class="meta">
                    @if (item.actor?.displayName; as actorName) {
                      <span class="actor">{{ actorName }}</span>
                      <span class="dot-sep" aria-hidden="true">·</span>
                    }
                    <time [attr.datetime]="item.createdAt">{{ relative(item.createdAt) }}</time>
                  </div>
                </div>
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .panel-inner {
      width: 360px;
      max-height: 480px;
      overflow-y: auto;
      padding: 4px 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px 8px;
    }
    .head-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text);
    }
    .head-action {
      all: unset;
      font-size: 12px;
      color: var(--color-primary);
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .head-action:hover {
      background: var(--color-primary-tint);
    }
    .empty {
      padding: 32px 16px;
      text-align: center;
      color: var(--color-muted);
      font-size: 13px;
    }
    .empty p {
      margin: 8px 0 0;
    }
    .list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .row-wrap {
      border-top: 1px solid var(--color-border-subtle);
    }
    .row {
      all: unset;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      cursor: pointer;
      box-sizing: border-box;
    }
    .row:hover {
      background: var(--color-surface-subtle);
    }
    .row:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--color-primary-ring);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-error);
      flex-shrink: 0;
      margin-top: 8px;
      opacity: 0;
      transition: opacity var(--duration-fast) var(--ease-out);
    }
    .dot.visible {
      opacity: 1;
    }
    .body {
      flex: 1 1 auto;
      min-width: 0;
    }
    .title {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text);
      line-height: 1.4;
    }
    .row-wrap.unread .title {
      font-weight: 600;
    }
    .sub {
      font-size: 13px;
      color: var(--color-text-soft);
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .meta {
      margin-top: 4px;
      font-size: 12px;
      color: var(--color-muted);
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .actor {
      font-weight: 500;
      color: var(--color-text-secondary);
    }
    .dot-sep {
      opacity: 0.6;
    }
  `],
})
export class NotificationsPanelComponent {
  readonly svc = inject(NotificationsService);
  private readonly router = inject(Router);

  /** Relative-time formatter. The dropdown re-derives on every render
   * by reading the current `Date.now()` via this computed. Fine for
   * human-perceptible "4d ago" granularity; we don't sub-second-
   * refresh. */
  readonly now = computed(() => Date.now());

  relative(iso: string): string {
    const then = new Date(iso).getTime();
    const diffSec = Math.max(1, Math.round((this.now() - then) / 1000));
    if (diffSec < 60) return 'just now';
    const min = Math.round(diffSec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  async onRowClick(item: NotificationItem): Promise<void> {
    await this.svc.markRead(item.id);
    if (item.ticketId !== null) {
      this.svc.closePanel();
      await this.router.navigate(['/tickets', item.ticketId]);
    }
  }

  async markAllRead(): Promise<void> {
    await this.svc.markAllRead();
  }
}