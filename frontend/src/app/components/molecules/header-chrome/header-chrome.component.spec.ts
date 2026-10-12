/**
 * header-chrome — molecule spec (HD-004).
 *
 * Pins the chrome strip's contract:
 *
 *   (a) Renders the brand mark + wordmark on the left
 *   (b) When the user is null, the right column is empty (no
 *       profile trigger + no dropdown)
 *   (c) When the user is set, renders the profile trigger
 *       (avatar + name + caret) and the trigger's aria-expanded
 *       reflects dropdownOpen()
 *   (d) Clicking the trigger toggles the dropdown; the dropdown
 *       contains the user header (avatar, name, role badge), a
 *       divider, and a "Log out" action
 *   (e) Clicking "Log out" opens the dialog-modal
 *   (f) Confirming the dialog calls auth.logout() + navigates to
 *       /login
 *   (g) The brand mark click navigates to auth.roleHomePath()
 *   (h) Esc closes the logout dialog first, then the dropdown
 *   (i) Click outside the chrome closes the dropdown
 *
 * AuthService is stubbed with a BehaviorSubject seeded with
 * the user so the component reads it via toSignal; the
 * refreshUser effect on mount resolves immediately.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
  let routerNavigateByUrlSpy: jasmine.Spy;
  let routerNavigateSpy: jasmine.Spy;

  beforeEach(async () => {
    authService = {
      user$: new BehaviorSubject<UserPublic | null>(null),
      userSnapshot: jasmine.createSpy('userSnapshot'),
      roleHomePath: jasmine.createSpy('roleHomePath').and.returnValue('/dashboard'),
      refreshUser: jasmine.createSpy('refreshUser').and.resolveTo(),
      logout: jasmine.createSpy('logout').and.resolveTo(),
    };
    routerNavigateByUrlSpy = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    routerNavigateSpy = jasmine.createSpy('navigate').and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [HeaderChromeComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        {
          provide: Router,
          useValue: { navigateByUrl: routerNavigateByUrlSpy, navigate: routerNavigateSpy },
        },
      ],
    }).compileComponents();
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

  it('renders the brand mark + wordmark', () => {
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    const brand = fixture.nativeElement.querySelector('.brand') as HTMLElement;
    expect(brand).not.toBeNull();
    expect(brand.textContent).toContain('HL');
    expect(brand.textContent).toContain('HelpDesk Lite');
  });

  it('does not render the profile trigger when the user is null', () => {
    seedUser(null);
    fixture = TestBed.createComponent(HeaderChromeComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.profile-trigger')).toBeNull();
    expect(fixture.nativeElement.querySelector('dropdown-panel')).toBeNull();
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
    // (confirm) action button.
    const confirmBtn = document.body.querySelector(
      '.btn-primary',
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
      '.btn-primary',
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
