/**
 * header-chrome — molecule (HD-004).
 *
 * The 64px persistent chrome strip rendered above every post-login
 * page. Three regions:
 *   1. Brand mark (left) — focusable button that routes to the
 *      role-correct dashboard via AuthService.roleHomePath().
 *   2. Spacer.
 *   3. Profile trigger (right) — avatar + name + caret. Toggles a
 *      dropdown-panel containing the user header (avatar, name,
 *      role badge), a divider, and the Log out action.
 *
 * Clicking "Log out" opens a dialog-modal confirmation; on confirm,
 * AuthService.logout() runs and the user is redirected to /login.
 *
 * Keyboard / focus:
 *   - Esc closes the dialog first, then the dropdown.
 *   - Click outside the trigger AND outside the dropdown closes
 *     the dropdown.
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
import { Router } from '@angular/router';
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

      <div class="chrome-spacer"></div>

      @if (user(); as u) {
        <button
          #trigger
          type="button"
          class="profile-trigger"
          (click)="toggleDropdown()"
          [attr.aria-expanded]="dropdownOpen()"
          aria-haspopup="menu"
          aria-controls="profile-menu"
        >
          <chrome-avatar [displayName]="u.displayName" [size]="32" />
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
    }
    .chrome {
      position: sticky;
      top: 0;
      height: var(--chrome-height);
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      padding: 0 32px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      z-index: var(--z-dropdown);
    }
    .chrome-spacer {
      /* grid item that pushes profile-trigger to the right edge */
    }
    .brand {
      all: unset;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      color: var(--color-primary);
    }
    .brand:hover .brand-wordmark {
      color: var(--color-label);
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      background: var(--color-primary);
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .brand-wordmark {
      font-size: 22px;
      font-weight: 600;
      color: var(--color-primary);
    }
    .profile-trigger {
      all: unset;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      padding: 0 8px;
      color: var(--color-label);
      font-size: 14px;
      height: 100%;
    }
    .profile-trigger:hover {
      color: var(--color-primary);
    }
    .profile-trigger[aria-expanded="true"] {
      color: var(--color-primary);
    }
    .profile-trigger[aria-expanded="true"] .profile-name {
      font-weight: 600;
    }
    .profile-name {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .profile-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 16px 12px;
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
      color: var(--color-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .profile-action {
      all: unset;
      display: block;
      width: 100%;
      padding: 8px 16px;
      font-size: 14px;
      color: var(--color-primary);
      cursor: pointer;
      box-sizing: border-box;
    }
    .profile-action:hover {
      background: var(--color-surface-subtle);
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

  readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  readonly canShowProfile = computed(() => this.user() !== null);

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

  toggleDropdown(): void {
    this.dropdownOpen.update((v) => !v);
  }

  openLogoutDialog(): void {
    this.logoutError.set(null);
    this.logoutDialogOpen.set(true);
  }

  closeLogoutDialog(): void {
    this.logoutDialogOpen.set(false);
    this.logoutError.set(null);
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
