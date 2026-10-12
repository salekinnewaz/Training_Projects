/**
 * user-row — molecule (HD-014).
 *
 * One row in the Admin Users table. Renders per the design spec:
 *   avatar + display name | email | role select | status toggle | last active
 *
 * Interaction model:
 *   - Non-self rows: role `<atom-select>` + status toggle button are
 *     active. Changes emit `roleChange` / `activeToggle` events; the
 *     parent page decides whether to apply immediately or open a
 *     confirmation dialog (Admin-demote / Admin-deactivate).
 *   - Self rows (the Admin viewing the page): both controls render
 *     disabled, with a 3px primary left border on the row + a muted
 *     micro-label below the row that reads "You cannot change your
 *     own role." The parent page sets `isSelf=true` based on a
 *     `currentUser.id === user.id` comparison.
 *   - Per-row update state: `isUpdating` greys the controls and
 *     emits no events while a request is in flight. `errorMessage`
 *     renders an inline row error below the row.
 *
 * The component owns the row markup only — all row geometry
 * (64px height, hover tint, border-bottom, self-row left border,
 * last-active column right-align) is owned by `styles.css`
 * (mirrors the HD-013 / HD-011 / HD-012 pattern of pushing heavy
 * rules to global so the page component's inline style budget
 * holds under 2kB).
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import type { UserPublic } from '../../../models/user';
import type { UserRole } from '../../../models/enums';
import { ChromeAvatarComponent } from '../../atoms/chrome-avatar/chrome-avatar.component';
import { SelectComponent } from '../../atoms/select/select.component';
import type { SelectOption } from '../../atoms/select/select.component';

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'User', label: 'User' },
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
      <div class="user-row__name">
        <chrome-avatar
          [displayName]="user().displayName"
          [size]="32"
        />
        <span class="user-row__display-name">{{ user().displayName }}</span>
      </div>
      <div class="user-row__email">{{ user().email }}</div>
      <div class="user-row__role">
        <atom-select
          [id]="roleSelectId()"
          [value]="user().role"
          [options]="roleOptions"
          [disabled]="isSelf() || isUpdating()"
          (valueChange)="onRoleChange($event)"
        />
      </div>
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
      <div class="user-row__last-active">
        @if (user().lastActiveAt !== null && user().lastActiveAt !== undefined) {
          <time [attr.datetime]="user().lastActiveAt">
            {{ formattedLastActive() }}
          </time>
        } @else {
          <span class="user-row__never">Never</span>
        }
      </div>
      @if (isSelf()) {
        <p class="user-row__self-micro-label">
          You cannot change your own role.
        </p>
      }
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
  readonly user = input.required<UserPublic>();
  readonly isSelf = input<boolean>(false);
  readonly isUpdating = input<boolean>(false);
  readonly errorMessage = input<string | null>(null);
  readonly relativeTime = input<string | null>(null);

  readonly roleChange = output<UserRole>();
  readonly activeToggle = output<void>();

  readonly roleOptions = ROLE_OPTIONS;

  /**
   * The role select needs a unique DOM id for label / aria
   * wiring. Deterministic per user id so test selectors stay
   * stable.
   */
  readonly roleSelectId = computed(() => `user-row-role-${this.user().id}`);

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
    this.activeToggle.emit();
  }
}
