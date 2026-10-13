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
 *      current role, i.e. /dashboard for users, /queue for agents).
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
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../services/auth.service';
import { ApiError } from '../../../services/api-error';
import { BadgeRoleComponent } from '../../atoms/badge-role/badge-role.component';
import { CaretDownComponent } from '../../atoms/caret-down/caret-down.component';
import { ChromeAvatarComponent } from '../../atoms/chrome-avatar/chrome-avatar.component';
import { DividerHrComponent } from '../../atoms/divider-hr/divider-hr.component';
import { DialogModalComponent } from '../dialog-modal/dialog-modal.component';
import { DropdownPanelComponent } from '../dropdown-panel/dropdown-panel.component';

@Component({
  selector: 'header-chrome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    BadgeRoleComponent,
    CaretDownComponent,
    ChromeAvatarComponent,
    DialogModalComponent,
    DividerHrComponent,
    DropdownPanelComponent,
  ],
  template: `
    <header class="chrome" role="banner">
      <button
        type="button"
        class="brand"
        (click)="goHome()"
        aria-label="HelpDesk Lite — go to your dashboard"
      >
        <span class="brand-mark" aria-hidden="true">HL</span>
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
          </form>
        } @else {
          <div class="chrome-search-spacer"></div>
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
      grid-template-columns: auto auto 1fr auto;
      align-items: center;
      column-gap: 20px;
      padding: 0 32px;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      border-bottom: 1px solid var(--color-border-subtle);
      box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
    }
    .brand {
      all: unset;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      color: var(--color-text);
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
      color: var(--color-text);
      letter-spacing: -0.02em;
      transition: color var(--duration-fast) var(--ease-out);
    }
    .chrome-nav {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      background: var(--color-page-bg);
      border: 1px solid var(--color-border-subtle);
      border-radius: 12px;
    }
    .nav-link {
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--color-label);
      text-decoration: none;
      transition: background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);
    }
    .nav-link:hover {
      color: var(--color-text);
    }
    .nav-link.active {
      color: var(--color-text);
      background: var(--color-surface);
      box-shadow: var(--shadow-xs);
    }
    .chrome-search {
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 360px;
      height: 38px;
      padding: 0 14px;
      background: var(--color-page-bg);
      border: 1px solid var(--color-border-subtle);
      border-radius: 10px;
      color: var(--color-muted);
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
      color: var(--color-text);
      font-family: inherit;
      outline: none;
    }
    .search-input::placeholder {
      color: var(--color-muted);
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
  `],
})
export class HeaderChromeComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  readonly user = toSignal(this.auth.user$, { initialValue: null });

  readonly dropdownOpen = signal(false);
  readonly logoutDialogOpen = signal(false);
  readonly logoutError = signal<string | null>(null);
  readonly searchValue = signal('');

  readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  readonly canShowProfile = computed(() => this.user() !== null);

  readonly isAdmin = computed(() => this.user()?.role === 'Admin');
  readonly canSearch = computed(
    () => this.user()?.role === 'Support Agent' || this.user()?.role === 'Admin',
  );

  /**
   * Role-correct landing for the "Tickets" nav link.
   *  - User         → /dashboard (their own list)
   *  - Support Agent → /queue    (the kanban)
   *  - Admin        → /queue    (admins share the agent view)
   */
  readonly ticketsLink = computed<string>(() => {
    const u = this.user();
    if (!u) return '/dashboard';
    if (u.role === 'User') return '/dashboard';
    return '/queue';
  });

  constructor() {
    // Pull the user once on mount. If the cookie is missing this
    // returns 401 → user$ emits null → the right column collapses
    // to nothing (just the brand mark). HD-006's auth guard will
    // bounce unauthenticated users to /login before they see this.
    effect(() => {
      if (this.user() === null) {
        this.auth.refreshUser().catch(() => {
          /* swallow — AuthService already mapped 401 → null */
        });
      }
    });
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
    void this.router.navigate(['/queue'], {
      queryParams: q ? { q } : {},
    });
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
    } else if (this.dropdownOpen()) {
      this.dropdownOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.dropdownOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    const host = this.hostEl.nativeElement;
    if (host.contains(target)) return;
    // Outside-click dismiss. The panel is portaled via dropdown-panel's
    // absolute positioning under the chrome host, so host.contains
    // already covers it.
    this.dropdownOpen.set(false);
  }
}
