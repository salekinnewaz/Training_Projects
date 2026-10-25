/**
 * UsersTabPageComponent — HD-014 + admin redesign.
 *
 * This is a PURE CONTENT component: it renders the users list and
 * nothing else. It deliberately does NOT wrap itself in
 * `<app-chrome>` and does NOT render its own `<h1>`.
 *
 * WHY
 * ───
 * The component is mounted in TWO places:
 *
 *   1. The standalone `/users` route.
 *   2. The Users tab on `/admin` (as `<app-users-tab-page />`).
 *
 * When it rendered its own `<app-chrome>` (which itself renders
 * `<header-chrome>`) AND its own `<h1>Users</h1>`, mounting it
 * inside the Admin dashboard produced:
 *
 *   - 2× the header chrome strip (brand, nav, bell, profile)
 *   - 2× the "Users" `<h1>` (the dashboard's own heading + the
 *     component's heading)
 *   - 2× the nav links, because the dashboard ALSO renders a
 *     "Tickets | Users" tab switcher next to its heading, and
 *     the chrome renders "Tickets | Users" too.
 *
 * The fix is to let the HOST own the chrome and the heading, and
 * keep this component focused on the list. The standalone route
 * gets a thin shell component that supplies the chrome + heading
 * (see `users-page-shell.component.ts`); the Admin dashboard
 * supplies its own.
 *
 * LAYOUT (Option A — "Command Center")
 * ────────────────────────────────────
 *   ┌────────────────────────────────────────────────────────┐
 *   │ [8 Total] [7 Active] [1 Inactive] [1 Admins] [3 Agents]│
 *   │ [ Search… ]  [All][Employee][Support Agent][Admin]     │
 *   │ ────────────────────────────────────────────────────── │
 *   │ USER                  ROLE      STATUS  TICKETS  LAST…  │
 *   │ [AP] Avery Patel      [Admin]  ● Active     12  2m ago  │
 *   │      admin@company.com                                  │
 *   └────────────────────────────────────────────────────────┘
 *
 * The identity is ONE cell — avatar, name and email stacked — so
 * the table reads as a roster rather than a spreadsheet, and the
 * reclaimed width goes to the Tickets column (the workload signal
 * an Admin actually scans for).
 *
 * The role is shown as a coloured BADGE (reusing the existing
 * `<badge-role>` atom) rather than as a bare dropdown, so the
 * list is scannable at a glance. The role dropdown stays
 * available on the row — it is the same control, styled to
 * read as a badge-backed select.
 *
 * Inline action lifecycle (unchanged from HD-014):
 *   - Role change (non-demotion): dropdown selection → PATCH
 *     immediately, no dialog. On error: dropdown reverts, inline
 *     row error.
 *   - Role change (Admin → Support Agent / User): dialog
 *     "Demote <name> from Admin to <new role>? They will lose
 *     admin access immediately." Cancel reverts, Save applies.
 *   - Active toggle (non-Admin target): click → PATCH immediately.
 *   - Active toggle (Admin target → inactive): dialog
 *     "Deactivate <name>? They will be logged out and unable to
 *     log in." Cancel reverts, Deactivate applies.
 *
 * Render states (mutually exclusive @switch):
 *   loading → stat skeleton + row skeletons
 *   error   → inline error card + Retry
 *   success → the stat row + toolbar + table
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
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { DialogModalComponent } from '../../components/molecules/dialog-modal/dialog-modal.component';
import { UserRowComponent } from '../../components/molecules/user-row/user-row.component';

type RenderState = 'loading' | 'error' | 'success';

/** The role filter's sentinel value — "no filter", not a real role. */
const ALL_ROLES = 'all';

type RoleFilter = typeof ALL_ROLES | UserRole;

interface ConfirmContext {
  readonly kind: 'role-demote' | 'admin-deactivate';
  readonly user: UserPublic;
  readonly nextRole?: UserRole;
  readonly priorRole?: UserRole;
  readonly priorIsActive?: boolean;
}

const GENERIC_LOAD_ERROR = "Couldn't load users. Refresh to try again.";
const GENERIC_UPDATE_ERROR = "Couldn't update. Try again.";

/**
 * Turns a role value into a `data-testid`-friendly slug.
 *
 * The raw role contains a space ("Support Agent"), which makes
 * attribute selectors awkward (`[data-testid="role-filter-Support
 * Agent"]`). The slug keeps the testid readable AND selectable.
 */
function slugifyRole(role: string): string {
  return role.toLowerCase().replace(/\s+/g, '-');
}

@Component({
  selector: 'app-users-tab-page',
  standalone: true,
  imports: [ButtonComponent, DialogModalComponent, UserRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="users-page">
      @switch (renderState()) {
        @case ('loading') {
          <div class="users-stat-row" aria-hidden="true">
            @for (_ of skeletonArray(); track $index) {
              <div class="stat-card stat-card--skel">
                <div class="bar bar-stat-value"></div>
                <div class="bar bar-stat-label"></div>
              </div>
            }
          </div>
          <div class="users-table-wrap" aria-busy="true" aria-label="Loading users">
            <div class="users-table-header" aria-hidden="true">
              <span>USER</span>
              <span>ROLE</span>
              <span>STATUS</span>
              <span>TICKETS</span>
              <span>LAST ACTIVE</span>
              <span></span>
            </div>
            <ul class="users-table">
              @for (_ of skeletonArray(); track $index) {
                <li class="user-row-skel" aria-hidden="true">
                  <div class="bar bar-avatar"></div>
                  <div class="bar bar-name"></div>
                  <div class="bar bar-role"></div>
                  <div class="bar bar-status"></div>
                  <div class="bar bar-tickets"></div>
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
          <!-- ── Stat summary row ──────────────────────────────
               Five at-a-glance counts. Each card is a filter
               shortcut: clicking "Agents" filters the table to
               Support Agents. The active filter is reflected on
               the card itself, so the current view is always
               obvious. -->
          <div class="users-stat-row" data-testid="users-stat-row">
            @for (card of statCards(); track card.key) {
              <button
                type="button"
                class="stat-card"
                [class.stat-card--ok]="card.tone === 'ok'"
                [class.stat-card--off]="card.tone === 'off'"
                [class.stat-card--adm]="card.tone === 'adm'"
                [class.stat-card--agt]="card.tone === 'agt'"
                [class.stat-card--active]="isFilterActive(card.filter)"
                [attr.data-testid]="'stat-' + card.key"
                [attr.aria-pressed]="isFilterActive(card.filter)"
                (click)="toggleRoleFilter(card.filter)"
              >
                <span class="stat-card__value">{{ card.value }}</span>
                <span class="stat-card__label">{{ card.label }}</span>
              </button>
            }
          </div>

          <!-- ── Toolbar: search + role filter ────────────────── -->
          <div class="users-toolbar">
            <div class="users-search">
              <span class="users-search__icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="15" height="15" focusable="false">
                  <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6" />
                  <path d="M11 11 L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
              </span>
              <input
                type="search"
                class="users-search__input"
                placeholder="Search by name or email…"
                [value]="searchQuery()"
                (input)="onSearchInput($event)"
                aria-label="Search users by name or email"
                data-testid="users-search"
              />
            </div>

            <div class="users-filter-group" role="group" aria-label="Filter by role">
              @for (opt of roleFilterOptions; track opt.value) {
                <button
                  type="button"
                  class="filter-chip"
                  [class.filter-chip--active]="roleFilter() === opt.value"
                  [attr.aria-pressed]="roleFilter() === opt.value"
                  [attr.data-testid]="'role-filter-' + slugifyRole(opt.value)"
                  (click)="setRoleFilter(opt.value)"
                >
                  {{ opt.label }}
                </button>
              }
            </div>
          </div>

          <!-- ── Table ─────────────────────────────────────────── -->
          @if (filteredUsers().length === 0) {
            <div class="users-empty" data-testid="users-empty">
              <p class="users-empty__title">No users match</p>
              <p class="users-empty__body">
                Try a different search term or clear the role filter.
              </p>
              <atom-button variant="secondary" size="md" (pressed)="clearFilters()">
                Clear filters
              </atom-button>
            </div>
          } @else {
            <div class="users-table-wrap">
              <div class="users-table-header" role="row">
                <span role="columnheader">USER</span>
                <span role="columnheader">ROLE</span>
                <span role="columnheader">STATUS</span>
                <span role="columnheader">TICKETS</span>
                <span role="columnheader">LAST ACTIVE</span>
                <span role="columnheader"></span>
              </div>
              <ul class="users-table" role="rowgroup">
                @for (u of filteredUsers(); track u.id) {
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
      }
    </section>

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
    /* All users-page rules (stat row, toolbar, table chrome, row
       geometry, active toggle, self-row border, error card, empty
       state) are owned by styles.css. Mirrors the HD-011 / HD-012 /
       HD-013 pattern so this component's inline style budget stays
       under 2kB. */
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

  /** The live search term. Bound to the toolbar's search input. */
  readonly searchQuery = signal('');

  /** The live role filter. `ALL_ROLES` means "no filter". */
  readonly roleFilter = signal<RoleFilter>(ALL_ROLES);

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

  /**
   * The role filter's chip options. `All roles` is the no-filter
   * sentinel; the three real roles follow.
   */
  readonly roleFilterOptions: { value: RoleFilter; label: string }[] = [
    { value: ALL_ROLES, label: 'All roles' },
    { value: 'User', label: 'Employee' },
    { value: 'Support Agent', label: 'Support Agent' },
    { value: 'Admin', label: 'Admin' },
  ];

  /** Exposed to the template so each filter chip gets a slugified
   *  `data-testid` (the raw role contains a space). */
  readonly slugifyRole = slugifyRole;

  /**
   * The five stat cards. Each carries the counts for the whole
   * team (not the filtered view) so the summary stays stable
   * while the Admin narrows the list — the filtered count is
   * reported separately in the toolbar.
   */
  readonly statCards = computed<{
    key: string;
    label: string;
    value: number;
    filter: RoleFilter | 'none' | 'active' | 'inactive';
    /**
     * The colour accent for the tile's number. Option A colours
     * the value so each tile reads at a glance: green = healthy,
     * grey = inactive, amber = Admin, indigo = Support Agent.
     */
    tone: 'plain' | 'ok' | 'off' | 'adm' | 'agt';
  }[]>(() => {
    const list = this.users();
    return [
      {
        key: 'total',
        label: 'Total users',
        value: list.length,
        filter: 'none',
        tone: 'plain',
      },
      {
        key: 'active',
        label: 'Active',
        value: list.filter((u) => u.isActive).length,
        filter: 'active',
        tone: 'ok',
      },
      {
        key: 'inactive',
        label: 'Inactive',
        value: list.filter((u) => !u.isActive).length,
        filter: 'inactive',
        tone: 'off',
      },
      {
        key: 'admins',
        label: 'Admins',
        value: list.filter((u) => u.role === 'Admin').length,
        filter: 'Admin',
        tone: 'adm',
      },
      {
        key: 'agents',
        label: 'Support agents',
        value: list.filter((u) => u.role === 'Support Agent').length,
        filter: 'Support Agent',
        tone: 'agt',
      },
    ];
  });

  /**
   * The rows actually rendered: the user's list narrowed by the
   * search term and the role filter.
   *
   * The search matches display name OR email, case-insensitively.
   */
  readonly filteredUsers = computed(() => {
    const list = this.users();
    const q = this.searchQuery().trim().toLowerCase();
    const role = this.roleFilter();

    return list.filter((u) => {
      if (role !== ALL_ROLES && u.role !== role) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
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

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  /**
   * Set the role filter. Clicking the already-active role chip
   * clears the filter (toggles back to "All roles") so the chip
   * behaves like a toggle — matching the stat cards. Clicking a
   * different chip switches to it.
   */
  setRoleFilter(role: RoleFilter): void {
    if (role === ALL_ROLES) {
      this.roleFilter.set(ALL_ROLES);
      return;
    }
    this.roleFilter.set(this.roleFilter() === role ? ALL_ROLES : role);
  }

  /**
   * The stat cards act as filter shortcuts. Clicking a card
   * toggles the matching role filter on and off; clicking the
   * "Total users" card clears every filter.
   */
  toggleRoleFilter(filter: RoleFilter | 'none' | 'active' | 'inactive'): void {
    if (filter === 'none') {
      this.roleFilter.set(ALL_ROLES);
      return;
    }
    if (filter === 'active' || filter === 'inactive') {
      // Status filters are not part of the role filter, so the
      // card simply clears the role filter and leaves the status
      // narrowing to the table itself. Clicking it again is a
      // no-op — the cards are role shortcuts, not status filters.
      this.roleFilter.set(ALL_ROLES);
      return;
    }
    this.roleFilter.set(this.roleFilter() === filter ? ALL_ROLES : filter);
  }

  /**
   * Whether a stat card's filter is currently applied. Only the
   * role cards can be "active"; the count cards are informational.
   */
  isFilterActive(filter: RoleFilter | 'none' | 'active' | 'inactive'): boolean {
    if (filter === 'none' || filter === 'active' || filter === 'inactive') {
      return false;
    }
    return this.roleFilter() === filter;
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.roleFilter.set(ALL_ROLES);
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
      list.map((u) =>
        u.id === updated.id
          ? {
              ...updated,
              // The single-user endpoints (PUT role / PUT status)
              // don't compute the ticket count — they send `0`.
              // Overwriting the real count with 0 would make the
              // Tickets column flicker to zero after every role
              // change, so we keep the count we already had.
              ticketCount: updated.ticketCount || u.ticketCount,
            }
          : u,
      ),
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
