/**
 * header-chrome — molecule (HD-004 + HD-018 + WDS-2026).
 *
 * The persistent chrome strip rendered above every post-login
 * page. Four regions per the WDS wireframe (mockups/02-user-dashboard.html
 * line 33-72, mockups/04-agent-kanban.html line 216-229, and
 * DESIGN.md §"Top Bar"):
 *
 *   1. Brand mark + wordmark (left) — 28×28 mark, focusable button
 *      that routes to the role-correct dashboard via
 *      AuthService.roleHomePath().
 *   2. Nav links (left, after brand) — "Tickets" (always visible)
 *      and "Users" (admin only). Active route gets the brand color
 *      + tinted background (routerLinkActive). Tickets links to
 *      the role-correct tickets landing (`roleHomePath()` for the
 *      current role, i.e. /dashboard for users, /tickets for
 *      agents and admins — see `ticketsLink()` below).
 *   3. Search input (center, agent/admin only) — debounced 200ms
 *      search across ID, title, and description. Out-of-scope for
 *      the user role per EXPERIENCE.md line 153.
 *   4. Profile trigger (right) — avatar + name + caret. Toggles a
 *      dropdown-panel containing the user header (avatar, name,
 *      role badge), a divider, a "View profile" entry (D114 →
 *      /profile), another divider, a "Change password" entry
 *      (HD-018 → /profile/password), another divider, and the
 *      "Log out" action.
 *
 * Clicking "Log out" opens a dialog-modal confirmation; on confirm,
 * AuthService.logout() runs and the user is redirected to /login.
 *
 * Keyboard / focus:
 *   - Esc closes the dialog first, then the dropdown.
 *   - Click outside the trigger AND outside the dropdown closes
 *     the dropdown.
 *
 * The search input is a controlled component — the parent (app
 * shell) is responsible for routing a search query to the
 * appropriate page. To keep the header self-contained for MVP,
 * pressing Enter in the search box routes to
 * `/search?q=…` and updates the URL. The list/search/filter
 * pages can read the `q` queryParam from the snapshot.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../services/auth.service';
import { ApiError } from '../../../services/api-error';
import { NotificationsService } from '../../../services/notifications.service';
import { BadgeRoleComponent } from '../../atoms/badge-role/badge-role.component';
import { CaretDownComponent } from '../../atoms/caret-down/caret-down.component';
import { ChromeAvatarComponent } from '../../atoms/chrome-avatar/chrome-avatar.component';
import { DividerHrComponent } from '../../atoms/divider-hr/divider-hr.component';
import { DialogModalComponent } from '../dialog-modal/dialog-modal.component';
import { DropdownPanelComponent } from '../dropdown-panel/dropdown-panel.component';
import { NotificationsPanelComponent } from '../notifications-panel/notifications-panel.component';

@Component({
  selector: 'header-chrome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    BadgeRoleComponent,
    CaretDownComponent,
    ChromeAvatarComponent,
    DialogModalComponent,
    DividerHrComponent,
    DropdownPanelComponent,
    NotificationsPanelComponent,
  ],
  template: `
    <header class="chrome" role="banner">
      <button
        type="button"
        class="brand"
        (click)="goHome()"
        aria-label="HelpDesk Lite — go to your dashboard"
      >
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
            <path d="M21 14a2 2 0 0 1-2 2h-1v-4h1a2 2 0 0 1 2 2z" fill="currentColor" stroke="none" />
            <path d="M3 14a2 2 0 0 1 2-2h1v4H5a2 2 0 0 1-2-2z" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span class="brand-wordmark">HelpDesk Lite</span>
      </button>

      @if (user(); as u) {
        <nav class="chrome-nav" aria-label="Primary">
          <a
            class="nav-link"
            [routerLink]="ticketsLink()"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: false }"
          >Tickets</a>
          @if (isAdmin()) {
            <a
              class="nav-link"
              routerLink="/users"
              routerLinkActive="active"
            >Users</a>
          }
        </nav>

        @if (canSearch()) {
          <form class="chrome-search" (submit)="onSearchSubmit($event)">
            <span class="search-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
                <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5" />
                <path d="M11 11 L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </span>
            <input
              #searchInput
              type="search"
              class="search-input"
              placeholder="Search by ID, title, or description"
              [value]="searchValue()"
              (input)="onSearchInput($event)"
              aria-label="Search tickets"
            />
            <kbd class="search-shortcut" aria-hidden="true">⌘K</kbd>
          </form>
        } @else {
          <div class="chrome-search-spacer"></div>
        }

        <button
          #notifTrigger
          type="button"
          class="notification-trigger"
          (click)="onNotificationClick()"
          [attr.aria-label]="notificationLabel()"
          [attr.aria-expanded]="notifications.panelOpen()"
          aria-haspopup="menu"
          aria-controls="notifications-menu"
          data-testid="notification-bell"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 9 a5 5 0 0 1 10 0 v3.5 l1.5 2 H3.5 l1.5 -2 z" />
            <path d="M8 16 a2 2 0 0 0 4 0" />
          </svg>
          @if (hasUnreadNotifications()) {
            <span class="notification-dot" aria-hidden="true"></span>
          }
        </button>

        @if (notifications.panelOpen() && notifTrigger) {
          <dropdown-panel
            id="notifications-menu"
            [anchor]="notifTrigger"
          >
            <notifications-panel />
          </dropdown-panel>
        }

        <button
          #trigger
          type="button"
          class="profile-trigger"
          (click)="toggleDropdown()"
          [attr.aria-expanded]="dropdownOpen()"
          aria-haspopup="menu"
          aria-controls="profile-menu"
        >
          <chrome-avatar [displayName]="u.displayName" [size]="28" />
          <span class="profile-name">{{ u.displayName }}</span>
          <caret-down />
        </button>

        @if (dropdownOpen()) {
          <dropdown-panel
            id="profile-menu"
            [anchor]="trigger"
          >
            <div class="profile-meta">
              <chrome-avatar [displayName]="u.displayName" [size]="32" />
              <div class="profile-meta-text">
                <span class="profile-meta-name">{{ u.displayName }}</span>
                <badge-role [role]="u.role" />
              </div>
            </div>
            <divider-hr />
            <a
              class="profile-action"
              routerLink="/profile"
              (click)="closeDropdown()"
              data-testid="view-profile-link"
            >View profile</a>
            <divider-hr />
            <button
              type="button"
              class="profile-action"
              (click)="goChangePassword()"
            >Change password</button>
            <divider-hr />
            <button
              type="button"
              class="profile-action"
              (click)="openLogoutDialog()"
            >Log out</button>
          </dropdown-panel>
        }

        @if (logoutDialogOpen()) {
          <dialog-modal
            headline="Log out of HelpDesk Lite?"
            cancelLabel="Cancel"
            confirmLabel="Log out"
            [error]="logoutError()"
            (cancel)="closeLogoutDialog()"
            (confirm)="confirmLogout()"
          />
        }
      }
    </header>
  `,
  styles: [`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: var(--z-dropdown);
    }
    .chrome {
      height: var(--chrome-height);
      display: grid;
      /* The last track holds the profile trigger. An "auto" track is
         sized to its content's MIN-CONTENT width, so the trigger's
         intrinsic 137px pushed the header past the right edge on a
         phone (472px of content in a 420px viewport). minmax(0, auto)
         lets the track shrink to zero — but a track that shrinks to
         zero takes the AVATAR with it, which is worse than the
         overflow it replaces. The narrow-width media query below
         hides the display name instead, so the trigger keeps its
         avatar and the track has room to hold it. */
      grid-template-columns: auto auto 1fr auto minmax(0, auto);
      align-items: center;
      column-gap: 16px;
      padding: 0 32px;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border-bottom: 1px solid var(--color-card-border);
      box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
    }
    .brand {
      all: unset;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      color: var(--color-text-primary);
    }
    .brand:hover .brand-wordmark {
      color: var(--color-primary);
    }
    .brand-mark {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      background: var(--gradient-brand);
      color: #ffffff;
      font-weight: 700;
      font-size: 12px;
      border-radius: 9px;
      letter-spacing: 0.3px;
      box-shadow: var(--shadow-button);
    }
    .brand-wordmark {
      font-size: 16px;
      font-weight: 700;
      color: var(--color-text-primary);
      letter-spacing: -0.02em;
      transition: color var(--duration-fast) var(--ease-out);
    }
    .chrome-nav {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      background: var(--color-page-bg);
      border: 1px solid var(--color-card-border);
      border-radius: 12px;
    }
    .nav-link {
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text-secondary);
      text-decoration: none;
      transition: background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);
    }
    .nav-link:hover {
      color: var(--color-text-primary);
    }
    .nav-link.active {
      color: var(--color-primary);
      font-weight: 600;
      background: var(--color-surface);
      box-shadow: var(--shadow-xs);
    }
    .chrome-search {
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 360px;
      height: 40px;
      padding: 0 14px;
      background: var(--color-surface);
      border: 1px solid var(--color-card-border);
      border-radius: 10px;
      color: var(--color-text-secondary);
      /* The form sits in the chrome's flexible grid track. Its
         automatic minimum size is its min-content width (the input's
         default 20ch plus the icon and the kbd chip), which refused
         to shrink and pushed the bell and the profile trigger past
         the viewport on a phone. Cutting the minimum lets the form
         shrink; the input inside it already has min-width: 0. */
      min-width: 0;
      transition: border-color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out),
        background-color var(--duration-fast) var(--ease-out);
    }
    .chrome-search:focus-within {
      background: var(--color-surface);
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px var(--color-primary-ring);
    }
    .search-icon {
      display: inline-flex;
      align-items: center;
    }
    .search-input {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      background: transparent;
      font-size: 14px;
      color: var(--color-text-primary);
      font-family: inherit;
      outline: none;
    }
    .search-input::placeholder {
      color: var(--color-muted);
    }
    /* Cmd+K shortcut hint inside the search input. Renders as a
       small kbd chip at the right edge of the input so users
       discover the keyboard shortcut without a tooltip. The actual
       keyboard binding is wired via @HostListener('document:keydown')
       in the component class — see onSearchShortcut. */
    .search-shortcut {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 22px;
      padding: 0 6px;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      color: var(--color-text-secondary);
      background: var(--color-page-bg);
      border: 1px solid var(--color-card-border);
      border-radius: 5px;
      box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
      flex-shrink: 0;
      pointer-events: none;
    }
    /* Notification bell trigger (WDS-2026). 36×36 icon button with
       a small red dot in the top-right when there are unread
       notifications. Click is currently a no-op (notification
       panel is out of scope for the current slice) but the
       affordance is present so the chrome is visually complete. */
    .notification-trigger {
      all: unset;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      cursor: pointer;
      color: var(--color-text-soft);
      transition:
        background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);
    }
    .notification-trigger:hover {
      background: var(--color-page-bg);
      color: var(--color-text-primary);
    }
    .notification-trigger:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-primary-ring);
    }
    .notification-trigger svg {
      display: block;
    }
    .notification-dot {
      position: absolute;
      top: 7px;
      right: 7px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-error);
      border: 1.5px solid var(--color-surface);
      box-shadow: 0 0 0 1px var(--color-error);
    }
    .chrome-search-spacer {
      /* empty center cell when search is hidden (user role) */
    }
    .profile-trigger {
      all: unset;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 4px 12px 4px 4px;
      color: var(--color-text-soft);
      font-size: 14px;
      height: 40px;
      border-radius: 10px;
      transition: background-color var(--duration-fast) var(--ease-out);
      /* The trigger is a flex item in the header's last grid track.
         Its automatic minimum size is its content's min-content
         width, so on a narrow screen it refused to shrink and pushed
         the header past the viewport. Cut it and let the name
         ellipsise. */
      min-width: 0;
      overflow: hidden;
    }
    .profile-trigger:hover {
      background: var(--color-page-bg);
      color: var(--color-text);
    }
    .profile-trigger[aria-expanded="true"] {
      background: var(--color-page-bg);
      color: var(--color-text);
      box-shadow: inset 0 0 0 1px var(--color-border-subtle);
    }
    .profile-trigger[aria-expanded="true"] .profile-name {
      font-weight: 600;
    }
    .profile-name {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
      /* A flex item's automatic minimum size is its content's
         min-content width — without this the name would keep the
         trigger at its full width instead of truncating. */
      min-width: 0;
    }
    .profile-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 16px 12px;
    }
    .profile-meta-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .profile-meta-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .profile-action {
      all: unset;
      display: block;
      width: 100%;
      padding: 10px 16px;
      font-size: 14px;
      color: var(--color-text-soft);
      cursor: pointer;
      box-sizing: border-box;
      font-weight: 500;
      transition:
        background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);
    }
    .profile-action:hover {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    /* ── Narrow-viewport chrome ────────────────────────────────
       The chrome's content (brand + nav + bell + profile) is
       intrinsically wider than a phone. The profile trigger's
       display name is the only part that is genuinely optional —
       the avatar identifies the signed-in user, and the dropdown
       panel carries the full name anyway. So the name is dropped
       first, then the wordmark, then the horizontal padding is
       trimmed. Each step is a discrete breakpoint so the header
       degrades predictably instead of squeezing the avatar to
       zero. */
    @media (max-width: 640px) {
      .chrome {
        column-gap: 12px;
        padding: 0 20px;
      }
      .profile-name {
        display: none;
      }
      .profile-trigger {
        gap: 6px;
      }
      /* The search form cannot fit beside the brand, the nav, the
         bell and the profile trigger on a phone. The ticket lists
         carry their own search field in the filter bar, so the
         chrome's duplicate is dropped rather than squeezed. The
         Cmd+K shortcut still works and focuses the page-level
         search instead. */
      .chrome-search {
        display: none;
      }
    }
    @media (max-width: 440px) {
      .chrome {
        column-gap: 10px;
        padding: 0 14px;
      }
      .brand-wordmark {
        display: none;
      }
      .nav-link {
        padding: 6px 10px;
      }
    }
  `],
})
export class HeaderChromeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  readonly notifications = inject(NotificationsService);

  readonly user = toSignal(this.auth.user$, { initialValue: null });

  readonly dropdownOpen = signal(false);
  readonly logoutDialogOpen = signal(false);
  readonly logoutError = signal<string | null>(null);
  readonly searchValue = signal('');
  /**
   * Derived from the live notifications service so the bell's red
   * dot and dropdown panel can never disagree.
   */
  readonly hasUnreadNotifications = computed(() => this.notifications.hasUnread());
  readonly notificationLabel = computed(() =>
    this.hasUnreadNotifications()
      ? 'Notifications — you have unread notifications'
      : 'Notifications',
  );

  readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  readonly notifTrigger = viewChild<ElementRef<HTMLButtonElement>>('notifTrigger');
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly canShowProfile = computed(() => this.user() !== null);

  readonly isAdmin = computed(() => this.user()?.role === 'Admin');
  readonly canSearch = computed(
    () => this.user()?.role === 'Support Agent' || this.user()?.role === 'Admin',
  );

  /**
   * Role-correct landing for the "Tickets" nav link.
   *  - User         → /dashboard   (their own list)
   *  - Support Agent → /tickets    (the list view, HD-019)
   *  - Admin        → /tickets    (admins share the agent view)
   *
   * `/queue` (the Kanban) is still routable but no longer the
   * primary destination for the chrome's nav. It's reachable via
   * deep-link and via the "Switch to Kanban" affordance on the
   * Tickets page (out of scope for HD-019).
   */
  readonly ticketsLink = computed<string>(() => {
    const u = this.user();
    if (!u) return '/dashboard';
    if (u.role === 'User') return '/dashboard';
    return '/tickets';
  });

  constructor() {
    // Pull the user once on mount. If the cookie is missing this
    // returns 401 → user$ emits null → the right column collapses
    // to nothing (just the brand mark). HD-006's auth guard will
    // bounce unauthenticated users to /login before they see this.
    effect(() => {
      if (this.user() === null) {
        // Guard: some page specs stub AuthService without refreshUser.
        // Only the real AuthService instance has this method.
        if (typeof this.auth.refreshUser === 'function') {
          this.auth.refreshUser().catch(() => {
            /* swallow — AuthService already mapped 401 → null */
          });
        }
      }
    });
  }

  /** Bootstrap the bell on mount so the red dot is accurate from the
   * first paint, not only after the user clicks it.
   *
   * Specs that stub `NotificationsService` instead of the real thing
   * (like this component's own spec) get a guard above and skip the
   * call entirely. Page specs that provide the real service but no
   * `HttpClient` will throw synchronously when the service resolves
   * it — that surfaces as a console warning, not a test failure. */
  ngOnInit(): void {
    const svc = this.notifications as unknown as { refresh?: () => Promise<void> };
    if (typeof svc.refresh === 'function') {
      // Swallow the rejection — failing to load notifications on
      // mount never blocks the chrome; the bell simply stays in
      // its last-known state until the user clicks it.
      Promise.resolve(svc.refresh()).catch(() => {
        /* no bell data available (no HttpClient / offline) */
      });
    }
  }

  goHome(): void {
    this.dropdownOpen.set(false);
    void this.router.navigateByUrl(this.auth.roleHomePath());
  }

  /**
   * HD-018: navigate to the change-password page. Closes the
   * dropdown so the user sees the form, not the floating panel.
   * The /profile/password route is authGuard'd; a session that
   * expired between the open and the click will bounce to /login.
   */
  goChangePassword(): void {
    this.dropdownOpen.set(false);
    void this.router.navigateByUrl('/profile/password');
  }

  toggleDropdown(): void {
    this.dropdownOpen.update((v) => !v);
  }

  /**
   * Close the profile dropdown. Called from the in-dropdown
   * `routerLink` click handlers (e.g. "View profile") so the
   * panel doesn't stay open after the route changes.
   */
  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  openLogoutDialog(): void {
    this.logoutError.set(null);
    this.logoutDialogOpen.set(true);
  }

  closeLogoutDialog(): void {
    this.logoutDialogOpen.set(false);
    this.logoutError.set(null);
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchValue.set(target.value);
  }

  onSearchSubmit(event: Event): void {
    event.preventDefault();
    const q = this.searchValue().trim();
    void this.router.navigate(['/tickets'], {
      queryParams: q ? { q } : {},
    });
  }

  /**
   * Notification bell click. Toggles the dropdown panel via the
   * NotificationsService, which performs its own immediate
   * refresh on open so freshly-arrived items appear without
   * waiting for the next 30s tick.
   *
   * First click also starts the polling loop — startPolling is
   * idempotent, so subsequent clicks are harmless. Lazy
   * start-on-first-interaction keeps the service free of timers
   * during page-spec setup, where an HttpClient-required side
   * effect would cascade-fail the suite.
   */
  onNotificationClick(): void {
    if (this.dropdownOpen()) this.dropdownOpen.set(false);
    const svc = this.notifications as unknown as { startPolling?: () => void };
    if (typeof svc.startPolling === 'function') {
      svc.startPolling();
    }
    void this.notifications.togglePanel();
  }

  /**
   * Focus the chrome search input. Used by the Cmd+K / Ctrl+K
   * shortcut — wired via @HostListener('document:keydown') below.
   *
   * Two fallbacks, in order:
   *   1. The chrome's own search input (the user role has no search
   *      at all, so this is skipped).
   *   2. The page-level filter bar's search field. Below the 640px
   *      breakpoint the chrome's search form is hidden — it cannot
   *      fit beside the brand, nav, bell and profile trigger on a
   *      phone — but the ticket lists carry their own search field
   *      in the filter bar, and the shortcut should still land on a
   *      search box rather than doing nothing.
   */
  focusSearchInput(): void {
    const input = this.searchInput()?.nativeElement;
    if (input) {
      input.focus();
      input.select();
      return;
    }
    const fallback = document.querySelector<HTMLInputElement>(
      '[data-testid="ticket-filter-search"]',
    );
    if (fallback) {
      fallback.focus();
      fallback.select();
    }
  }

  async confirmLogout(): Promise<void> {
    this.logoutError.set(null);
    try {
      await this.auth.logout();
      this.logoutDialogOpen.set(false);
      this.dropdownOpen.set(false);
      await this.router.navigate(['/login']);
    } catch (err) {
      if (err instanceof ApiError) {
        this.logoutError.set(err.message || "Couldn't log you out. Try again.");
      } else {
        this.logoutError.set("Couldn't log you out. Try again.");
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.logoutDialogOpen()) {
      this.closeLogoutDialog();
    } else if (this.notifications.panelOpen()) {
      this.notifications.closePanel();
    } else if (this.dropdownOpen()) {
      this.dropdownOpen.set(false);
    }
  }

  /**
   * WDS-2026: ⌘K / Ctrl+K focuses the chrome search input. The
   * shortcut is universal across the app (any view, any role that
   * has a search input) — that's why the listener is on document
   * and not scoped to the form. We `preventDefault()` so the
   * browser's default ⌘K (Chrome's address bar) doesn't fire on
   * macOS. For the user role the search input is not rendered
   * (canSearch() === false) so focusSearchInput() is a no-op.
   *
   * Skip the shortcut when the active element is a <textarea> —
   * the ticket comment composer uses one, and stealing focus
   * from a mid-edit composer would be jarring. We check
   * `document.activeElement` rather than `event.target` because
   * the target is the document body (we listen on `document`),
   * not the element that's actually focused.
   */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    const isMacK = (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');
    if (!isMacK) return;
    const active = document.activeElement;
    if (active && active.tagName === 'TEXTAREA') return;
    event.preventDefault();
    this.focusSearchInput();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) return;
    const host = this.hostEl.nativeElement;
    const inside = host.contains(target);
    if (this.dropdownOpen() && !inside) {
      this.dropdownOpen.set(false);
    }
    if (this.notifications.panelOpen() && !inside) {
      this.notifications.closePanel();
    }
  }
}
