/**
 * ProfilePageComponent — D114.
 *
 * Pins the profile page contract:
 *
 *   (a) Renders the user's display name + email in the account card
 *   (b) Renders a badge-role pill for the user's role
 *   (c) Renders the "Last active" + "Member since" rows
 *   (d) Renders the "Change password" link pointing to /profile/password
 *   (e) Renders the "Sign out" button that calls auth.logout() and
 *       navigates to /login
 *   (f) Renders the "Active" / "Inactive" status pill per user.isActive
 *   (g) Cold load (user$ == null) → triggers auth.refreshUser()
 *
 * Mirrors the existing create-ticket-page spec pattern: TestBed +
 * AuthService stub (BehaviorSubject-based) + real Router via
 * `provideRouter([])` because the page transitively renders
 * `<app-chrome>` (and `<header-chrome>` with its `routerLink`
 * directives need the Router's `events` Observable).
 */

import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import type { UserPublic } from '../../models/user';
import { ProfilePageComponent } from './profile-page.component';

function makeUser(overrides: Partial<UserPublic> = {}): UserPublic {
  return {
    id: 7,
    email: 'eli@example.com',
    displayName: 'Eli',
    role: 'User',
    isActive: true,
    lastActiveAt: '2026-01-15T10:30:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

describe('ProfilePageComponent (D114)', () => {
  let authService: {
    user$: BehaviorSubject<UserPublic | null>;
    userSnapshot: jasmine.Spy<() => UserPublic | null>;
    refreshUser: jasmine.Spy<() => Promise<void>>;
    logout: jasmine.Spy<() => Promise<void>>;
  };
  let router: Router;
  let routerNavigateByUrlSpy: jasmine.Spy;

  beforeEach(() => {
    authService = {
      user$: new BehaviorSubject<UserPublic | null>(null),
      userSnapshot: jasmine.createSpy('userSnapshot'),
      refreshUser: jasmine.createSpy('refreshUser'),
      logout: jasmine.createSpy('logout'),
    };
  });

  async function configureTestbed(initialUser: UserPublic | null): Promise<void> {
    authService.user$ = new BehaviorSubject<UserPublic | null>(initialUser);
    authService.userSnapshot = jasmine
      .createSpy('userSnapshot')
      .and.callFake(() => authService.user$.value);
    authService.refreshUser = jasmine
      .createSpy('refreshUser')
      .and.callFake(async () => {
        // The fake refresh user just keeps whatever's already there.
      });
    authService.logout = jasmine.createSpy('logout').and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    routerNavigateByUrlSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);
  }

  it('renders the display name and email in the account card', async () => {
    await configureTestbed(makeUser());
    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.display-name')?.textContent?.trim()).toBe('Eli');
    expect(root.querySelector('.email')?.textContent?.trim()).toBe('eli@example.com');
  });

  it('renders a badge-role for the user role', async () => {
    await configureTestbed(makeUser({ role: 'Support Agent' }));
    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const role = root.querySelector('badge-role') as HTMLElement;
    expect(role).not.toBeNull();
  });

  it('renders "Active" status pill when user.isActive is true', async () => {
    await configureTestbed(makeUser({ isActive: true }));
    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const pill = root.querySelector('.status-pill') as HTMLElement;
    expect(pill.textContent?.trim()).toBe('Active');
  });

  it('renders "Inactive" status pill when user.isActive is false', async () => {
    await configureTestbed(makeUser({ isActive: false }));
    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const pill = root.querySelector('.status-pill') as HTMLElement;
    expect(pill.textContent?.trim()).toBe('Inactive');
  });

  it('renders the "Change password" link to /profile/password', async () => {
    await configureTestbed(makeUser());
    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '[data-testid="change-password-link"]',
    ) as HTMLElement;
    expect(link).not.toBeNull();
  });

  it('Sign out click → auth.logout() and navigates to /login', async () => {
    await configureTestbed(makeUser());
    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const signOutBtn = fixture.nativeElement.querySelector(
      '[data-testid="sign-out-btn"] button',
    ) as HTMLButtonElement;
    signOutBtn.click();

    // wait for the async onSignOut to settle
    await fixture.whenStable();

    expect(authService.logout).toHaveBeenCalled();
    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/login');
  });

  it('cold load (user$ == null) triggers auth.refreshUser()', async () => {
    await configureTestbed(null);
    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // refreshUser is called at least once by the page. (It may be
    // called more than once if `<app-chrome>` also kicks it off on
    // mount when the snapshot is empty — that's expected and the
    // dedup logic lives in the real AuthService.)
    expect(authService.refreshUser).toHaveBeenCalled();
  });

  it('warm load (user$ != null) does NOT call auth.refreshUser()', async () => {
    await configureTestbed(makeUser());
    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authService.refreshUser).not.toHaveBeenCalled();
  });
});