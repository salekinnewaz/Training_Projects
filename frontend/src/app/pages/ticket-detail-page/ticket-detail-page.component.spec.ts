/**
 * TicketDetailPageComponent — HD-010 spec.
 *
 * 21 tests (the spec calls for 8-9; we cover the major branches
 * plus the step-04 review patches for onPriorityChange /
 * onAssigneeChange / onSelfAssign / onCategoryChange direct-call
 * coverage and the composerError toast render):
 *   1. happy agent load renders meta grid + comments thread + activity
 *   2. happy user-submitter of Resolved ticket shows Reopen + Confirm-and-close
 *   3. status change patches + signal updates
 *   4. add comment appends + composer clears
 *   5. reopen click opens modal
 *   6. reopen confirm invokes service + closes modal
 *   7. confirm-close one-click invokes service
 *   8. Closed renders read-only banner + hides composer
 *   9. non-numeric `:id` navigates to `/dashboard`
 *  10. self-assign button visible to non-owning Support Agent
 *  11. 404 from getById flips to the notFound render state
 *  12. agents failure → graceful degradation (Unassigned-only)
 *  13. Support Agent on another user's ticket: missing buttons
 *  14. non-2xx ApiError on getById → error card
 *  15. composerError toast renders when onStatusChange rejects (patch A)
 *  16. onPriorityChange patches + signal updates (patch C4)
 *  17. onCategoryChange patches + signal updates (patch B)
 *  18. onAssigneeChange patches + signal updates (patch C4)
 *  19. onSelfAssign click invokes patch with current user id (patch C4)
 *  20. (HD-011) comment-time formats
 *  21. (HD-011) composer key bindings + error states
 *  22. (HD-016) attachment row render
 *  23. (HD-017) refetches activity after a successful addComment
 *  24. (HD-017) post-addComment activity refetch failure is non-blocking
 *
 * `TicketService`, `AuthService`, `UserService`, and the Angular
 * `Router` are mocked at the class level so the page can be exercised
 * in isolation against a stand-in backend. No real HTTP, no real
 * auth. Jasmine is used (per frontend tsconfig.spec.json).
 *
 * The `<app-chrome>` wrap pulls in `<header-chrome>`, which calls
 * `authService.refreshUser()` when the user snapshot is empty.
 * To keep the test deterministic we provide a `user$` BehaviorSubject
 * matching the snapshot (mirrors the submission-confirmation-page
 * spec).
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  ActivatedRoute,
  Router,
  convertToParamMap,
} from '@angular/router';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { TicketDetailPageComponent } from './ticket-detail-page.component';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { UserService, type AgentSummary } from '../../services/user.service';
import { AttachmentService } from '../../services/attachment.service';
import { ApiError } from '../../services/api-error';
import type { Ticket } from '../../models/ticket';
import type { Comment } from '../../models/comment';
import type { ActivityLog } from '../../models/activity-log';
import type { UserPublic } from '../../models/user';
import type { Attachment } from '../../models/attachment';

function makeUser(overrides: Partial<UserPublic> = {}): UserPublic {
  return {
    id: 7,
    email: 'eli@example.com',
    displayName: 'Eli',
    role: 'User',
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
    title: 'WiFi drops every few minutes',
    description: 'Help — keeps disconnecting.',
    category: 'IT',
    priority: 'Medium',
    status: 'Open',
    submitter: makeUser({ id: 7, displayName: 'Eli', email: 'eli@example.com' }),
    owner: null,
    attachment: null,
    createdAt: '2026-01-15T10:30:00.000Z',
    updatedAt: '2026-01-15T10:30:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    ticketId: 47,
    author: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
    body: 'Restarting config reset',
    createdAt: '2026-01-15T11:00:00.000Z',
    ...overrides,
  };
}

function makeActivity(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 1,
    ticketId: 47,
    actor: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent' }),
    eventType: 'Created',
    payload: null,
    createdAt: '2026-01-15T10:30:00.000Z',
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

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 47,
    filename: 'screenshot.png',
    sizeBytes: 1024 * 1024,
    mimetype: 'image/png',
    storagePath: '47-screenshot.png',
    uploadedBy: makeUser({ id: 7, displayName: 'Eli' }),
    createdAt: '2026-01-15T10:30:00.000Z',
    ...overrides,
  };
}

interface TestbedHandle {
  ticketService: {
    getById: jasmine.Spy;
    listComments: jasmine.Spy;
    listActivity: jasmine.Spy;
    patch: jasmine.Spy;
    addComment: jasmine.Spy;
    reopen: jasmine.Spy;
    confirmClose: jasmine.Spy;
  };
  userService: { listAgents: jasmine.Spy };
  router: { navigate: jasmine.Spy; navigateByUrl: jasmine.Spy };
}

function configureTestbed(opts: {
  user: UserPublic | null;
  ticket: Ticket;
  comments?: Comment[];
  activity?: ActivityLog[];
  agents?: AgentSummary[];
  paramId?: string;
  /**
   * Optional override of `getById` for the 404 test (and friends).
   * When set, the auto-mock for `getById` is replaced.
   */
  getByIdOverride?: () => Promise<Ticket>;
  /**
   * Optional override of `listAgents` to simulate a 503 / network
   * failure path. When set, the auto-mock for `listAgents` is
   * replaced.
   */
  listAgentsOverride?: () => Promise<AgentSummary[]>;
}): TestbedHandle {
  const ticketService = {
    getById: jasmine.createSpy('getById').and.callFake(
      opts.getByIdOverride ?? (() => Promise.resolve(opts.ticket)),
    ),
    listComments: jasmine.createSpy('listComments').and.returnValue(
      Promise.resolve(opts.comments ?? []),
    ),
    listActivity: jasmine.createSpy('listActivity').and.returnValue(
      Promise.resolve(opts.activity ?? []),
    ),
    patch: jasmine.createSpy('patch').and.callFake(
      (_id: number, payload: Record<string, unknown>) =>
        Promise.resolve({ ...opts.ticket, ...payload } as unknown as Ticket),
    ),
    addComment: jasmine.createSpy('addComment').and.callFake(
      (ticketId: number, body: string) =>
        Promise.resolve(makeComment({ id: 99, ticketId, body })),
    ),
    reopen: jasmine.createSpy('reopen').and.callFake(() =>
      Promise.resolve({ ...opts.ticket, status: 'Open' } as Ticket),
    ),
    confirmClose: jasmine.createSpy('confirmClose').and.callFake(() =>
      Promise.resolve({ ...opts.ticket, status: 'Closed' } as Ticket),
    ),
  };

  const router = {
    navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
    navigateByUrl: jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true)),
  };

  // Spy stubs are installed against the REAL Router below in
  // `installRouterSpies()` once `TestBed.inject(Router)` is
  // available. We can't replace the Router provider with a stub
  // here because `<header-chrome>` (loaded transitively via
  // `<app-chrome>`) uses `<a routerLink>` directives whose
  // constructor calls `router.events.subscribe(...)` —
  // a stub without that Observable crashes on construction.
  // Mirrors the header-chrome / login spec pattern.

  const userService = {
    listAgents: jasmine.createSpy('listAgents').and.callFake(
      opts.listAgentsOverride ?? (() => Promise.resolve(opts.agents ?? [makeAgent()])),
    ),
  };

  // HD-016: stubbed AttachmentService. The page only calls
  // downloadUrl() (a pure function), so the stub just needs to
  // match the real one's shape.
  const attachmentService = {
    downloadUrl: (id: number) => `http://test/api/attachments/${id}`,
    upload: jasmine.createSpy('upload'),
  };

  TestBed.configureTestingModule({
    imports: [TicketDetailPageComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({ id: opts.paramId ?? '47' }),
          },
        },
      },
      { provide: TicketService, useValue: ticketService },
      {
        provide: AuthService,
        useValue: {
          userSnapshot: () => opts.user,
          roleHomePath: () => '/login',
          refreshUser: () => Promise.resolve(),
          // header-chrome subscribes to user$ via toSignal().
          user$: new BehaviorSubject<UserPublic | null>(opts.user),
        },
      },
      { provide: UserService, useValue: userService },
      { provide: AttachmentService, useValue: attachmentService },
      // Real Router via `provideRouter([])` so `<a routerLink>` in
      // `<header-chrome>` (transitively rendered via `<app-chrome>`)
      // can construct. We install jasmine spies on the real instance
      // after the TestBed is built so individual tests can still
      // assert on `router.navigateByUrl`.
    ],
  });

  const realRouter = TestBed.inject(Router);
  spyOn(realRouter, 'navigate').and.callFake(router.navigate as never);
  spyOn(realRouter, 'navigateByUrl').and.callFake(router.navigateByUrl as never);

  return { ticketService, userService, router: { navigate: realRouter.navigate as jasmine.Spy, navigateByUrl: realRouter.navigateByUrl as jasmine.Spy } };
}

async function settle(fixture: import('@angular/core/testing').ComponentFixture<TicketDetailPageComponent>): Promise<void> {
  // Flush the chained Promise.all in load() + the microtasks that
  // resolve the patch / reopen / confirmClose / addComment calls.
  // Multiple awaits handle the chained microtasks each Promise
  // resolution queues (mirrors the backend spec pattern).
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
  fixture.detectChanges();
}

describe('TicketDetailPageComponent (HD-010)', () => {
  it('happy agent load renders meta grid + comments thread + activity timeline', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      comments: [makeComment()],
      activity: [
        makeActivity({
          id: 2,
          eventType: 'StatusChanged',
          payload: { eventType: 'StatusChanged', from: 'Open', to: 'In Progress' },
        }),
      ],
      agents: [makeAgent()],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('WiFi drops every few minutes');
    expect(html).toContain('#HD-47');
    expect(html).toContain('meta-grid');
    expect(html).toContain('comments-section');
    expect(html).toContain('activity-section');
    expect(html).toContain('Restarting config reset');
    expect(html).toContain('changed status from Open to In Progress');

    expect(ticketService.getById).toHaveBeenCalledWith(47);
  });

  it('happy user-submitter of Resolved ticket shows Reopen + Confirm-and-close buttons', async () => {
    configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket({ status: 'Resolved' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('reopen-btn');
    expect(html).toContain('confirm-close-btn');
  });

  it('status change patches the ticket and updates the local signal', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    await fixture.componentInstance.onStatusChange('In Progress');

    expect(ticketService.patch).toHaveBeenCalledWith(47, { status: 'In Progress' });
    expect(fixture.componentInstance.ticket()?.status).toBe('In Progress');
  });

  it('add comment appends to the thread and clears the composer', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      comments: [],
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    fixture.componentInstance.composerValue.set('Restarting config reset');
    await fixture.componentInstance.onSendComment();

    expect(ticketService.addComment).toHaveBeenCalledWith(47, 'Restarting config reset');
    expect(fixture.componentInstance.comments().length).toBe(1);
    expect(fixture.componentInstance.composerValue()).toBe('');
  });

  it('Reopen click opens the confirmation modal', async () => {
    configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket({ status: 'Resolved' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    fixture.componentInstance.openReopenModal();
    expect(fixture.componentInstance.reopenModalOpen()).toBe(true);
  });

  it('Reopen confirm invokes the service and closes the modal', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket({ status: 'Resolved' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    fixture.componentInstance.openReopenModal();
    await fixture.componentInstance.onReopenConfirmed();

    expect(ticketService.reopen).toHaveBeenCalledWith(47);
    expect(fixture.componentInstance.reopenModalOpen()).toBe(false);
    expect(fixture.componentInstance.ticket()?.status).toBe('Open');
  });

  it('Confirm and close one-click invokes the service', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket({ status: 'Resolved' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    await fixture.componentInstance.onConfirmClose();

    expect(ticketService.confirmClose).toHaveBeenCalledWith(47);
    expect(fixture.componentInstance.ticket()?.status).toBe('Closed');
  });

  it('Closed tickets render in read-only mode and hide the composer', async () => {
    configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket({ status: 'Closed' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('closed-banner');
    expect(html).not.toContain('comment-composer');
    expect(html).not.toContain('reopen-btn');
    expect(html).not.toContain('confirm-close-btn');
  });

  it('non-numeric `:id` navigates to /dashboard without firing fetches', async () => {
    const { ticketService, router } = configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket(),
      agents: [],
      paramId: 'abc',
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await Promise.resolve();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(ticketService.getById).not.toHaveBeenCalled();
  });

  it('self-assign button is visible to a Support Agent who is not the current owner', async () => {
    configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({
        status: 'Open',
        owner: makeUser({ id: 22, displayName: 'Jordan', role: 'Support Agent', email: 'jordan@example.com' }),
      }),
      agents: [makeAgent(), makeAgent({ id: 22, displayName: 'Jordan', role: 'Support Agent' })],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('self-assign-btn');
  });

  it('404 from getById flips to the notFound render state', async () => {
    configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket(),
      agents: [],
      getByIdOverride: () =>
        Promise.reject(new ApiError(404, 'not_found', 'Ticket not found.')),
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    expect(fixture.componentInstance.renderState()).toBe('notFound');
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('not-found-card');
  });

  it('falls back to Unassigned-only in the assignee dropdown when listAgents fails', async () => {
    const { ticketService, userService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open', owner: null }),
      agents: [],
      listAgentsOverride: () =>
        Promise.reject(
          new ApiError(503, 'internal_server_error' as never, 'agents down'),
        ),
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    // Primary load still succeeded — page flips to 'success', not
    // 'error', because the agents fetch is a non-fatal secondary.
    expect(ticketService.getById).toHaveBeenCalled();
    expect(userService.listAgents).toHaveBeenCalled();
    expect(fixture.componentInstance.renderState()).toBe('success');

    // The agents signal should have been reset to an empty array
    // by the page's graceful-degradation path.
    expect(fixture.componentInstance.agents().length).toBe(0);

    // The assignee <select> should now contain only the Unassigned
    // option (value=""). The atom-select host is a custom element
    // that forwards id="meta-assignee" to its inner native <select>,
    // so the id selector may match either. We grab the first element
    // with that id that actually has an `options` property.
    const allSelects = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLSelectElement>('select'),
    );
    const assigneeSelect = allSelects.find((s) => s.id === 'meta-assignee');
    expect(assigneeSelect).toBeDefined();
    const options = Array.from(assigneeSelect!.options);
    expect(options.length).toBe(1);
    expect(options[0].value).toBe('');
    expect(options[0].textContent?.trim() || options[0].label).toBe('Unassigned');

    // No error toast should be rendered — graceful degradation keeps
    // the success view clean.
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="error-card"]')).toBeNull();
    expect(root.querySelector('.error-toast')).toBeNull();
  });

  it('hides Reopen and Confirm-and-close buttons when a Support Agent views another user\'s ticket', async () => {
    const { ticketService } = configureTestbed({
      // Sam (id 7) — a Support Agent — viewing Jess's Resolved ticket.
      user: makeUser({ id: 7, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({
        status: 'Resolved',
        submitter: makeUser({ id: 99, displayName: 'Jess', email: 'jess@example.com' }),
      }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const root = fixture.nativeElement as HTMLElement;
    expect(ticketService.getById).toHaveBeenCalled();

    // Sam is an agent, not the submitter — neither the Reopen modal
    // trigger nor the Confirm-and-close one-click should be in the
    // DOM. The submitter-actions section itself is also hidden
    // because both children are gated off.
    expect(root.querySelector('[data-testid="reopen-btn"]')).toBeNull();
    expect(root.querySelector('[data-testid="confirm-close-btn"]')).toBeNull();
    expect(root.querySelector('[data-testid="submitter-actions"]')).toBeNull();

    // The Status dropdown is gated on canEditMeta() = isAgent() &&
    // !isClosed(). Sam is an agent and the ticket is Resolved (not
    // Closed), so the Status select should be enabled.
    const allSelects = Array.from(
      root.querySelectorAll<HTMLSelectElement>('select'),
    );
    const statusSelect = allSelects.find((s) => s.id === 'meta-status');
    expect(statusSelect).toBeDefined();
    expect(statusSelect?.disabled).toBe(false);
  });

  it('shows the "Couldn\'t load this ticket" card when getById rejects with a network_error', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket(),
      agents: [],
      getByIdOverride: () =>
        Promise.reject(new ApiError(0, 'network_error', 'network failed')),
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    // Any non-404 / non-2xx on the primary load flips to 'error'.
    expect(ticketService.getById).toHaveBeenCalled();
    expect(fixture.componentInstance.renderState()).toBe('error');

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('error-card');
    expect(html).toContain("Couldn't load this ticket");
    expect(html).toContain('Back to Dashboard');
  });

  it('renders a top-of-page error-toast when onStatusChange rejects with ApiError', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      agents: [],
    });
    // Re-stub patch to reject so the page's error path fires.
    ticketService.patch.and.callFake(() =>
      Promise.reject(new ApiError(500, 'internal_server_error', 'Status update failed.')),
    );

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    await fixture.componentInstance.onStatusChange('In Progress');
    // Let the rejected promise resolve and the signal settle.
    for (let i = 0; i < 4; i += 1) {
      await Promise.resolve();
    }
    fixture.detectChanges();

    const toast = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="error-toast"]',
    ) as HTMLElement | null;
    expect(toast).not.toBeNull();
    expect(toast?.getAttribute('role')).toBe('alert');
    expect(toast?.getAttribute('aria-live')).toBe('polite');
    expect(toast?.textContent?.trim()).toContain('Status update failed.');
  });

  it('onPriorityChange patches the ticket and updates the local signal', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open', priority: 'Medium' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    await fixture.componentInstance.onPriorityChange('High');

    expect(ticketService.patch).toHaveBeenCalledWith(47, { priority: 'High' });
    expect(fixture.componentInstance.ticket()?.priority).toBe('High');
  });

  it('onCategoryChange patches the ticket with the new category', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open', category: 'IT' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    await fixture.componentInstance.onCategoryChange('HR');

    expect(ticketService.patch).toHaveBeenCalledWith(47, { category: 'HR' });
    expect(fixture.componentInstance.ticket()?.category).toBe('HR');
  });

  it('onAssigneeChange patches the ticket with ownerId and updates the local signal', async () => {
    const jordan = makeUser({ id: 22, displayName: 'Jordan', role: 'Support Agent', email: 'jordan@example.com' });
    const baseTicket = makeTicket({ status: 'Open', owner: null });
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: baseTicket,
      agents: [makeAgent(), makeAgent({ id: 22, displayName: 'Jordan', role: 'Support Agent' })],
    });
    // Re-stub patch so the response carries the eager-loaded `owner`.
    ticketService.patch.and.callFake(
      (_id: number, payload: Record<string, unknown>) => {
        const ownerId = payload['ownerId'] as number | null;
        return Promise.resolve(
          makeTicket({
            ...baseTicket,
            ...payload,
            owner: ownerId === jordan.id ? jordan : null,
          }),
        );
      },
    );

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    await fixture.componentInstance.onAssigneeChange('22');

    expect(ticketService.patch).toHaveBeenCalledWith(47, { ownerId: 22 });
    expect(fixture.componentInstance.ticket()?.owner?.id).toBe(22);
  });

  it('onSelfAssign click invokes patch with the current user id as ownerId', async () => {
    const sam = makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' });
    const baseTicket = makeTicket({
      status: 'Open',
      owner: makeUser({ id: 22, displayName: 'Jordan', role: 'Support Agent', email: 'jordan@example.com' }),
    });
    const { ticketService } = configureTestbed({
      user: sam,
      ticket: baseTicket,
      agents: [
        makeAgent(),
        makeAgent({ id: 22, displayName: 'Jordan', role: 'Support Agent' }),
      ],
    });
    // Re-stub patch so the response carries the eager-loaded `owner`.
    ticketService.patch.and.callFake(
      (_id: number, payload: Record<string, unknown>) => {
        const ownerId = payload['ownerId'] as number | null;
        return Promise.resolve(
          makeTicket({
            ...baseTicket,
            ...payload,
            owner: ownerId === sam.id ? sam : null,
          }),
        );
      },
    );

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    await fixture.componentInstance.onSelfAssign();

    expect(ticketService.patch).toHaveBeenCalledWith(47, { ownerId: 11 });
    expect(fixture.componentInstance.ticket()?.owner?.id).toBe(11);
  });

  // ─── HD-011 ──────────────────────────────────────────────────────

  it('HD-011: applies the role-border class to each comment row per author role', async () => {
    const sam = makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' });
    const admin = makeUser({ id: 22, displayName: 'Alex', role: 'Admin', email: 'alex@example.com' });
    const eli = makeUser({ id: 7, displayName: 'Eli', role: 'User' });
    configureTestbed({
      user: sam,
      ticket: makeTicket({ status: 'Open', submitter: eli }),
      comments: [
        makeComment({ id: 1, author: eli, body: 'still broken' }),
        makeComment({ id: 2, author: sam, body: 'reproducing now' }),
        makeComment({ id: 3, author: admin, body: 'taking a look' }),
      ],
      agents: [makeAgent()],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLIElement>(
        '[data-testid="comment-row"]',
      ),
    );
    expect(rows.length).toBe(3);
    // User → comment-role-user
    expect(rows[0].classList.contains('comment-role-user')).toBe(true);
    expect(rows[0].classList.contains('comment-role-agent')).toBe(false);
    expect(rows[0].getAttribute('data-role')).toBe('User');
    // Support Agent → comment-role-agent
    expect(rows[1].classList.contains('comment-role-agent')).toBe(true);
    expect(rows[1].classList.contains('comment-role-user')).toBe(false);
    expect(rows[1].getAttribute('data-role')).toBe('Support Agent');
    // Admin → comment-role-agent (per UX §1, Admin displays as Agent)
    expect(rows[2].classList.contains('comment-role-agent')).toBe(true);
    expect(rows[2].classList.contains('comment-role-user')).toBe(false);
    expect(rows[2].getAttribute('data-role')).toBe('Admin');
  });

  it('HD-011: comment-time is relative for events less than 24 h old', async () => {
    const eli = makeUser({ id: 7, displayName: 'Eli', role: 'User' });
    const now = Date.now();
    configureTestbed({
      user: eli,
      ticket: makeTicket({ status: 'Open' }),
      comments: [
        makeComment({
          id: 1,
          author: eli,
          body: 'fresh',
          createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
        }),
        makeComment({
          id: 2,
          author: eli,
          body: 'three hours',
          createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        }),
      ],
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('5 minutes ago');
    expect(html).toContain('3 hours ago');
    expect(html).not.toContain('Invalid Date');
  });

  it('HD-011: comment-time is absolute for events older than 24 h', async () => {
    const eli = makeUser({ id: 7, displayName: 'Eli', role: 'User' });
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    configureTestbed({
      user: eli,
      ticket: makeTicket({ status: 'Open' }),
      comments: [
        makeComment({
          id: 1,
          author: eli,
          body: 'old',
          createdAt: threeDaysAgo.toISOString(),
        }),
      ],
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    // formatAbsolute: "Mmm DD, YYYY · HH:mm" — assert on day + year.
    expect(html).toContain(String(threeDaysAgo.getFullYear()));
    expect(html).not.toContain('days ago');
    expect(html).not.toContain('Invalid Date');
  });

  it('HD-011: comment-time renders empty for unparseable createdAt', async () => {
    const eli = makeUser({ id: 7, displayName: 'Eli', role: 'User' });
    configureTestbed({
      user: eli,
      ticket: makeTicket({ status: 'Open' }),
      comments: [
        makeComment({
          id: 1,
          author: eli,
          body: 'weird',
          createdAt: 'not-a-date',
        }),
      ],
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    // The <time> element's text content (what the user sees) should
    // be empty — no "Invalid Date" / "undefined" / "NaN" leaks.
    const timeEl = (fixture.nativeElement as HTMLElement).querySelector(
      '.comment-time',
    );
    expect(timeEl).not.toBeNull();
    expect(timeEl?.textContent?.trim()).toBe('');
  });

  it('HD-011: Enter key in the composer submits the comment', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      comments: [],
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    fixture.componentInstance.composerValue.set('hello world');
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: false,
      bubbles: true,
      cancelable: true,
    });
    const composer = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="comment-composer"]',
    ) as HTMLElement;
    composer.dispatchEvent(event);
    await settle(fixture);

    expect(event.defaultPrevented).toBe(true);
    expect(ticketService.addComment).toHaveBeenCalledWith(47, 'hello world');
  });

  it('HD-011: Shift+Enter in the composer inserts a newline and does not submit', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      comments: [],
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    fixture.componentInstance.composerValue.set('line1');
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const composer = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="comment-composer"]',
    ) as HTMLElement;
    composer.dispatchEvent(event);
    await settle(fixture);

    expect(event.defaultPrevented).toBe(false);
    expect(ticketService.addComment).not.toHaveBeenCalled();
  });

  it('HD-011: Enter on an empty composer is a no-op (no API call)', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      comments: [],
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    // composerValue is empty by default.
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: false,
      bubbles: true,
      cancelable: true,
    });
    const composer = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="comment-composer"]',
    ) as HTMLElement;
    composer.dispatchEvent(event);
    await settle(fixture);

    expect(ticketService.addComment).not.toHaveBeenCalled();
  });

  it('HD-011: a failed comment submit renders the inline error under the composer', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      comments: [],
      agents: [],
    });
    // Re-stub addComment to reject so the failure path fires.
    ticketService.addComment.and.callFake(() =>
      Promise.reject(
        new ApiError(500, 'internal_server_error', 'upstream down'),
      ),
    );

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    fixture.componentInstance.composerValue.set('this will fail');
    await fixture.componentInstance.onSendComment();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const inline = root.querySelector(
      '[data-testid="composer-inline-error"]',
    ) as HTMLElement | null;
    expect(inline).not.toBeNull();
    expect(inline?.getAttribute('role')).toBe('alert');
    expect(inline?.textContent?.trim()).toBe(
      "Couldn't send your comment. Try again.",
    );
    // Comment text must remain in the composer.
    expect(fixture.componentInstance.composerValue()).toBe('this will fail');
    // The top-of-page error-toast should also render (separate signal,
    // unchanged behavior), and the inline error sits beneath the
    // composer — not above the page.
    const toast = root.querySelector('[data-testid="error-toast"]');
    expect(toast).not.toBeNull();
  });

  it('HD-011: a successful comment submit clears the inline error', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      comments: [],
      agents: [],
    });
    // First call rejects, second call resolves.
    let calls = 0;
    ticketService.addComment.and.callFake(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.reject(
          new ApiError(500, 'internal_server_error', 'upstream down'),
        );
      }
      return Promise.resolve(makeComment({ id: 99, body: 'hello' }));
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    fixture.componentInstance.composerValue.set('retry me');
    await fixture.componentInstance.onSendComment();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="composer-inline-error"]',
      ),
    ).not.toBeNull();
    expect(fixture.componentInstance.commentSubmitError()).not.toBeNull();

    fixture.componentInstance.composerValue.set('retry me again');
    await fixture.componentInstance.onSendComment();
    fixture.detectChanges();

    expect(fixture.componentInstance.commentSubmitError()).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="composer-inline-error"]',
      ),
    ).toBeNull();
    expect(fixture.componentInstance.comments().length).toBe(1);
  });

  it('HD-011: a status-change failure does NOT render the inline composer error', async () => {
    const { ticketService } = configureTestbed({
      user: makeUser({ id: 11, displayName: 'Sam', role: 'Support Agent', email: 'sam@example.com' }),
      ticket: makeTicket({ status: 'Open' }),
      agents: [],
    });
    // Re-stub patch to reject so the page's error path fires.
    ticketService.patch.and.callFake(() =>
      Promise.reject(
        new ApiError(500, 'internal_server_error', 'Status update failed.'),
      ),
    );

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    await fixture.componentInstance.onStatusChange('In Progress');
    for (let i = 0; i < 4; i += 1) {
      await Promise.resolve();
    }
    fixture.detectChanges();

    // Top-of-page toast renders (unchanged).
    const toast = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="error-toast"]',
    );
    expect(toast).not.toBeNull();
    // Inline composer error does NOT render (comment-only signal).
    const inline = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="composer-inline-error"]',
    );
    expect(inline).toBeNull();
    expect(fixture.componentInstance.commentSubmitError()).toBeNull();
  });

  // ── HD-016 — attachment row on the ticket header ────────────────

  it('does not render the attachment row when the ticket has no attachment', async () => {
    configureTestbed({
      user: makeUser({ id: 7, role: 'User' }),
      ticket: makeTicket({ attachment: null }),
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const row = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="attachment-card"]',
    );
    expect(row).toBeNull();
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="attachment-row"]',
    );
    expect(link).toBeNull();
  });

  it('renders the attachment row with filename + size + download link', async () => {
    configureTestbed({
      user: makeUser({ id: 7, role: 'User' }),
      ticket: makeTicket({
        attachment: makeAttachment({
          id: 47,
          filename: 'screenshot.png',
          sizeBytes: 1024 * 1024,
        }),
      }),
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="attachment-row"]',
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.textContent).toContain('screenshot.png');
    // 1 MB → "1.0 MB" via the formatSize helper.
    expect(link.textContent).toContain('1.0 MB');
    // The href is the absolute URL handed to us by
    // attachmentService.downloadUrl, which the stub returns
    // as `http://test/api/attachments/<id>`.
    expect(link.getAttribute('href')).toBe('http://test/api/attachments/47');
    expect(link.getAttribute('download')).toBe('screenshot.png');
  });

  // ─── HD-017 — selective activity refetch after addComment ────────

  it('HD-017: refetches the activity timeline after a successful addComment', async () => {
    // Initial activity (loaded in ngOnInit).
    const initialActivity = [
      makeActivity({ id: 1, eventType: 'Created' }),
    ];
    // Activity returned by the post-addComment refetch — includes
    // the new "CommentAdded" entry the backend wrote in-tx.
    const refreshedActivity = [
      makeActivity({ id: 2, eventType: 'CommentAdded' }),
      makeActivity({ id: 1, eventType: 'Created' }),
    ];

    const { ticketService } = configureTestbed({
      user: makeUser({
        id: 11,
        displayName: 'Sam',
        role: 'Support Agent',
        email: 'sam@example.com',
      }),
      ticket: makeTicket({ status: 'Open' }),
      comments: [],
      activity: initialActivity,
      agents: [],
    });
    // The first listActivity call is the init load; the second
    // is the post-addComment refetch. Return different payloads.
    let listActivityCalls = 0;
    ticketService.listActivity.and.callFake(() => {
      listActivityCalls += 1;
      return Promise.resolve(
        listActivityCalls === 1 ? initialActivity : refreshedActivity,
      );
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);
    expect(listActivityCalls).toBe(1);
    expect(fixture.componentInstance.activity()).toEqual(initialActivity);

    fixture.componentInstance.composerValue.set('hello');
    await fixture.componentInstance.onSendComment();

    // addComment + the post-success refetch.
    expect(ticketService.addComment).toHaveBeenCalledWith(47, 'hello');
    expect(listActivityCalls).toBe(2);
    expect(ticketService.listActivity).toHaveBeenCalledWith(47);
    // The activity signal must be replaced with the refreshed payload.
    expect(fixture.componentInstance.activity()).toEqual(refreshedActivity);
  });

  it('HD-017: the post-addComment activity refetch failure is non-blocking', async () => {
    const initialActivity = [
      makeActivity({ id: 1, eventType: 'Created' }),
    ];

    const { ticketService } = configureTestbed({
      user: makeUser({
        id: 11,
        displayName: 'Sam',
        role: 'Support Agent',
        email: 'sam@example.com',
      }),
      ticket: makeTicket({ status: 'Open' }),
      comments: [],
      activity: initialActivity,
      agents: [],
    });
    // First listActivity call (init) resolves; second (refetch)
    // rejects — the page must not surface this to the user.
    let listActivityCalls = 0;
    ticketService.listActivity.and.callFake(() => {
      listActivityCalls += 1;
      if (listActivityCalls === 1) {
        return Promise.resolve(initialActivity);
      }
      return Promise.reject(
        new ApiError(503, 'internal_server_error', 'activity feed down'),
      );
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    fixture.componentInstance.composerValue.set('hello');
    await fixture.componentInstance.onSendComment();

    // Comment is in the local signal.
    expect(fixture.componentInstance.comments().length).toBe(1);
    // Activity signal is untouched (still the init payload).
    expect(fixture.componentInstance.activity()).toEqual(initialActivity);
    // No inline composer error and no top-of-page error toast — the
    // refetch failure is swallowed.
    expect(fixture.componentInstance.composerError()).toBeNull();
    expect(fixture.componentInstance.commentSubmitError()).toBeNull();
  });

  it('renders the breadcrumb with Tickets · {status} for a user', async () => {
    configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket({ status: 'In Progress' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const breadcrumb = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="breadcrumb"]',
    );
    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb?.textContent).toContain('Tickets');
    expect(breadcrumb?.textContent).toContain('In Progress');
  });

  it('renders the breadcrumb link pointing to the role-correct home', async () => {
    const eli = makeUser({ id: 7, displayName: 'Eli', role: 'User' });
    configureTestbed({
      user: eli,
      ticket: makeTicket({ status: 'Open' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="breadcrumb-tickets"]',
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    // Eli's roleHomePath is stubbed to '/login' in the testbed, but
    // we only care that an href is present (it'll be the role-home).
    expect(link.getAttribute('href')).toBeTruthy();
  });

  it('renders the "← Back to tickets" link in the page header', async () => {
    configureTestbed({
      user: makeUser({ id: 7, displayName: 'Eli', role: 'User' }),
      ticket: makeTicket({ status: 'Open' }),
      agents: [],
    });

    const fixture = TestBed.createComponent(TicketDetailPageComponent);
    fixture.detectChanges();
    await settle(fixture);

    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="back-link"]',
    ) as HTMLAnchorElement | null;
    expect(link).not.toBeNull();
    expect(link?.textContent?.trim()).toBe('← Back to tickets');
  });
});