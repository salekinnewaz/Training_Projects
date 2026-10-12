/**
 * UsersTabPageComponent — HD-014.
 *
 * The /users route AND the Users tab content on /admin. Mounted
 * by both `app.routes.ts` (path: 'users') and
 * `AdminDashboardPageComponent`'s `users-placeholder` branch.
 *
 * Layout (per design-process/D-UX-Design/users-tab.md):
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  Users                                                   │
 *   │  6 users · 5 active · 1 inactive                          │
 *   │  ─────────────────────────────────────────────────────── │
 *   │  NAME      EMAIL         ROLE        STATUS   LAST ACTIVE│
 *   │  [avatar]  Eli Chen      [select]   ● Active  2d ago    │
 *   │  Avery     admin@ex.com  [select]   ● Active  just now   │  ← self row
 *   │  Sam Patel sam@ex.com    [select]   ● Active  3d ago     │
 *   │  ...                                                      │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Self-row protection:
 *   - The row whose `user.id === currentUser.id` renders with a
 *     3px primary left border, disabled role select, disabled
 *     status toggle, and a muted micro-label "You cannot change
 *     your own role." The server enforces the same constraint
 *     (defense in depth) — a direct API call to change own
 *     role/active returns 400.
 *
 * Inline action lifecycle:
 *   - Role change (non-demotion): dropdown selection → PATCH
 *     immediately, no dialog. On error: dropdown reverts, inline
 *     row error.
 *   - Role change (Admin → Support Agent / User): dialog "Demote
 *     <name> from Admin to <new role>? They will lose admin
 *     access immediately." Cancel reverts, Save Demote applies.
 *   - Active toggle (non-Admin target): click → PATCH immediately.
 *   - Active toggle (Admin target → inactive): dialog "Deactivate
 *     <name>? They will be logged out and unable to log in."
 *     Cancel reverts, Deactivate applies.
 *
 * Render states (mutually exclusive @switch):
 *   loading → heading + active-count + 5 row skeletons
 *   error   → inline error card + Retry
 *   success → the table
 *
 * Window focus refetches the list (mirrors admin-dashboard).
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { ApiError } from '../../services/api-error';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import type { UserPublic } from '../../models/user';
import type { UserRole } from '../../models/enums';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { DialogModalComponent } from '../../components/molecules/dialog-modal/dialog-modal.component';
import { UserRowComponent } from '../../components/molecules/user-row/user-row.component';

type RenderState = 'loading' | 'error' | 'success';

interface ConfirmContext {
  readonly kind: 'role-demote' | 'admin-deactivate';
  readonly user: UserPublic;
  readonly nextRole?: UserRole;
  readonly priorRole?: UserRole;
  readonly priorIsActive?: boolean;
}

const GENERIC_LOAD_ERROR = "Couldn't load users. Refresh to try again.";
const GENERIC_UPDATE_ERROR = "Couldn't update. Try again.";

@Component({
  selector: 'app-users-tab-page',
  standalone: true,
  imports: [
    AppChromeComponent,
    ButtonComponent,
    DialogModalComponent,
    UserRowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome>
      <section class="users-page">
        <header class="users-header">
          <h1>Users</h1>
          <p class="users-count">{{ activeCountLabel() }}</p>
        </header>

        @switch (renderState()) {
          @case ('loading') {
            <div class="users-table-wrap" aria-busy="true" aria-label="Loading users">
              <div class="users-table-header" aria-hidden="true">
                <span>NAME</span>
                <span>EMAIL</span>
                <span>ROLE</span>
                <span>STATUS</span>
                <span>LAST ACTIVE</span>
              </div>
              <ul class="users-table">
                @for (_ of skeletonArray(); track $index) {
                  <li class="user-row-skel" aria-hidden="true">
                    <div class="bar bar-avatar"></div>
                    <div class="bar bar-name"></div>
                    <div class="bar bar-email"></div>
                    <div class="bar bar-role"></div>
                    <div class="bar bar-status"></div>
                    <div class="bar bar-time"></div>
                  </li>
                }
              </ul>
            </div>
          }
          @case ('error') {
            <div class="users-error-card" role="alert">
              <p class="error-message">{{ errorMessage() }}</p>
              <atom-button variant="primary" size="md" (pressed)="onRefresh()">
                Retry
              </atom-button>
            </div>
          }
          @case ('success') {
            <div class="users-table-wrap">
              <div class="users-table-header" role="row">
                <span role="columnheader">NAME</span>
                <span role="columnheader">EMAIL</span>
                <span role="columnheader">ROLE</span>
                <span role="columnheader">STATUS</span>
                <span role="columnheader">LAST ACTIVE</span>
              </div>
              <ul class="users-table" role="rowgroup">
                @for (u of users(); track u.id) {
                  <user-row
                    [user]="u"
                    [isSelf]="u.id === currentUserId()"
                    [isUpdating]="isUpdating(u.id)"
                    [errorMessage]="rowError(u.id)"
                    [relativeTime]="formatRelative(u.lastActiveAt)"
                    (roleChange)="onRoleChange($event, u)"
                    (activeToggle)="onActiveToggle(u)"
                  />
                }
              </ul>
            </div>
          }
        }
      </section>
    </app-chrome>

    @if (confirmCtx(); as ctx) {
      <dialog-modal
        [headline]="confirmHeadline(ctx)"
        [cancelLabel]="'Cancel'"
        [confirmLabel]="confirmLabel(ctx)"
        (cancel)="onConfirmCancel()"
        (confirm)="onConfirmAccept()"
      />
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    /* All users-page rules (header, table chrome, row geometry,
       active toggle, self-row border, error card) are owned by
       styles.css. Mirrors the HD-011 / HD-012 / HD-013 pattern
       so this component's inline style budget stays under 2kB. */
  `],
})
export class UsersTabPageComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly renderState = signal<RenderState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly users = signal<UserPublic[]>([]);
  readonly updatingIds = signal<Set<number>>(new Set());
  readonly rowErrors = signal<Record<number, string>>({});
  readonly confirmCtx = signal<ConfirmContext | null>(null);

  /**
   * The current user's id. Used to compute `isSelf` for each row.
   * Reads from `authService.userSnapshot()`; null on cold load
   * means the auth bootstrap hasn't completed yet — in that case
   * no row is treated as self (defensive: the roleGuard on /users
   * requires Admin login, so the snapshot is always populated by
   * the time this page renders in normal flow).
   */
  readonly currentUserId = computed<number | null>(
    () => this.authService.userSnapshot()?.id ?? null,
  );

  /**
   * The "N users · N active · N inactive" micro-label. Only
   * meaningful in success state; the skeleton / error renders
   * don't display a count.
   */
  readonly activeCountLabel = computed(() => {
    const list = this.users();
    const total = list.length;
    const active = list.filter((u) => u.isActive).length;
    const inactive = total - active;
    return `${total} users · ${active} active · ${inactive} inactive`;
  });

  ngOnInit(): void {
    void this.load();
  }

  /**
   * Refetch on window focus (mirrors admin-dashboard). When the
   * Admin comes back to the tab after reviewing a ticket detail
   * page, the row list reflects any external changes.
   */
  @HostListener('window:focus')
  onWindowFocus(): void {
    if (this.renderState() === 'success') {
      void this.load();
    }
  }

  onRefresh(): void {
    void this.load();
  }

  /**
   * Role dropdown change handler. Decides whether the change
   * needs a confirmation dialog (Admin-demote) or can be
   * applied immediately. Self-row controls are disabled by the
   * molecule, so this handler only fires for non-self rows.
   */
  onRoleChange(nextRole: UserRole, user: UserPublic): void {
    if (user.role === nextRole) return;
    const isAdminDemote =
      user.role === 'Admin' && nextRole !== 'Admin';
    if (isAdminDemote) {
      this.confirmCtx.set({
        kind: 'role-demote',
        user,
        nextRole,
        priorRole: user.role,
      });
      return;
    }
    void this.applyRoleChange(user, nextRole);
  }

  /**
   * Status toggle click handler. Decides whether the toggle
   * needs a confirmation dialog (Admin-deactivate) or can be
   * applied immediately.
   */
  onActiveToggle(user: UserPublic): void {
    if (!user.isActive) {
      // Re-activating is never destructive — apply immediately.
      void this.applyActiveChange(user, true);
      return;
    }
    if (user.role === 'Admin') {
      // Deactivating an Admin is destructive — confirm.
      this.confirmCtx.set({
        kind: 'admin-deactivate',
        user,
        priorIsActive: user.isActive,
      });
      return;
    }
    void this.applyActiveChange(user, false);
  }

  onConfirmCancel(): void {
    // Drop the dialog. The molecule's atom-select is bound to
    // `user().role` via the [value] input, so reverting the
    // signal value (which we don't do here — the signal is
    // unchanged because we never optimistically applied the
    // change) keeps the dropdown showing the prior role.
    this.confirmCtx.set(null);
  }

  onConfirmAccept(): void {
    const ctx = this.confirmCtx();
    if (!ctx) return;
    this.confirmCtx.set(null);
    if (ctx.kind === 'role-demote' && ctx.nextRole) {
      void this.applyRoleChange(ctx.user, ctx.nextRole);
    } else if (ctx.kind === 'admin-deactivate') {
      void this.applyActiveChange(ctx.user, false);
    }
  }

  isUpdating(id: number): boolean {
    return this.updatingIds().has(id);
  }

  rowError(id: number): string | null {
    return this.rowErrors()[id] ?? null;
  }

  confirmHeadline(ctx: ConfirmContext): string {
    if (ctx.kind === 'role-demote' && ctx.nextRole) {
      return `Demote ${ctx.user.displayName} from Admin to ${ctx.nextRole}? They will lose admin access immediately.`;
    }
    return `Deactivate ${ctx.user.displayName}? They will be logged out and unable to log in.`;
  }

  confirmLabel(ctx: ConfirmContext): string {
    return ctx.kind === 'role-demote' ? 'Demote' : 'Deactivate';
  }

  /**
   * `formatRelative(iso)` — shared with admin-dashboard-page
   * (and 3 other pages in the codebase). Per the deferred-work
   * note D1/D2/etc., the duplication is intentional for MVP;
   * refactor to a shared util is a separate slice. The local
   * copy here supports the HD-014 Last-active column. The
   * parameter is the `lastActiveAt` ISO string from UserPublic
   * (or null — we render "Never" in the template via the
   * `relativeTime()` input).
   */
  formatRelative(iso: string | null): string | null {
    if (iso === null) return null;
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

  /**
   * 5-element placeholder array for the loading skeleton (5 rows
   * per the design doc's MVP team size). Mirrors the
   * `loading-skeleton.rowArray()` pattern.
   */
  skeletonArray(): unknown[] {
    return new Array(5);
  }

  private async load(): Promise<void> {
    this.renderState.set('loading');
    this.errorMessage.set(null);
    try {
      const data = await this.userService.listAll();
      this.users.set(data);
      this.renderState.set('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Auth interceptor will redirect to /login; leave the page
        // in loading state (mirrors admin-dashboard behavior).
        return;
      }
      this.errorMessage.set(GENERIC_LOAD_ERROR);
      this.renderState.set('error');
    }
  }

  private async applyRoleChange(
    user: UserPublic,
    nextRole: UserRole,
  ): Promise<void> {
    this.markUpdating(user.id, true);
    this.clearRowError(user.id);
    try {
      const updated = await this.userService.updateRole(user.id, nextRole);
      this.patchUser(updated);
    } catch {
      this.setRowError(user.id, GENERIC_UPDATE_ERROR);
    } finally {
      this.markUpdating(user.id, false);
    }
  }

  private async applyActiveChange(
    user: UserPublic,
    isActive: boolean,
  ): Promise<void> {
    this.markUpdating(user.id, true);
    this.clearRowError(user.id);
    try {
      const updated = await this.userService.updateActive(user.id, isActive);
      this.patchUser(updated);
    } catch {
      this.setRowError(user.id, GENERIC_UPDATE_ERROR);
    } finally {
      this.markUpdating(user.id, false);
    }
  }

  private patchUser(updated: UserPublic): void {
    this.users.update((list) =>
      list.map((u) => (u.id === updated.id ? updated : u)),
    );
  }

  private markUpdating(id: number, value: boolean): void {
    this.updatingIds.update((set) => {
      const next = new Set(set);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private setRowError(id: number, message: string): void {
    this.rowErrors.update((map) => ({ ...map, [id]: message }));
  }

  private clearRowError(id: number): void {
    this.rowErrors.update((map) => {
      if (!(id in map)) return map;
      const next = { ...map };
      delete next[id];
      return next;
    });
  }
}
