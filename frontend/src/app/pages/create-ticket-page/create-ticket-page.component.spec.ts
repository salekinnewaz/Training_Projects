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
import {
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';

import { ApiError } from '../../services/api-error';
import { AuthService } from '../../services/auth.service';
import {
  CreateTicketPayload,
  TicketService,
} from '../../services/ticket.service';
import { AttachmentService } from '../../services/attachment.service';
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
  let attachmentService: {
    upload: jasmine.Spy<(file: File) => Promise<{ id: number; filename: string; sizeBytes: number; mimetype: string }>>;
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
    attachmentService = {
      upload: jasmine.createSpy('upload'),
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
        // AttachmentService injects HttpClient, so we need to
        // provide it even though we mock the service itself
        // (a stub AttachmentService doesn't go through HttpClient).
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: TicketService, useValue: ticketService },
        { provide: AttachmentService, useValue: attachmentService },
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

  // ── HD-016 — attachment upload two-step flow ─────────────────────

  it('uploads the attachment first, then creates the ticket with the returned id', async () => {
    attachmentService.upload.and.resolveTo({
      id: 47,
      filename: 'screenshot.png',
      sizeBytes: 1024,
      mimetype: 'image/png',
    });
    ticketService.create.and.resolveTo({
      id: 99,
      number: 'HD-21',
    });

    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as PageInternals & {
      attachment: { set: (v: File | null) => void };
    };
    component.title.set('VPN drops');
    component.description.set('every 10 minutes');
    const file = new File(['hello'], 'screenshot.png', { type: 'image/png' });
    component.attachment.set(file);

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as Event;
    await component.onSubmit(event);

    // upload called with the same file the user picked.
    expect(attachmentService.upload).toHaveBeenCalledWith(file);
    // create called with the attachmentId from the upload.
    expect(ticketService.create).toHaveBeenCalledTimes(1);
    const payload = ticketService.create.calls.mostRecent().args[0] as CreateTicketPayload;
    expect(payload.attachmentId).toBe(47);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tickets/99/created');
  });

  it('renders a 413 upload error inline and skips the ticket create', async () => {
    attachmentService.upload.and.rejectWith(
      new ApiError(413, 'file_too_large', 'File is larger than 10 MB. Pick a smaller file.'),
    );

    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as PageInternals & {
      attachment: { set: (v: File | null) => void };
    };
    component.title.set('VPN drops');
    component.description.set('every 10 minutes');
    component.attachment.set(
      new File(['x'], 'huge.bin', { type: 'application/zip' }),
    );

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as Event;
    await component.onSubmit(event);

    expect(attachmentService.upload).toHaveBeenCalled();
    expect(ticketService.create).not.toHaveBeenCalled();
    expect(fixture.componentInstance.attachmentError()).toBe(
      'File is larger than 10 MB. Pick a smaller file.',
    );
    expect(fixture.componentInstance.submitting()).toBeFalse();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not call upload when no attachment is set (existing behavior preserved)', async () => {
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
    // attachment() stays null — no file picked.

    const event = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as Event;
    await component.onSubmit(event);

    expect(attachmentService.upload).not.toHaveBeenCalled();
    expect(ticketService.create).toHaveBeenCalledTimes(1);
    const payload = ticketService.create.calls.mostRecent().args[0] as CreateTicketPayload;
    // No attachmentId in the payload when nothing was picked.
    expect(payload.attachmentId).toBeUndefined();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tickets/99/created');
  });

  it('renders the optional category helper text under the Category field', async () => {
    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const helper = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="category-helper"]',
    ) as HTMLElement | null;
    expect(helper).not.toBeNull();
    expect(helper?.textContent?.trim()).toBe(
      'Optional — helps agents route your ticket',
    );
  });

  // ── WDS-2026 — modal layout pins ──────────────────────────────────

  it('renders the create-ticket card as a centered dialog with a header + close button', () => {
    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const card = root.querySelector(
      '.create-ticket-card[role="dialog"]',
    ) as HTMLElement;
    expect(card).not.toBeNull();
    expect(
      card.querySelector('.card-header .card-title')?.textContent?.trim(),
    ).toBe('Create Ticket');

    const close = card.querySelector(
      'button.close-btn[aria-label="Close"]',
    ) as HTMLButtonElement;
    expect(close).not.toBeNull();
  });

  it('places the Cancel + Create Ticket buttons in a card-actions footer', () => {
    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();

    const actions = (fixture.nativeElement as HTMLElement).querySelector(
      '.card-actions',
    ) as HTMLElement;
    expect(actions).not.toBeNull();

    const buttons = actions.querySelectorAll('atom-button');
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.textContent?.trim()).toBe('Cancel');
    expect(buttons[1]?.textContent?.trim()).toBe('Create Ticket');
  });

  it('the close button is type=button (does not submit the form)', () => {
    const fixture = TestBed.createComponent(CreateTicketPageComponent);
    fixture.detectChanges();

    const close = (fixture.nativeElement as HTMLElement).querySelector(
      'button.close-btn',
    ) as HTMLButtonElement;
    expect(close.type).toBe('button');
  });
});
