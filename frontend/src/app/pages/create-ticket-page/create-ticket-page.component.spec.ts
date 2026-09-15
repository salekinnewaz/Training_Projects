/**
 * CreateTicketPageComponent — smoke spec (HD-008) + review patches
 * P8/P9/P10.
 *
 * Original 4 tests:
 *   (a) submitting an empty form triggers per-field validation
 *       and the Submit button's tick through the pressed handler
 *       is rejected (the page never invokes the service)
 *   (b) a valid form that returns 201 calls router.navigateByUrl
 *       with /tickets/<id>/created
 *   (c) a 401 from the service stashes the form to sessionStorage
 *       and redirects to /login?return_to=/tickets/new
 *   (d) ngOnInit restores a stashed draft from sessionStorage when
 *       the route has ?return_to=/tickets/new and clears the entry
 *
 * Review patches (P8/P9/P10) add:
 *   (e) 400 with `fields` maps onto the per-field error signals
 *       (P8 — closes the regression risk in `mapServerFields`)
 *   (f) 5xx / network rejection renders the "Couldn't submit"
 *       inline error and re-enables Submit (P9)
 *   (g) beforeunload lifecycle: window.addEventListener is called
 *       at ngOnInit; window.removeEventListener is called on the
 *       success and 401 paths; and the registered handler sets
 *       event.returnValue when there is unsaved content (P10)
 *
 * The page wraps itself in `<app-chrome>`, which transitively pulls
 * in `header-chrome`, which `inject(AuthService)` and reads its
 * `user$` Observable via toSignal. The test AuthService mock must
 * therefore expose a `user$` Observable (we use a BehaviorSubject
 * seeded to null), plus `userSnapshot`, `roleHomePath`, and
 * `refreshUser` (the chrome calls refreshUser on mount).
 *
 * Mirrors the existing employee-dashboard-page pattern: TestBed +
 * mocks for TicketService / Router / ActivatedRoute.
 */

import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  UrlTree,
} from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { ApiError } from '../../services/api-error';
import { AuthService } from '../../services/auth.service';
import {
  CreateTicketPayload,
  TicketService,
} from '../../services/ticket.service';
import { CreateTicketPageComponent } from './create-ticket-page.component';

const STORAGE_KEY = 'hd:draft:create-ticket';

interface PageInternals {
  title: { set: (v: string) => void };
  description: { set: (v: string) => void };
  category: { set: (v: string) => void };
  priority: { set: (v: string) => void };
  onSubmit: (event: Event) => Promise<void>;
}

interface PageTouched {
  touched: { title: boolean; description: boolean };
}

describe('CreateTicketPageComponent', () => {
  let ticketService: {
    create: jasmine.Spy<(payload: CreateTicketPayload) => Promise<unknown>>;
  };
  let router: {
    navigateByUrl: jasmine.Spy<(url: string | UrlTree) => Promise<boolean>>;
    navigate: jasmine.Spy<(commands: unknown[], extras?: unknown) => Promise<boolean>>;
  };
  let authService: {
    user$: BehaviorSubject<unknown>;
    userSnapshot: jasmine.Spy<() => unknown>;
    roleHomePath: jasmine.Spy<() => string>;
    refreshUser: jasmine.Spy<() => Promise<void>>;
  };
  let activatedRoute: Partial<ActivatedRoute>;

  // P10: spy on window.addEventListener / window.removeEventListener so we
  // can assert the beforeunload lifecycle hooks are installed / removed.
  let addEventListenerSpy: jasmine.Spy;
  let removeEventListenerSpy: jasmine.Spy;
  let originalAdd: typeof window.addEventListener;
  let originalRemove: typeof window.removeEventListener;

  beforeEach(async () => {
    ticketService = {
      create: jasmine.createSpy('create'),
    };
    router = {
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true),
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };
    authService = {
      user$: new BehaviorSubject<unknown>(null),
      userSnapshot: jasmine.createSpy('userSnapshot').and.returnValue(null),
      roleHomePath: jasmine.createSpy('roleHomePath').and.returnValue('/dashboard'),
      refreshUser: jasmine.createSpy('refreshUser').and.resolveTo(),
    };

    const snapshot = {
      queryParamMap: convertToParamMap({}),
    } as unknown as ActivatedRouteSnapshot;
    activatedRoute = {
      snapshot,
    };

    // P10: install spies on window add/remove for the beforeunload listener.
    originalAdd = window.addEventListener;
    originalRemove = window.removeEventListener;
    addEventListenerSpy = jasmine.createSpy('addEventListener');
    removeEventListenerSpy = jasmine.createSpy('removeEventListener');
    window.addEventListener = addEventListenerSpy as unknown as typeof window.addEventListener;
    window.removeEventListener = removeEventListenerSpy as unknown as typeof window.removeEventListener;

    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [CreateTicketPageComponent],
      providers: [
        provideRouter([]),
        { provide: TicketService, useValue: ticketService },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    sessionStorage.clear();
    window.addEventListener = originalAdd;
    window.removeEventListener = originalRemove;
  });

  it('validates empty required fields and skips the service call when submit fires', async () => {
    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as Event;
    await fixture.componentInstance.onSubmit(event);

    expect(ticketService.create).not.toHaveBeenCalled();
    expect(fixture.componentInstance.titleError()).toBe('Enter a title.');
    expect(fixture.componentInstance.descriptionError()).toBe('Describe the issue.');

    // P10: ngOnInit installed the beforeunload listener.
    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', jasmine.any(Function));
  });

  it('navigates to /tickets/<id>/created on a 201 response', async () => {
    ticketService.create.and.resolveTo({
      id: 99,
      number: 'HD-21',
    });

    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.title.set('VPN drops');
    component.description.set('every 10 minutes');

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as Event;
    await component.onSubmit(event);

    expect(ticketService.create).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tickets/99/created');
    expect(fixture.componentInstance.submitting()).toBeFalse();

    // P10: success path removes the beforeunload listener before navigating.
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', jasmine.any(Function));
  });

  it('stashes the form to sessionStorage and bounces to /login?return_to=/tickets/new on a 401', async () => {
    ticketService.create.and.rejectWith(
      new ApiError(401, 'unauthenticated', 'Authentication required.'),
    );

    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.title.set('VPN drops');
    component.description.set('every 10 minutes');
    component.priority.set('High');

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as Event;
    await component.onSubmit(event);

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { return_to: '/tickets/new' },
    });

    const raw = sessionStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '{}') as Record<string, string>;
    expect(parsed['title']).toBe('VPN drops');
    expect(parsed['description']).toBe('every 10 minutes');
    expect(parsed['priority']).toBe('High');

    // P10: 401 path removes the beforeunload listener before navigating to /login.
    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', jasmine.any(Function));
  });

  it('restores a stashed draft on ngOnInit when ?return_to=/tickets/new is present', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        title: 'prefilled title',
        description: 'prefilled description',
        category: 'IT',
        priority: 'High',
      }),
    );

    const snapshot = {
      queryParamMap: convertToParamMap({ return_to: '/tickets/new' }),
    } as unknown as ActivatedRouteSnapshot;
    (TestBed.inject(ActivatedRoute) as { snapshot: ActivatedRouteSnapshot }).snapshot = snapshot;

    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.title()).toBe('prefilled title');
    expect(fixture.componentInstance.description()).toBe('prefilled description');
    expect(fixture.componentInstance.category()).toBe('IT');
    expect(fixture.componentInstance.priority()).toBe('High');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  // P8 — 400 fields mapping.
  it('maps a 400 fields error onto the matching per-field error signals', async () => {
    ticketService.create.and.rejectWith(
      new ApiError(400, 'validation_error', 'Please correct the highlighted fields.', {
        title: 'Enter a title.',
        description: 'Describe the issue.',
      }),
    );

    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as Event;
    await fixture.componentInstance.onSubmit(event);

    expect(fixture.componentInstance.titleError()).toBe('Enter a title.');
    expect(fixture.componentInstance.descriptionError()).toBe('Describe the issue.');

    const touched = (fixture.componentInstance as unknown as PageTouched).touched;
    expect(touched.title).toBeTrue();
    expect(touched.description).toBeTrue();
  });

  // P9 — non-ApiError rejection renders the "Couldn't submit" inline error.
  it('shows the "couldn\'t submit" inline error on a non-ApiError rejection', async () => {
    ticketService.create.and.rejectWith(new Error('boom'));

    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.title.set('VPN drops');
    component.description.set('every 10 minutes');

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as Event;
    await component.onSubmit(event);

    expect(fixture.componentInstance.serverError()).toBe(
      "Couldn't submit your ticket. Please try again.",
    );
    expect(fixture.componentInstance.submitting()).toBeFalse();
  });

  // P10 — drive the registered beforeunload handler with a synthetic event.
  it('the beforeunload handler sets event.returnValue when there is unsaved content', async () => {
    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as PageInternals;
    component.title.set('x');
    component.description.set('y');

    // Capture the handler that was installed by ngOnInit.
    const calls = addEventListenerSpy.calls.allArgs().filter((args) => args[0] === 'beforeunload');
    expect(calls.length).toBeGreaterThan(0);
    const handler = calls[0][1] as (event: BeforeUnloadEvent) => void;

    const event = {
      preventDefault: jasmine.createSpy('preventDefault'),
      returnValue: undefined as string | undefined,
    } as unknown as BeforeUnloadEvent;
    handler(event);

    expect((event as unknown as { preventDefault: jasmine.Spy }).preventDefault).toHaveBeenCalled();
    expect((event as unknown as { returnValue: string | undefined }).returnValue).toBe('');
  });
});
