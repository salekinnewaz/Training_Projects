/**
 * user-row — molecule (HD-014), Option A "Command Center" layout.
 *
 * One row in the Admin Users table:
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ [AP] Avery Patel          [Admin ▾]   ● Active   12   2m ago  │
 *   │      admin@company.com                                     [⋯] │
 *   └────────────────────────────────────────────────────────────────┘
 *      #  USER            ROLE     STATUS    LAST ACTIVE    JOINED   ACTIONS
 *
 * WHY THE IDENTITY IS ONE CELL
 * ────────────────────────────
 * The previous layout had NAME and EMAIL as two separate columns.
 * That split the identity in half and forced a very wide grid
 * (220px + 280px) to fit a display name, so the table read as a
 * spreadsheet rather than a roster. Option A stacks the name and
 * email in ONE cell under a single avatar — the way a directory
 * entry should look — and spends the reclaimed width on the
 * Tickets column, which is the actual signal the Admin wants.
 *
 * Interaction model (unchanged from HD-014):
 *   - Non-self rows: role `<atom-select>` + status toggle button are
 *     active. Changes emit `roleChange` / `activeToggle` events; the
 *     parent page decides whether to apply immediately or open a
 *     confirmation dialog (Admin-demote / Admin-deactivate).
 *   - Self rows (the Admin viewing the page): both controls render
 *     disabled, with a 3px primary left border on the row + a "You"
 *     tag next to the name. The parent page sets `isSelf=true` based
 *     on a `currentUser.id === user.id` comparison.
 *   - Per-row update state: `isUpdating` greys the controls and
 *     emits no events while a request is in flight. `errorMessage`
 *     renders an inline row error.
 *
 * The component owns the row markup only — all row geometry
 * (min-height, hover tint, border-bottom, self-row left border,
 * column widths, hover-revealed action column) is owned by
 * `styles.css` (mirrors the HD-013 / HD-011 / HD-012 pattern of
 * pushing heavy rules to global so the page component's inline
 * style budget holds under 2kB).
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import type { UserPublic } from '../../../models/user';
import type { UserRole } from '../../../models/enums';
import { ChromeAvatarComponent } from '../../atoms/chrome-avatar/chrome-avatar.component';
import { SelectComponent } from '../../atoms/select/select.component';
import type { SelectOption } from '../../atoms/select/select.component';

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'User', label: 'Employee' },
  { value: 'Support Agent', label: 'Support Agent' },
  { value: 'Admin', label: 'Admin' },
];

@Component({
  selector: 'user-row',
  standalone: true,
  imports: [ChromeAvatarComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <li
      class="user-row"
      [class.user-row--self]="isSelf()"
      [class.user-row--updating]="isUpdating()"
      [attr.data-user-id]="user().id"
    >
      <span class="user-row__number">{{ rowNumber() }}</span>
      <!-- ── Identity: avatar + name + email, stacked ──────────── -->
      <div class="user-row__identity">
        <chrome-avatar
          [displayName]="user().displayName"
          [size]="36"
          [style.--color-disabled]="avatarTone()"
          [style.color]="avatarInk()"
        />
        <span class="user-row__identity-text">
          <span class="user-row__name">
            <span class="user-row__display-name">{{ user().displayName }}</span>
            @if (isSelf()) {
              <span class="user-row__you-tag" title="You cannot change your own role">You</span>
            }
          </span>
          <span class="user-row__email">{{ user().email }}</span>
        </span>
      </div>

      <!-- ── Role: badge (the read) + select (the control) ─────── -->
      <div
        class="user-row__role"
        [class.user-row__role--admin]="user().role === 'Admin'"
        [class.user-row__role--agent]="user().role === 'Support Agent'"
        [class.user-row__role--employee]="user().role === 'User'"
      >
        <atom-select
          [id]="roleSelectId()"
          [value]="user().role"
          [options]="roleOptions"
          [compact]="true"
          [disabled]="isSelf() || isUpdating()"
          [attr.aria-label]="'Role for ' + user().displayName"
          (valueChange)="onRoleChange($event)"
        />
      </div>

      <!-- ── Status ─────────────────────────────────────────────── -->
      <div class="user-row__status">
        <button
          type="button"
          class="user-row__active-toggle"
          [class.is-active]="user().isActive"
          [class.is-inactive]="!user().isActive"
          [disabled]="isSelf() || isUpdating()"
          [attr.aria-label]="activeAriaLabel()"
          (click)="onToggleClick()"
        >
          <span
            class="user-row__active-dot"
            [attr.aria-hidden]="true"
          ></span>
          <span class="user-row__active-text">
            {{ user().isActive ? 'Active' : 'Inactive' }}
          </span>
        </button>
      </div>

      <!-- ── Last active ────────────────────────────────────────── -->
      <div class="user-row__last-active">
        @if (user().lastActiveAt) {
          <span
            class="user-row__activity-dot"
            [class.user-row__activity-dot--inactive]="!user().isActive"
            aria-hidden="true"
          ></span>
          <time [attr.datetime]="user().lastActiveAt">
            {{ formattedLastActive() }}
          </time>
        } @else {
          <span class="user-row__never">Never</span>
        }
      </div>

      <!-- ── Joined ─────────────────────────────────────────────── -->
      <div class="user-row__joined">
        <time [attr.datetime]="user().createdAt">{{ formattedJoined() }}</time>
      </div>

      <!-- ── Actions (hover-revealed) ───────────────────────────── -->
      <div class="user-row__actions">
        <button
          type="button"
          class="user-row__actions-trigger"
          [attr.aria-label]="'Actions for ' + user().displayName"
          [attr.aria-expanded]="actionsOpen()"
          [attr.aria-controls]="'user-actions-' + user().id"
          (click)="toggleActions($event)"
        >
          <span aria-hidden="true">•••</span>
        </button>
        @if (actionsOpen()) {
          <div class="user-row__actions-menu" role="menu" [id]="'user-actions-' + user().id">
            @if (isSelf()) {
              <span class="user-row__actions-note" role="menuitem" aria-disabled="true">
                You cannot change your own account
              </span>
            } @else {
              <button
                type="button"
                role="menuitem"
                [disabled]="isUpdating()"
                (click)="onToggleClick()"
              >
                {{ user().isActive ? 'Deactivate user' : 'Activate user' }}
              </button>
            }
          </div>
        }
      </div>

      @if (errorMessage(); as err) {
        <p class="user-row__error" role="alert">{{ err }}</p>
      }
    </li>
  `,
  styles: [`
    :host {
      display: contents;
    }
  `],
})
export class UserRowComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly user = input.required<UserPublic>();
  readonly isSelf = input<boolean>(false);
  readonly isUpdating = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly relativeTime = input<string | null>(null);
  readonly rowNumber = input(0);
  readonly actionsOpen = signal(false);

  readonly roleChange = output<UserRole>();
  readonly activeToggle = output<void>();

  readonly roleOptions = ROLE_OPTIONS;

  /**
   * The role select needs a unique DOM id for label / aria
   * wiring. Deterministic per user id so test selectors stay
   * stable.
   */
  readonly roleSelectId = computed(() => `user-row-role-${this.user().id}`);

  readonly avatarTone = computed(() => {
    const tones = ['#86d5e9', '#c6d4ff', '#f2c3d4', '#9fe3cd', '#c6b5ff', '#ffd485', '#a8d8e7', '#bac6d8'];
    return tones[this.user().id % tones.length] ?? tones[0];
  });
  readonly avatarInk = computed(() => this.user().id % 2 === 0 ? '#183f65' : '#154959');

  readonly activeAriaLabel = computed(() =>
    this.user().isActive
      ? `Deactivate ${this.user().displayName}`
      : `Activate ${this.user().displayName}`,
  );

  /**
   * Pre-formatted relative time for `user().lastActiveAt`. The page
   * passes a pre-formatted string via the `relativeTime` input when
   * it wants to override (e.g. during a refetch the user is in a
   * different timezone), but by default we format here so the row
   * works in isolation (molecule spec, storybook snapshots).
   */
  readonly formattedLastActive = computed(() => {
    const override = this.relativeTime();
    if (override !== null) return override;
    const iso = this.user().lastActiveAt;
    if (!iso) return null;
    return UserRowComponent.formatRelative(iso);
  });

  readonly formattedJoined = computed(() => {
    const date = new Date(this.user().createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(date);
  });

  onRoleChange(value: string): void {
    if (value !== 'User' && value !== 'Support Agent' && value !== 'Admin') {
      return;
    }
    // Guard: <atom-select> emits on every native change event,
    // including when the new value equals the current. Skip so the
    // page doesn't fire a no-op update request.
    if (value === this.user().role) {
      return;
    }
    this.roleChange.emit(value);
  }

  /**
   * Per-row "Xm ago" / "Xh ago" / ... formatter. Copied from the
   * admin-dashboard page (HD-013) so each row renders an
   * independently-formatted timestamp without the page wiring
   * `relativeTime` for every row. If/when this gets refactored to
   * a shared util, both call sites collapse to the import.
   */
  private static formatRelative(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.floor((Date.now() - then) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  }

  onToggleClick(): void {
    this.actionsOpen.set(false);
    this.activeToggle.emit();
  }

  toggleActions(event: MouseEvent): void {
    event.stopPropagation();
    this.actionsOpen.update((open) => !open);
  }

  @HostListener('document:click', ['$event'])
  closeActionsOnOutsideClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.actionsOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeActionsOnEscape(): void {
    this.actionsOpen.set(false);
  }
}
