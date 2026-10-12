/**
 * LoginPageComponent — page spec (D2, was deferred from HD-005).
 *
 * Pins the public sign-in flow's contract:
 *
 *   (a) Empty form → submit triggers per-field errors:
 *         email    → "Enter a valid email address."
 *         password → "Enter your password."
 *       and auth.login is NOT called
 *   (b) A valid form submission calls auth.login(email, password)
 *       and on success navigates to auth.roleHomePath()
 *   (c) 401 with `invalid_credentials` → password field shows
 *       "Email or password is incorrect. Try again."
 *   (d) 401 with `account_inactive` → password field shows
 *       "Your account is inactive. Contact your administrator."
 *   (e) 400 with `validation_error.fields.email` → email field
 *       shows the server's per-field message
 *   (f) Network error → password field shows the generic error
 *   (g) ?return_to=/tickets/new is honored on success
 *   (h) Unsafe return_to values (http://evil, //evil, /\\evil,
 *       /) are rejected and the user lands on roleHomePath
 *   (i) The password show/hide toggle flips input.type between
 *       'password' and 'text'
 *   (j) The "Forgot password?" link points to /forgot-password
 *
 * Mirrors the existing create-ticket-page spec pattern: TestBed +
 * AuthService stub (BehaviorSubject-based) + Router stub +
 * ActivatedRoute stub.
 */

import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ApiError } from '../../services/api-error';
import { AuthService } from '../../services/auth.service';
import { LoginPageComponent } from './login-page.component';

interface PageInternals {
  form: { controls: { email: { setValue: (v: string) => void }; password: { setValue: (v: string) => void } } };
  emailFieldError: { set: (v: string | null) => void };
  passwordFieldError: { set: (v: string | null) => void };
  passwordVisible: { set: (v: boolean) => void };
  onSubmit: () => Promise<void>;
  togglePasswordVisibility: () => void;
}

describe('LoginPageComponent (D2)', () => {
  let authService: {
    login: jasmine.Spy<(email: string, password: string) => Promise<void>>;
    user$: BehaviorSubject<unknown>;
    userSnapshot: jasmine.Spy<() => unknown>;
    roleHomePath: jasmine.Spy<() => string>;
    refreshUser: jasmine.Spy<() => Promise<void>>;
  };
  let router: Router;
  let routerNavigateByUrlSpy: jasmine.Spy;
  let activatedRoute: Partial<ActivatedRoute>;

  function stubRoute(queryParams: Record<string, string> = {}): void {
    const snapshot = {
      queryParamMap: convertToParamMap(queryParams),
    } as unknown as ActivatedRouteSnapshot;
    activatedRoute = { snapshot };
  }

  async function configureTestBed(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    routerNavigateByUrlSpy = spyOn(router, 'navigateByUrl').and.resolveTo(true);
  }

  beforeEach(async () => {
    authService = {
      login: jasmine.createSpy('login').and.resolveTo(),
      user$: new BehaviorSubject<unknown>(null),
      userSnapshot: jasmine.createSpy('userSnapshot').and.returnValue(null),
      roleHomePath: jasmine.createSpy('roleHomePath').and.returnValue('/dashboard'),
      refreshUser: jasmine.createSpy('refreshUser').and.resolveTo(),
    };
    stubRoute();
    await configureTestBed();
  });

  it('renders the brand mark + wordmark on the card', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.brand-mark')?.textContent?.trim()).toBe('HL');
    expect(root.textContent).toContain('HelpDesk Lite');
  });

  it('renders email + password form fields with required labels', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const labels = root.querySelectorAll('label');
    expect(labels.length).toBe(2);
    expect(labels[0]?.textContent).toContain('Email');
    expect(labels[1]?.textContent).toContain('Password');
    // Required indicator (*)
    expect(labels[0]?.textContent).toContain('*');
    expect(labels[1]?.textContent).toContain('*');
  });

  it('disables the submit button when email or password is empty', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector(
      'atom-button button',
    ) as HTMLButtonElement;
    expect(submitBtn.disabled).toBeTrue();

    // Type the values through the input so an `input` event fires —
    // this drives the OnPush change detection path that a programmatic
    // FormControl.setValue() doesn't. The component's (valueChange)
    // handler then writes the value into the form, and the disabled
    // binding re-evaluates on the next CD pass.
    const emailInput = fixture.nativeElement.querySelector(
      'atom-input#login-email input',
    ) as HTMLInputElement;
    const pwdInput = fixture.nativeElement.querySelector(
      'atom-input#login-password input',
    ) as HTMLInputElement;
    emailInput.value = 'eli@example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    pwdInput.value = 'hunter2';
    pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(submitBtn.disabled).toBeFalse();
  });

  it('triggers per-field errors and skips auth.login when submitting an empty form', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(authService.login).not.toHaveBeenCalled();
    expect(fixture.componentInstance.emailFieldError()).toBe(
      'Enter a valid email address.',
    );
    expect(fixture.componentInstance.passwordFieldError()).toBe(
      'Enter your password.',
    );
  });

  it('rejects whitespace-only password on submit (skips auth.login)', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('   ');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(authService.login).not.toHaveBeenCalled();
    expect(fixture.componentInstance.passwordFieldError()).toBe(
      'Enter your password.',
    );
  });

  it('rejects a non-email value on submit (skips auth.login)', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('not-an-email');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(authService.login).not.toHaveBeenCalled();
    expect(fixture.componentInstance.emailFieldError()).toBe(
      'Enter a valid email address.',
    );
  });

  it('calls auth.login with trimmed email + raw password on valid submit', async () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('  eli@example.com  ');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(authService.login).toHaveBeenCalledWith('eli@example.com', 'hunter2');
  });

  it('navigates to roleHomePath on successful login (no return_to)', async () => {
    authService.roleHomePath.and.returnValue('/dashboard');
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to a safe return_to path on successful login', async () => {
    stubRoute({ return_to: '/tickets/new' });
    TestBed.resetTestingModule();
    await configureTestBed();

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/tickets/new');
  });

  it('rejects an http:// return_to and falls back to roleHomePath', async () => {
    const warnSpy = spyOn(console, 'warn');
    stubRoute({ return_to: 'http://evil.example.com' });
    TestBed.resetTestingModule();
    await configureTestBed();

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(warnSpy).toHaveBeenCalled();
    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('rejects a protocol-relative //evil return_to', async () => {
    stubRoute({ return_to: '//evil' });
    TestBed.resetTestingModule();
    await configureTestBed();

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('rejects a bare / return_to (treated as null → roleHomePath)', async () => {
    stubRoute({ return_to: '/' });
    TestBed.resetTestingModule();
    await configureTestBed();

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/dashboard');
  });

  it('renders the wrong-creds error on 401 invalid_credentials', async () => {
    authService.login.and.rejectWith(
      new ApiError(401, 'invalid_credentials', 'Email or password is incorrect.'),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('wrong');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.passwordFieldError()).toBe(
      'Email or password is incorrect. Try again.',
    );
  });

  it('renders the inactive-account error on 401 account_inactive', async () => {
    authService.login.and.rejectWith(
      new ApiError(401, 'account_inactive', 'Account is inactive.'),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.passwordFieldError()).toBe(
      'Your account is inactive. Contact your administrator.',
    );
  });

  it('renders the server field error on 400 validation_error.fields.email', async () => {
    authService.login.and.rejectWith(
      new ApiError(400, 'validation_error', 'Please correct the highlighted fields.', {
        email: 'Enter a valid email address.',
      }),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.emailFieldError()).toBe(
      'Enter a valid email address.',
    );
  });

  it('renders the generic error on a network failure (ApiError network_error)', async () => {
    authService.login.and.rejectWith(
      new ApiError(0, 'network_error', 'Could not reach the server.'),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('hunter2');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.passwordFieldError()).toBe(
      'Something went wrong. Please try again.',
    );
  });

  it('resets submitting to false after a failed login (button re-enables)', async () => {
    authService.login.and.rejectWith(
      new ApiError(401, 'invalid_credentials', 'Email or password is incorrect.'),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.form.controls.email.setValue('eli@example.com');
    component.form.controls.password.setValue('wrong');
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    expect(fixture.componentInstance.submitting()).toBeFalse();
  });

  it('toggles the password input type between "password" and "text"', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const passwordInput = fixture.nativeElement.querySelector(
      'atom-input#login-password input',
    ) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const component = fixture.componentInstance as unknown as PageInternals;
    component.togglePasswordVisibility();
    fixture.detectChanges();
    expect(passwordInput.type).toBe('text');

    component.togglePasswordVisibility();
    fixture.detectChanges();
    expect(passwordInput.type).toBe('password');
  });

  it('renders the "Forgot password?" link to /forgot-password', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      'atom-link[href="/forgot-password"]',
    );
    expect(link).not.toBeNull();
  });
});