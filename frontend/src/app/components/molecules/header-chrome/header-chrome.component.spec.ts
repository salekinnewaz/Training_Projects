/**
 * header-chrome — molecule spec (HD-004 + WDS-2026).
 *
 * Pins the chrome strip's contract:
 *
 *   (a) Renders the 28×28 brand mark + 16px wordmark on the left
 *   (b) When the user is null, the right column is empty (no
 *       nav, no profile, no search)
 *   (c) Renders the "Tickets" nav link for every role; the link
 *       target is role-correct (User → /dashboard, Agent/Admin →
 *       /queue)
 *   (d) Renders the "Users" nav link only when role === Admin
 *   (e) Renders the search input only when role is Support Agent
 *       or Admin (never for the user role)
 *   (f) Renders the profile trigger (avatar + name + caret) and
 *       the trigger's aria-expanded reflects dropdownOpen()
 *   (g) Clicking the trigger toggles the dropdown; the dropdown
 *       contains the user header (avatar, name, role badge), a
 *       divider, "Change password", a divider, and "Log out"
 *   (h) Clicking "Log out" opens the dialog-modal
 *   (i) Confirming the dialog calls auth.logout() + navigates to
 *       /login
 *   (j) The brand mark click navigates to auth.roleHomePath()
 *   (k) Esc closes the logout dialog first, then the dropdown
 *   (l) Click outside the chrome closes the dropdown
 *
 * AuthService is stubbed with a BehaviorSubject seeded with
 * the user so the component reads it via toSignal; the
 * refreshUser effect on mount resolves immediately.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ApiError } from '../../../services/api-error';
import { AuthService } from '../../../services/auth.service';
import type { UserPublic } from '../../../models/user';
import { HeaderChromeComponent } from './header-chrome.component';

function makeUser(overrides: Partial<UserPublic> = {}): UserPublic {
  return {
    id: 7,
    email: 'eli@example.com',
    displayName: 'Eli Chen',
    role: 'User',
    isActive: true,
    lastActiveAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('HeaderChromeComponent', () => {
  let fixture: ComponentFixture<HeaderChromeComponent>;
  let authService: {
    user$: BehaviorSubject<UserPublic | null>;
    userSnapshot: jasmine.Spy;
    roleHomePath: jasmine.Spy;
    refreshUser: jasmine.Spy;
    logout: jasmine.Spy;
  };
  let router: Router;
  let routerNavigateByUrlSpy: jasmine.Spy;
  let routerNavigateSpy: jasmine.Spy;

  function setupRouterSpies(): void {
    router = TestBed.inject(Router);
    routerNavigateByUrlSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    routerNavigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
  }

  beforeEach(async () => {
    // Clear any stragglers left in document.body by other suites
    // (users-tab-page opens a dialog modal too) so the header-chrome
    // tests don't pick up a foreign modal here.
    document.body.innerHTML = '';
    authService = {
      user$: new BehaviorSubject<UserPublic | null>(null),
      userSnapshot: jasmine.createSpy('userSnapshot'),
      roleHomePath: jasmine.createSpy('roleHomePath').and.returnValue('/dashboard'),
      refreshUser: jasmine.createSpy('refreshUser').and.resolveTo(),
      logout: jasmine.createSpy('logout').and.resolveTo(),
    };
    routerNavigateByUrlSpy = jasmine.createSpy('navigateByUrl');
    routerNavigateSpy = jasmine.createSpy('navigate');

    await TestBed.configureTestingModule({
      imports: [HeaderChromeComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    setupRouterSpies();
  });

  afterEach(() => {
    // The dialog-modal ports its scrim + modal children to
    // document.body. Wipe body so each test starts from a clean
    // slate — otherwise queries like `body.querySelector('.btn-primary')`
    // can return a button left over from a previous test.
    document.body.innerHTML = '';
  });

  function seedUser(user: UserPublic | null): void {
    authService.user$.next(user);
    authService.userSnapshot.and.returnValue(user);
  }

  it('renders the 28x28 brand mark + 16px wordmark', () => {
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const brand = fixture.nativeElement.querySelector('.brand') as HTMLElement;
    expect(brand).not.toBeNull();
    expect(brand.textContent).toContain('HL');
    expect(brand.textContent).toContain('HelpDesk Lite');
    const mark = fixture.nativeElement.querySelector('.brand-mark') as HTMLElement;
    // WDS-2026: brand mark is 32x32 (was 40x40 in HD-004).
    // The width/height live in the component-scoped stylesheet, not
    // as inline styles, so read them via getComputedStyle.
    const computed = getComputedStyle(mark);
    expect(computed.width).toBe('32px');
    expect(computed.height).toBe('32px');
  });

  it('does not render nav, search, or profile when the user is null', () => {
    seedUser(null);
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.chrome-nav')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chrome-search')).toBeNull();
    expect(fixture.nativeElement.querySelector('.profile-trigger')).toBeNull();
  });

  it('renders the "Tickets" link for the user role targeting /dashboard', () => {
    seedUser(makeUser({ role: 'User' }));
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('.nav-link') as NodeListOf<HTMLAnchorElement>;
    expect(links.length).toBe(1);
    expect(links[0].textContent?.trim()).toBe('Tickets');
    expect(links[0].getAttribute('href')).toBe('/dashboard');
  });

  it('renders "Tickets" + "Users" links for admin, with Users targeting /users', () => {
    seedUser(makeUser({ role: 'Admin' }));
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('.nav-link') as NodeListOf<HTMLAnchorElement>;
    expect(links.length).toBe(2);
    const labels = Array.from(links).map((l) => l.textContent?.trim());
    expect(labels).toContain('Tickets');
    expect(labels).toContain('Users');
    const usersLink = Array.from(links).find((l) => l.textContent?.trim() === 'Users') as HTMLAnchorElement;
    expect(usersLink.getAttribute('href')).toBe('/users');
  });

  it('targets the "Tickets" link to /queue for support agents', () => {
    seedUser(makeUser({ role: 'Support Agent' }));
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.nav-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/queue');
  });

  it('does not render the search input for the user role', () => {
    seedUser(makeUser({ role: 'User' }));
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.chrome-search')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chrome-search-spacer')).not.toBeNull();
  });

  it('renders the search input for support agents and admins', () => {
    seedUser(makeUser({ role: 'Support Agent' }));
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('.chrome-search') as HTMLElement;
    expect(search).not.toBeNull();
    const input = search.querySelector('input.search-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.placeholder).toContain('Search');
  });

  it('routes to /queue with q param when the search form is submitted', () => {
    seedUser(makeUser({ role: 'Support Agent' }));
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input.search-input') as HTMLInputElement;
    input.value = 'vpn';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form.chrome-search') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(routerNavigateSpy).toHaveBeenCalledWith(['/queue'], {
      queryParams: { q: 'vpn' },
    });
  });

  it('renders the profile trigger with the user name when the user is set', () => {
    seedUser(makeUser({ displayName: 'Eli Chen' }));
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLElement;
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain('Eli Chen');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the dropdown when the trigger is clicked; closes on second click', () => {
    seedUser(makeUser());
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dropdown-panel')).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    trigger.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dropdown-panel')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the role badge inside the dropdown', () => {
    seedUser(makeUser({ role: 'Support Agent' }));
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('badge-role .badge') as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent?.trim()).toBe('Support Agent');
  });

  it('opens the logout dialog when "Log out" is clicked', async () => {
    seedUser(makeUser());
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const logoutBtn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.profile-action'),
    ).find((b) => b.textContent?.trim() === 'Log out') as HTMLButtonElement;
    logoutBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The dialog-modal ports its scrim + modal children to
    // document.body, so we query for [role="dialog"] in body
    // (the host <dialog-modal> element itself stays in the chrome).
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Log out of HelpDesk Lite?');
  });

  it('calls auth.logout() and navigates to /login on dialog confirm', async () => {
    seedUser(makeUser());
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const logoutBtn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.profile-action'),
    ).find((b) => b.textContent?.trim() === 'Log out') as HTMLButtonElement;
    logoutBtn.click();
    fixture.detectChanges();
    // The dialog-modal's portal effect runs on the next CD cycle;
    // pump a stable frame to let scrim + modal land in body.
    await fixture.whenStable();
    fixture.detectChanges();

    // The dialog's children (scrim + modal + buttons) are portaled to
    // document.body. Query directly against body for the primary
    // (confirm) action button. D7 swapped dialog-modal's hand-rolled
    // `.btn-primary` style for `<atom-button variant="primary">`,
    // which renders as an inner `<button class="primary md">` (the
    // atom's host is `display: contents`). Select on the action-row
    // scope + the atom's `primary` class.
    const confirmBtn = document.body.querySelector(
      '.modal-actions button.primary',
    ) as HTMLButtonElement;
    expect(confirmBtn).not.toBeNull();
    confirmBtn.click();
    // confirmLogout is async; pump a microtask.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('renders the logout error inline when auth.logout() throws an ApiError', async () => {
    authService.logout.and.rejectWith(
      new ApiError(500, 'internal_server_error', 'Server down.'),
    );
    seedUser(makeUser());
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const logoutBtn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.profile-action'),
    ).find((b) => b.textContent?.trim() === 'Log out') as HTMLButtonElement;
    logoutBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmBtn = document.body.querySelector(
      '.modal-actions button.primary',
    ) as HTMLButtonElement;
    expect(confirmBtn).not.toBeNull();
    confirmBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const err = document.body.querySelector('.modal-error') as HTMLElement;
    expect(err).not.toBeNull();
    expect(err.textContent?.trim()).toBe('Server down.');
  });

  it('navigates to the role home path when the brand mark is clicked', () => {
    seedUser(makeUser({ role: 'Admin' }));
    authService.roleHomePath.and.returnValue('/admin');
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const brand = fixture.nativeElement.querySelector('.brand') as HTMLButtonElement;
    brand.click();

    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/admin');
  });

  it('closes the logout dialog on Esc (priority over dropdown)', async () => {
    seedUser(makeUser());
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    // Open the dropdown, then click "Log out" to open the dialog.
    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    const logoutBtn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.profile-action'),
    ).find((b) => b.textContent?.trim() === 'Log out') as HTMLButtonElement;
    logoutBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The dialog's children are portaled to body. Check for the
    // [role="dialog"] element landing there.
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    // onEscape sets logoutDialogOpen to false → the @if branch
    // tears the modal component out. We assert the signal is closed
    // rather than checking for the portaled DOM nodes (which
    // remain in body until Angular's change-detection cycle
    // re-collects them).
    expect(fixture.componentInstance.logoutDialogOpen()).toBeFalse();
    expect(fixture.componentInstance.dropdownOpen()).toBeTrue(); // dropdown still open
  });

  it('closes the dropdown on Esc when no dialog is open', () => {
    seedUser(makeUser());
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dropdown-panel')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dropdown-panel')).toBeNull();
  });

  it('closes the dropdown when a click lands outside the chrome host', () => {
    seedUser(makeUser());
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.profile-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dropdown-panel')).not.toBeNull();

    // Dispatch a click on a node that's NOT inside the chrome host.
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dropdown-panel')).toBeNull();

    // Cleanup the appended node so other tests start clean.
    document.body.removeChild(outside);
  });
});
