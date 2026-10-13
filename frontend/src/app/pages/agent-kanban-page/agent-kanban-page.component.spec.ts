/**
 * AgentKanbanPageComponent — HD-012 spec.
 *
 * Covers the major branches of the page:
 *   1.  4 columns render in fixed order (Open · In Progress · Resolved · Closed)
 *   2.  Cards land in the column matching their status
 *   3.  Open column pins `owner===null` to the top with the orphan tint
 *   4.  Closed cards have `draggable="false"`
 *   5.  Click on a card navigates to /tickets/:id
 *   6.  Drag from Open → In Progress fires PATCH and updates the local signal
 *   7.  Drag to a closed column (any → Closed) does NOT call PATCH
 *   8.  PATCH failure reverts the optimistic move + renders the move error toast
 *   9.  Search filter narrows the visible cards
 *  10.  Filter changes sync to the URL via queryParams merge
 *  11.  Load failure renders the error card with a Retry button
 *  12.  Loading state renders the skeleton
 *  13.  Empty / filtered-empty columns render the right empty marker
 *
 * `TicketService`, `AuthService`, `UserService`, `Router`, and
 * `ActivatedRoute` are mocked. The test wires a real `provideRouter`
 * so `queryParamsHandling: 'merge'` works end-to-end on the URL
 * sync. Jasmine is used (frontend tsconfig.spec.json).
 */

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
} from '@angular/router';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { AgentKanbanPageComponent } from './agent-kanban-page.component';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { UserService, type AgentSummary } from '../../services/user.service';
import { ApiError } from '../../services/api-error';
import type { Ticket } from '../../models/ticket';
import type { UserPublic } from '../../models/user';

function makeUser(overrides: Partial<UserPublic> = {}): UserPublic {
  return {
    id: 11,
    email: 'sam@example.com',
    displayName: 'Sam',
    role: 'Support Agent',
    isActive: true,
    lastActiveAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 47,
    number: 'HD-47',
    title: 'WiFi drops',
    description: 'every few minutes',
    category: 'IT',
    priority: 'High',
    status: 'Open',
    submitter: makeUser({ id: 7, displayName: 'Eli', email: 'eli@example.com', role: 'User' }),
    owner: null,
    attachment: null,
    createdAt: '2026-01-15T10:30:00.000Z',
    updatedAt: '2026-01-15T10:30:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function makeAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
  return {
    id: 11,
    displayName: 'Sam',
    role: 'Support Agent',
    ...overrides,
  };
}

function makeDataTransfer(): DataTransfer {
  // JSDOM/ChromeHeadless shim for the HTML5 DataTransfer. Only
  // the methods the page actually touches are implemented; the
  // rest of the surface is left as a no-op so the test can drive
  // dragstart / dragover / drop without an external library.
  const store: Record<string, string> = {};
  let effect: 'move' | 'none' = 'move';
  return {
    getData: (k: string) => store[k] ?? '',
    setData: (k: string, v: string) => {
      store[k] = v;
    },
    clearData: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    effectAllowed: 'all',
    setDragImage: () => undefined,
    get types() {
      return Object.keys(store);
    },
    set dropEffect(v: 'move' | 'none') {
      effect = v;
    },
    get dropEffect() {
      return effect;
    },
    files: {} as FileList,
    items: {} as DataTransferItemList,
  } as unknown as DataTransfer;
}

/**
 * Build a DragEvent-ish object the page can read without needing
 * a real browser DataTransfer (ChromeHeadless refuses to construct
 * a DragEvent with a shimmed dataTransfer). The page only uses
 * `event.preventDefault()` and `event.dataTransfer.setData` /
 * `getData`, so the partial object covers everything.
 */
function makeDragEvent(
  dt: DataTransfer,
  type: 'dragstart' | 'dragover' | 'dragenter' | 'dragleave' | 'drop',
): DragEvent {
  let prevented = false;
  const stub = {
    type,
    dataTransfer: dt,
    preventDefault: () => {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  };
  return stub as unknown as DragEvent;
}

interface Harness {
  ticketService: {
    listForQueue: jasmine.Spy;
    patch: jasmine.Spy;
  };
  userService: { listAgents: jasmine.Spy };
  authService: {
    user$: BehaviorSubject<UserPublic | null>;
    userSnapshot: jasmine.Spy;
    refreshUser: jasmine.Spy;
  };
  router: { navigate: jasmine.Spy; navigateByUrl: jasmine.Spy };
}

async function bootstrap(queryParams: Record<string, string> = {}): Promise<Harness> {
  const ticketService = {
    listForQueue: jasmine.createSpy('listForQueue'),
    patch: jasmine.createSpy('patch'),
  };
  const userService = { listAgents: jasmine.createSpy('listAgents') };
  const user$ = new BehaviorSubject<UserPublic | null>(makeUser());
  const authService = {
    user$,
    userSnapshot: jasmine.createSpy('userSnapshot').and.callFake(() => user$.value),
    refreshUser: jasmine.createSpy('refreshUser').and.resolveTo(undefined),
  };
  const router = {
    navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true),
  };
  const route = {
    snapshot: { queryParamMap: convertToParamMap(queryParams) },
    queryParamMap: convertToParamMap(queryParams),
  };

  await TestBed.configureTestingModule({
    imports: [AgentKanbanPageComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      { provide: TicketService, useValue: ticketService },
      { provide: UserService, useValue: userService },
      { provide: AuthService, useValue: authService },
      { provide: ActivatedRoute, useValue: route },
      // Real Router via `provideRouter([])` so the `<a routerLink>`
      // in `<header-chrome>` (transitively rendered via `<app-chrome>`)
      // can construct. We install jasmine spies on the real instance
      // after the TestBed is built so individual tests can still
      // assert on `router.navigate` / `router.navigateByUrl`.
    ],
  }).compileComponents();

  const realRouter = TestBed.inject(Router);
  spyOn(realRouter, 'navigate').and.callFake(router.navigate as never);
  spyOn(realRouter, 'navigateByUrl').and.callFake(router.navigateByUrl as never);

  return {
    ticketService,
    userService,
    authService,
    router: {
      navigate: realRouter.navigate as jasmine.Spy,
      navigateByUrl: realRouter.navigateByUrl as jasmine.Spy,
    },
  };
}

function makeFixture() {
  return TestBed.createComponent(AgentKanbanPageComponent);
}

describe('AgentKanbanPageComponent (HD-012)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the four columns in fixed order on a successful load', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 1, status: 'Open' }),
      makeTicket({ id: 2, status: 'In Progress' }),
      makeTicket({ id: 3, status: 'Resolved' }),
      makeTicket({ id: 4, status: 'Closed' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const columns = Array.from(
      compiled.querySelectorAll('[data-testid="kanban-column"]'),
    );
    expect(columns.length).toBe(4);
    const titles = Array.from(compiled.querySelectorAll('.column-title')).map(
      (el) => el.textContent?.trim(),
    );
    expect(titles).toEqual(['Open', 'In Progress', 'Resolved', 'Closed']);
  });

  it('places tickets in the column matching their status', async () => {
    const { ticketService, userService } = await bootstrap();
    const t1 = makeTicket({ id: 1, status: 'Open' });
    const t2 = makeTicket({ id: 2, status: 'In Progress' });
    const t3 = makeTicket({ id: 3, status: 'Resolved' });
    const t4 = makeTicket({ id: 4, status: 'Closed' });
    ticketService.listForQueue.and.resolveTo([t1, t2, t3, t4]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const columns = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="kanban-column"]'),
    ) as HTMLElement[];
    const slotIds = (column: HTMLElement) =>
      Array.from(column.querySelectorAll('.card-slot')).map(
        (s) => (s as HTMLElement).getAttribute('data-ticket-id'),
      );
    expect(slotIds(columns[0]!)).toEqual(['1']);
    expect(slotIds(columns[1]!)).toEqual(['2']);
    expect(slotIds(columns[2]!)).toEqual(['3']);
    expect(slotIds(columns[3]!)).toEqual(['4']);
  });

  it('renders Closed cards with draggable=false', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 1, status: 'Open' }),
      makeTicket({ id: 4, status: 'Closed' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const closedCards = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="kanban-column"][data-status="Closed"] kanban-card .card',
      ),
    ) as HTMLElement[];
    closedCards.forEach((card) => {
      expect(card.getAttribute('draggable')).toBe('false');
    });
    const openCards = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="kanban-column"][data-status="Open"] kanban-card .card',
      ),
    ) as HTMLElement[];
    openCards.forEach((card) => {
      expect(card.getAttribute('draggable')).toBe('true');
    });
  });

  it('navigates to /tickets/:id when a card is clicked (no drag)', async () => {
    const { ticketService, userService, router } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 47, status: 'Open' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const slot = fixture.nativeElement.querySelector(
      '.card-slot[data-ticket-id="47"]',
    ) as HTMLElement;
    slot.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/tickets/47');
  });

  it('fires PATCH and updates the local signal when an Open card is dragged to In Progress', async () => {
    const { ticketService, userService } = await bootstrap();
    const t1 = makeTicket({ id: 47, status: 'Open' });
    ticketService.listForQueue.and.resolveTo([t1]);
    userService.listAgents.and.resolveTo([]);
    const updated = { ...t1, status: 'In Progress' as const };
    ticketService.patch.and.resolveTo(updated);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const dt = makeDataTransfer();
    page.onDragStart(makeDragEvent(dt, 'dragstart'), t1);
    page.onDragOver(makeDragEvent(dt, 'dragover'));
    void page.onDrop(makeDragEvent(dt, 'drop'), 'In Progress');

    // Allow the async PATCH promise to resolve + signal update to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(ticketService.patch).toHaveBeenCalledWith(47, { status: 'In Progress' });

    // The card now lives in the In Progress column.
    const inProgress = fixture.nativeElement.querySelector(
      '[data-testid="kanban-column"][data-status="In Progress"]',
    ) as HTMLElement;
    const movedSlots = inProgress.querySelectorAll(
      '.card-slot[data-ticket-id="47"]',
    );
    expect(movedSlots.length).toBe(1);

    const openColumn = fixture.nativeElement.querySelector(
      '[data-testid="kanban-column"][data-status="Open"]',
    ) as HTMLElement;
    const stillInOpen = openColumn.querySelectorAll(
      '.card-slot[data-ticket-id="47"]',
    );
    expect(stillInOpen.length).toBe(0);
  });

  it('does NOT call PATCH when an Open card is dragged to Closed (illegal transition)', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 47, status: 'Open' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const dt = makeDataTransfer();
    const t1 = page.tickets()[0]!;
    page.onDragStart(makeDragEvent(dt, 'dragstart'), t1);
    page.onDragOver(makeDragEvent(dt, 'dragover'));
    void page.onDrop(makeDragEvent(dt, 'drop'), 'Closed');
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(ticketService.patch).not.toHaveBeenCalled();
    // The card stays in Open.
    const openColumn = fixture.nativeElement.querySelector(
      '[data-testid="kanban-column"][data-status="Open"]',
    ) as HTMLElement;
    expect(
      openColumn.querySelectorAll('.card-slot[data-ticket-id="47"]').length,
    ).toBe(1);
  });

  it('reverts the optimistic move + renders the move error toast when PATCH fails', async () => {
    const { ticketService, userService } = await bootstrap();
    const t1 = makeTicket({ id: 47, status: 'Open' });
    ticketService.listForQueue.and.resolveTo([t1]);
    userService.listAgents.and.resolveTo([]);
    ticketService.patch.and.rejectWith(
      new ApiError(500, 'internal_server_error', 'boom'),
    );

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const dt = makeDataTransfer();
    page.onDragStart(makeDragEvent(dt, 'dragstart'), t1);
    page.onDragOver(makeDragEvent(dt, 'dragover'));
    void page.onDrop(makeDragEvent(dt, 'drop'), 'In Progress');
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(ticketService.patch).toHaveBeenCalled();
    const toast = fixture.nativeElement.querySelector(
      '[data-testid="move-error-toast"]',
    );
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain("Couldn't move the ticket");

    // Card reverted to Open.
    const openColumn = fixture.nativeElement.querySelector(
      '[data-testid="kanban-column"][data-status="Open"]',
    ) as HTMLElement;
    expect(
      openColumn.querySelectorAll('.card-slot[data-ticket-id="47"]').length,
    ).toBe(1);
  });

  it('narrows the visible cards when the search input is set', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 1, title: 'VPN keeps dropping' }),
      makeTicket({ id: 2, title: 'Monitor flickers' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Drive the filter through the public method (mirrors the
    // (valueChange)="onSearchInput" wire without depending on the
    // atom-input's <input> dispatch quirks under headless Chrome).
    fixture.componentInstance.onSearchInput('vpn');
    fixture.detectChanges();

    // Drain the 200ms debounce so the signal + URL reflect "vpn".
    await new Promise((resolve) => setTimeout(resolve, 250));
    fixture.detectChanges();

    const slots = fixture.nativeElement.querySelectorAll('.card-slot');
    expect(slots.length).toBe(1);
    expect(
      (slots[0] as HTMLElement).getAttribute('data-ticket-id'),
    ).toBe('1');
  });

  it('syncs the priority filter to the URL via queryParams merge', async () => {
    const { ticketService, userService, router } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onPriorityChange('High');
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalled();
    const lastCall = router.navigate.calls.mostRecent();
    const args = lastCall.args[1] as { queryParams: Record<string, string> };
    expect(args.queryParams['priority']).toBe('High');
  });

  it('renders the error card with a Retry button when the queue load fails', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.rejectWith(
      new ApiError(500, 'internal_server_error', 'boom'),
    );
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorCard = compiled.querySelector(
      '[data-testid="queue-error-card"]',
    );
    expect(errorCard).not.toBeNull();
    const retryBtn = compiled.querySelector(
      '[data-testid="retry-btn"]',
    );
    expect(retryBtn).not.toBeNull();
  });

  it('renders the loading skeleton on the initial load', async () => {
    const { ticketService, userService } = await bootstrap();
    // Use a never-resolving promise so the page stays in the
    // loading state when we assert.
    ticketService.listForQueue.and.returnValue(new Promise(() => undefined));
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('loading-skeleton')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="kanban-board"]')).toBeNull();
  });

  it('shows "No tickets match your filters." when a filter narrows to zero rows', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 1, status: 'Open' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onPriorityChange('Low');
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const openEmpty = fixture.nativeElement.querySelector(
      '[data-testid="kanban-column"][data-status="Open"] [data-testid="column-empty"]',
    ) as HTMLElement;
    expect(openEmpty).not.toBeNull();
    expect(openEmpty.textContent).toContain('No tickets match your filters.');
  });

  it('shows "Nothing here." when a column is genuinely empty', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 1, status: 'Open' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const closedEmpty = fixture.nativeElement.querySelector(
      '[data-testid="kanban-column"][data-status="Closed"] [data-testid="column-empty"]',
    ) as HTMLElement;
    expect(closedEmpty).not.toBeNull();
    expect(closedEmpty.textContent).toContain('Nothing here.');
  });

  it('pins orphan Open tickets to the top with the Unassigned badge', async () => {
    const { ticketService, userService } = await bootstrap();
    const assigned = makeTicket({
      id: 1,
      status: 'Open',
      owner: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent' }),
    });
    const orphan = makeTicket({
      id: 2,
      status: 'Open',
      owner: null,
      // Older than the assigned ticket so createdAt ASC would put
      // it second; the orphan-pin check must still surface it first.
      createdAt: '2026-01-10T10:30:00.000Z',
    });
    ticketService.listForQueue.and.resolveTo([assigned, orphan]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const openColumn = fixture.nativeElement.querySelector(
      '[data-testid="kanban-column"][data-status="Open"]',
    ) as HTMLElement;
    const slots = Array.from(openColumn.querySelectorAll('.card-slot'));
    expect((slots[0] as HTMLElement).getAttribute('data-ticket-id')).toBe('2');
    expect((slots[1] as HTMLElement).getAttribute('data-ticket-id')).toBe('1');

    const unassignedBadges = openColumn.querySelectorAll(
      '[data-testid="unassigned-badge"]',
    );
    expect(unassignedBadges.length).toBe(1);
  });

  // ─── UX polish: system-error toast auto-dismiss (5s) ──────────────

  it('auto-dismisses the move error toast after 5 seconds', fakeAsync(async () => {
    const { ticketService, userService } = await bootstrap();
    const t1 = makeTicket({ id: 47, status: 'Open' });
    ticketService.listForQueue.and.resolveTo([t1]);
    userService.listAgents.and.resolveTo([]);
    ticketService.patch.and.rejectWith(
      new ApiError(500, 'internal_server_error', 'boom'),
    );

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const dt = makeDataTransfer();
    page.onDragStart(makeDragEvent(dt, 'dragstart'), t1);
    page.onDragOver(makeDragEvent(dt, 'dragover'));
    void page.onDrop(makeDragEvent(dt, 'drop'), 'In Progress');
    // Drain microtasks + the 0-delay boundary so the failure
    // handler lands and the toast signal is set inside the
    // fakeAsync zone.
    await Promise.resolve();
    tick(0);
    fixture.detectChanges();

    // Toast is visible immediately after the failed PATCH.
    let toast = fixture.nativeElement.querySelector(
      '[data-testid="move-error-toast"]',
    ) as HTMLElement | null;
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain("Couldn't move the ticket");

    // Just before 5s the toast is still rendered.
    tick(4999);
    fixture.detectChanges();
    toast = fixture.nativeElement.querySelector(
      '[data-testid="move-error-toast"]',
    ) as HTMLElement | null;
    expect(toast).not.toBeNull();

    // At/after 5s the auto-dismiss timer fires and clears the toast.
    tick(2);
    fixture.detectChanges();
    toast = fixture.nativeElement.querySelector(
      '[data-testid="move-error-toast"]',
    ) as HTMLElement | null;
    expect(toast).toBeNull();
  }));

  // ─── UX polish: keyboard move-mode (a11y fallback) ────────────────

  function makeKeyboardEvent(
    key: string,
    extras: Partial<KeyboardEvent> = {},
  ): KeyboardEvent {
    let prevented = false;
    return {
      key,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: () => {
        prevented = true;
      },
      get defaultPrevented() {
        return prevented;
      },
      ...extras,
    } as unknown as KeyboardEvent;
  }

  it('opens move mode on the focused card when M is pressed', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 47, status: 'Open' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance;
    page.onKeydown(makeKeyboardEvent('m'), 47);
    fixture.detectChanges();

    expect(page.movingTicketId()).toBe(47);
    expect(page.moveTargetStatus()).toBe('In Progress');

    const live = fixture.nativeElement.querySelector(
      '[data-testid="move-mode-live"]',
    ) as HTMLElement;
    expect(live.textContent).toContain('Move mode active');

    const slot = fixture.nativeElement.querySelector(
      '.card-slot[data-ticket-id="47"]',
    ) as HTMLElement;
    expect(slot.getAttribute('data-moving')).toBe('true');
    expect(slot.classList.contains('card-slot--moving')).toBe(true);
  });

  it('commits a move when Enter is pressed after picking a target', async () => {
    const { ticketService, userService } = await bootstrap();
    const t1 = makeTicket({ id: 47, status: 'Open' });
    ticketService.listForQueue.and.resolveTo([t1]);
    userService.listAgents.and.resolveTo([]);
    const updated = { ...t1, status: 'In Progress' as const };
    ticketService.patch.and.resolveTo(updated);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance;
    page.onKeydown(makeKeyboardEvent('m'), 47);
    // Default target after M is In Progress (first legal transition
    // from Open). Press Enter to commit.
    page.onKeydown(makeKeyboardEvent('Enter'), 47);

    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(ticketService.patch).toHaveBeenCalledWith(47, {
      status: 'In Progress',
    });
    expect(page.movingTicketId()).toBeNull();

    // Card now lives in the In Progress column.
    const inProgress = fixture.nativeElement.querySelector(
      '[data-testid="kanban-column"][data-status="In Progress"]',
    ) as HTMLElement;
    const moved = inProgress.querySelectorAll(
      '.card-slot[data-ticket-id="47"]',
    );
    expect(moved.length).toBe(1);
  });

  it('cancels move mode and does not call PATCH on Escape', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 47, status: 'Open' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.componentInstance;
    page.onKeydown(makeKeyboardEvent('m'), 47);
    page.onKeydown(makeKeyboardEvent('Escape'), 47);

    expect(page.movingTicketId()).toBeNull();
    expect(ticketService.patch).not.toHaveBeenCalled();
  });

  it('syncs the status filter to the URL via queryParams merge', async () => {
    const { ticketService, userService, router } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onStatusChange('Closed');
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalled();
    const lastCall = router.navigate.calls.mostRecent();
    const args = lastCall.args[1] as { queryParams: Record<string, string> };
    expect(args.queryParams['status']).toBe('Closed');
  });

  it('narrows the visible cards to one column when the status filter is set', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 1, status: 'Open' }),
      makeTicket({ id: 2, status: 'Closed' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onStatusChange('Open');
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const slots = fixture.nativeElement.querySelectorAll('.card-slot');
    expect(slots.length).toBe(1);
  });

  // Wireframe §"Behavior" — Closed column is read-only history.
  // No "View list" link, no drag, no actions. The live page used
  // to render a "View list →" link to /tickets?status=Closed in
  // the Closed column footer; removed in iteration 5 because the
  // wireframe does not list any footer content for the Closed
  // column.
  it('does NOT render a "View list" link in the Closed column (wireframe-forbidden)', async () => {
    const { ticketService, userService } = await bootstrap();
    ticketService.listForQueue.and.resolveTo([
      makeTicket({ id: 1, status: 'Closed' }),
    ]);
    userService.listAgents.and.resolveTo([]);

    const fixture = makeFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '[data-testid="closed-view-list-link"]',
    );
    expect(link).toBeNull();
    // And no inline "View list" anchor anywhere on the page.
    const viewList = fixture.nativeElement.querySelectorAll(
      'a.view-list-link',
    );
    expect(viewList.length).toBe(0);
  });
});
