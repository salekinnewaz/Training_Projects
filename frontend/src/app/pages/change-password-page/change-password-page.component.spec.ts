/**
 * ChangePasswordPageComponent — HD-018 spec.
 *
 * Pins the self-service password-change flow's contract:
 *
 *   (a) Empty form → submit triggers per-field client-side errors
 *       (currentPassword, newPassword, confirmPassword) and
 *       auth.changePassword is NOT called.
 *   (b) Mismatched confirm → confirm field shows "Passwords don't
 *       match." and changePassword is NOT called.
 *   (c) Happy path → changePassword(currentPassword, newPassword)
 *       resolves; success banner renders; after 1.5s the page
 *       navigates to auth.roleHomePath().
 *   (d) 400 with `fields.newPassword` → the new-password field
 *       shows the server's per-field message.
 *   (e) 403 with `invalid_credentials` → the current-password
 *       field shows "Your current password is incorrect."
 *   (f) 401 with `account_inactive` → top-of-form banner shows
 *       the inactive message.
 *   (g) Network / generic error → top-of-form banner shows the
 *       generic "Couldn't change your password" copy.
 *   (h) Cancel link navigates to auth.roleHomePath().
 *   (i) Password show/hide toggle flips all three inputs'
 *       type between 'password' and 'text'.
 *
 * Mirrors the existing login-page spec pattern (D2):
 * TestBed + AuthService stub (login / changePassword are
 * jasmine spies) + Router stub.
 */

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ApiError } from '../../services/api-error';
import { AuthService } from '../../services/auth.service';
import { ChangePasswordPageComponent } from './change-password-page.component';

interface PageInternals {
  form: {
    controls: {
      currentPassword: { setValue: (v: string) => void };
      newPassword: { setValue: (v: string) => void };
      confirmPassword: { setValue: (v: string) => void };
    };
  };
  currentFieldError: { set: (v: string | null) => void };
  newFieldError: { set: (v: string | null) => void };
  confirmFieldError: { set: (v: string | null) => void };
  formError: { set: (v: string | null) => void };
  passwordVisible: { set: (v: boolean) => void };
  onSubmit: () => Promise<void>;
  onCancel: () => void;
  togglePasswordVisibility: () => void;
}

describe('ChangePasswordPageComponent (HD-018)', () => {
  let authService: {
    changePassword: jasmine.Spy<(c: string, n: string) => Promise<void>>;
    user$: BehaviorSubject<unknown>;
    userSnapshot: jasmine.Spy<() => unknown>;
    roleHomePath: jasmine.Spy<() => string>;
    refreshUser: jasmine.Spy<() => Promise<void>>;
  };
  let router: Router;
  let routerNavigateByUrlSpy: jasmine.Spy;

  async function configureTestBed(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ChangePasswordPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    routerNavigateByUrlSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);
  }

  beforeEach(async () => {
    authService = {
      changePassword: jasmine
        .createSpy('changePassword')
        .and.callFake(() => Promise.resolve()),
      user$: new BehaviorSubject<unknown>({
        id: 7,
        email: 'eli@example.com',
        displayName: 'Eli',
        role: 'User',
        isActive: true,
        lastActiveAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
      userSnapshot: jasmine
        .createSpy('userSnapshot')
        .and.returnValue({
          id: 7,
          displayName: 'Eli',
          role: 'User',
        }),
      roleHomePath: jasmine
        .createSpy('roleHomePath')
        .and.returnValue('/dashboard'),
      refreshUser: jasmine
        .createSpy('refreshUser')
        .and.callFake(() => Promise.resolve()),
    };
    await configureTestBed();
  });

  function fillValidForm(
    fixture: import('@angular/core/testing').ComponentFixture<ChangePasswordPageComponent>,
  ): void {
    const page = fixture.componentInstance as unknown as PageInternals;
    page.form.controls.currentPassword.setValue('oldPassword123');
    page.form.controls.newPassword.setValue('newPassword456');
    page.form.controls.confirmPassword.setValue('newPassword456');
  }

  async function settle(
    fixture: import('@angular/core/testing').ComponentFixture<ChangePasswordPageComponent>,
  ): Promise<void> {
    fixture.detectChanges();
    for (let i = 0; i < 4; i += 1) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  it('empty form submit triggers per-field errors and does NOT call auth.changePassword', async () => {
    const fixture = TestBed.createComponent(ChangePasswordPageComponent);
    await settle(fixture);

    await fixture.componentInstance.onSubmit();

    expect(authService.changePassword).not.toHaveBeenCalled();
    expect(fixture.componentInstance.currentFieldError()).toBe(
      'Enter your current password.',
    );
    expect(fixture.componentInstance.newFieldError()).toBe(
      'Enter a new password.',
    );
    expect(fixture.componentInstance.confirmFieldError()).toBe(
      'Re-enter the new password.',
    );
  });

  it('mismatched confirm shows "Passwords don\'t match." and does NOT call auth.changePassword', async () => {
    const fixture = TestBed.createComponent(ChangePasswordPageComponent);
    await settle(fixture);

    const page = fixture.componentInstance as unknown as PageInternals;
    page.form.controls.currentPassword.setValue('oldPassword123');
    page.form.controls.newPassword.setValue('newPassword456');
    page.form.controls.confirmPassword.setValue('differentPassword789');
    await fixture.componentInstance.onSubmit();

    expect(authService.changePassword).not.toHaveBeenCalled();
    expect(fixture.componentInstance.confirmFieldError()).toBe(
      "Passwords don't match.",
    );
  });

  it('happy path resolves, shows the success banner, and schedules a navigate to roleHomePath', fakeAsync(async () => {
    const fixture = TestBed.createComponent(ChangePasswordPageComponent);
    await settle(fixture);
    fillValidForm(fixture);

    await fixture.componentInstance.onSubmit();

    expect(authService.changePassword).toHaveBeenCalledWith(
      'oldPassword123',
      'newPassword456',
    );
    // Flush the setTimeout(1500) the component scheduled for the
    // post-success redirect — fakeAsync gives us tick().
    tick(1600);
    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/dashboard');
  }));

  it('400 with fields.newPassword maps to the new-password field error', async () => {
    authService.changePassword.and.callFake(() =>
      Promise.reject(
        new ApiError(400, 'validation_error', 'Bad.', {
          newPassword: 'New password must be at least 8 characters.',
        }),
      ),
    );
    const fixture = TestBed.createComponent(ChangePasswordPageComponent);
    await settle(fixture);
    fillValidForm(fixture);

    await fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.newFieldError()).toBe(
      'New password must be at least 8 characters.',
    );
  });

  it('403 invalid_credentials maps to the current-password field error', async () => {
    authService.changePassword.and.callFake(() =>
      Promise.reject(
        new ApiError(
          403,
          'invalid_credentials',
          'Your current password is incorrect.',
        ),
      ),
    );
    const fixture = TestBed.createComponent(ChangePasswordPageComponent);
    await settle(fixture);
    fillValidForm(fixture);

    await fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.currentFieldError()).toBe(
      'Your current password is incorrect.',
    );
  });

  it('401 account_inactive maps to the top-of-form banner', async () => {
    authService.changePassword.and.callFake(() =>
      Promise.reject(
        new ApiError(
          401,
          'account_inactive',
          'Your account is inactive. Contact your administrator.',
        ),
      ),
    );
    const fixture = TestBed.createComponent(ChangePasswordPageComponent);
    await settle(fixture);
    fillValidForm(fixture);

    await fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.formError()).toBe(
      'Your account is inactive. Contact your administrator.',
    );
  });

  it('network / generic error maps to the top-of-form banner', async () => {
    // The AuthService.changePassword method catches and rethrows
    // as ApiError(0, 'network_error', ...) on a network failure,
    // so we model the same envelope here.
    authService.changePassword.and.callFake(() =>
      Promise.reject(
        new ApiError(
          0,
          'network_error',
          'Could not reach the server. Check your connection.',
        ),
      ),
    );
    const fixture = TestBed.createComponent(ChangePasswordPageComponent);
    await settle(fixture);
    fillValidForm(fixture);

    await fixture.componentInstance.onSubmit();

    // The page renders the ApiError message verbatim when there's
    // no fields / errorCode mapping.
    expect(fixture.componentInstance.formError()).toBe(
      'Could not reach the server. Check your connection.',
    );
  });

  it('Cancel link navigates to auth.roleHomePath() without firing changePassword', async () => {
    const fixture = TestBed.createComponent(ChangePasswordPageComponent);
    await settle(fixture);

    fixture.componentInstance.onCancel();

    expect(authService.changePassword).not.toHaveBeenCalled();
    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('password show/hide toggle flips passwordVisible', async () => {
    const fixture = TestBed.createComponent(ChangePasswordPageComponent);
    await settle(fixture);

    expect(fixture.componentInstance.passwordVisible()).toBe(false);
    fixture.componentInstance.togglePasswordVisibility();
    expect(fixture.componentInstance.passwordVisible()).toBe(true);
    fixture.componentInstance.togglePasswordVisibility();
    expect(fixture.componentInstance.passwordVisible()).toBe(false);
  });
});
