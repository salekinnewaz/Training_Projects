/**
 * AgentKanbanPageComponent — HD-012.
 *
 * The /queue page Sam (Support Agent) lands on after login.
 *
 * Layout: 4-column GitHub-Issues-style Kanban board
 *   Open · In Progress · Resolved · Closed
 *
 * Per design-process/D-UX-Design/agent-kanban.md:
 *   - Orphans (Open + owner===null) pinned to the top of Open
 *     with the orphan tint.
 *   - HTML5 native drag-and-drop between columns for status
 *     transitions. Closed is read-only (draggable=false).
 *   - Filter strip: search (debounced 200ms) + priority + category
 *     + owner (Mine / Unassigned / agent id). State syncs to the
 *     URL via ?q=&priority=&category=&owner=.
 *   - Render states (mutually exclusive @switch):
 *       loading  → <loading-skeleton> + disabled filter strip
 *       error    → inline error card + retry
 *       success  → 4-column board with per-column empty markers
 *
 * Render-state machine lives in `renderState()`; the page is the
 * only place that may flip it.
 *
 * Drag-and-drop implementation:
 *   - Each kanban-card sets `draggable="true"`. The page listens
 *     to (dragstart) and stamps `event.dataTransfer.setData(...)`
 *     with a small JSON payload {ticketId, fromStatus}.
 *   - Each column body listens to (dragover) (preventDefault to
 *     permit drop), (dragenter) (highlight if valid), (dragleave)
 *     (clear highlight), and (drop).
 *   - Drop validation is matrix-driven (see `LEGAL_TRANSITIONS`);
 *     invalid drops animate a brief shake and never call PATCH.
 *   - Valid drops are optimistic: the card is moved in the local
 *     `tickets` signal first, then `PATCH /api/tickets/:id`
 *     {status: target} fires. On 200 the eager-loaded response
 *     replaces the local instance. On error the card reverts and a
 *     toast renders.
 *
 * URL persistence:
 *   - On init, queryParamMap is parsed into the four filter
 *     signals. Filters apply after the fetch resolves.
 *   - On filter change, `Router.navigate([], { queryParams,
 *     queryParamsHandling: 'merge' })` updates the URL without
 *     re-running resolvers. The search input is debounced 200ms;
 *     the priority / category / owner dropdowns update the URL
 *     immediately.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { UserService, type AgentSummary } from '../../services/user.service';
import { ApiError } from '../../services/api-error';

import type { Ticket } from '../../models/ticket';
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../models/enums';

import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { LoadingSkeletonComponent } from '../../components/patterns/loading-skeleton/loading-skeleton.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { SelectComponent, type SelectOption } from '../../components/atoms/select/select.component';
import { InputTextComponent } from '../../components/atoms/input-text/input-text.component';
import { KanbanCardComponent } from '../../components/molecules/kanban-card/kanban-card.component';

type RenderState = 'loading' | 'error' | 'success';

type OwnerFilter = 'all' | 'me' | 'unassigned' | string; // string = numeric agent id

const TICKET_MIME = 'application/x-helpdesk-ticket';

const COLUMNS: TicketStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All categories' },
  { value: 'IT', label: 'IT' },
  { value: 'HR', label: 'HR' },
  { value: 'Finance', label: 'Finance' },
  { value: 'General', label: 'General' },
];

/**
 * Legal transitions per the kickoff + ticket-detail Action Matrix.
 * Per spec: Agent cannot change Closed from any non-Resolved state,
 * so the only legal drop into Closed is from Resolved (but Resolved
 * drags are explicitly rejected — Agent cannot drag from Resolved;
 * that column awaits Eli's verdict).
 *
 *  from    →  allowed targets for Agent drag
 *  Open    →  {In Progress, Resolved}
 *  In Progress → {Open, Resolved}
 *  Resolved →  {} (no drag source for Agent)
 *  Closed  →  {} (read-only)
 */
const LEGAL_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  Open: ['In Progress', 'Resolved'],
  'In Progress': ['Open', 'Resolved'],
  Resolved: [],
  Closed: [],
};

const GENERIC_LOAD_ERROR = "Couldn't load the queue. Refresh to try again.";
const GENERIC_MOVE_ERROR = "Couldn't move the ticket. Try again.";

@Component({
  selector: 'app-agent-kanban-page',
  standalone: true,
  imports: [
    AppChromeComponent,
    LoadingSkeletonComponent,
    ButtonComponent,
    SelectComponent,
    InputTextComponent,
    KanbanCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome>
      <section class="kanban-page">
        <!-- Screen-reader live region for keyboard move-mode prompts.
             Visually hidden but exposed to AT. -->
        <div
          class="sr-only"
          aria-live="polite"
          aria-atomic="true"
          data-testid="move-mode-live"
        >{{ moveModeAnnouncement() }}</div>

        <header class="kanban-header">
          <h1>Queue</h1>
          <atom-button
            variant="secondary"
            size="md"
            data-testid="refresh-btn"
            (pressed)="refresh()"
            [disabled]="renderState() === 'loading'"
          >Refresh</atom-button>
        </header>

        @if (moveError(); as msg) {
          <div
            class="error-toast"
            role="alert"
            aria-live="polite"
            data-testid="move-error-toast"
          >{{ msg }}</div>
        }

        <div class="filter-strip" data-testid="filter-strip">
          <label class="filter-search">
            <span class="filter-label">Search</span>
            <atom-input
              id="filter-search"
              [value]="searchValue()"
              placeholder="Search…"
              [disabled]="renderState() === 'loading'"
              (valueChange)="onSearchInput($event)"
            />
          </label>

          <label class="filter-cell">
            <span class="filter-label">Priority</span>
            <atom-select
              id="filter-priority"
              [value]="priorityFilter()"
              [options]="priorityOptions"
              [disabled]="renderState() === 'loading'"
              (valueChange)="onPriorityChange($event)"
            />
          </label>

          <label class="filter-cell">
            <span class="filter-label">Status</span>
            <atom-select
              id="filter-status"
              [value]="statusFilter()"
              [options]="statusOptions"
              [disabled]="renderState() === 'loading'"
              (valueChange)="onStatusChange($event)"
            />
          </label>

          <label class="filter-cell">
            <span class="filter-label">Category</span>
            <atom-select
              id="filter-category"
              [value]="categoryFilter()"
              [options]="categoryOptions"
              [disabled]="renderState() === 'loading'"
              (valueChange)="onCategoryChange($event)"
            />
          </label>

          <label class="filter-cell">
            <span class="filter-label">Owner</span>
            <atom-select
              id="filter-owner"
              [value]="ownerFilter()"
              [options]="ownerOptions()"
              [disabled]="renderState() === 'loading'"
              (valueChange)="onOwnerChange($event)"
            />
          </label>

          @if (hasActiveFilter()) {
            <button
              type="button"
              class="clear-link"
              data-testid="clear-filters-btn"
              (click)="clearFilters()"
            >× Clear filters</button>
          }
        </div>

        @switch (renderState()) {
          @case ('loading') {
            <loading-skeleton [rows]="5" />
          }
          @case ('error') {
            <div class="state-card" role="alert" data-testid="queue-error-card">
              <h2 class="title">{{ errorMessage() }}</h2>
              <atom-button
                variant="primary"
                size="md"
                data-testid="retry-btn"
                (pressed)="refresh()"
              >Retry</atom-button>
            </div>
          }
          @case ('success') {
            <div class="board" data-testid="kanban-board">
              @for (status of columns; track status) {
                <section
                  class="column"
                  [class.column-targeted]="isColumnTargeted(status)"
                  [attr.data-status]="status"
                  [attr.data-empty]="columnsByStatus()[status].length === 0 ? 'true' : 'false'"
                  [attr.data-readonly]="isReadOnlyColumn(status) ? 'true' : 'false'"
                  [attr.data-targeted]="isColumnTargeted(status) ? 'true' : 'false'"
                  data-testid="kanban-column"
                >
                  <header class="column-header">
                    <h2 class="column-title">{{ status }}</h2>
                    <span
                      class="column-count"
                      data-testid="column-count"
                    >{{ columnsByStatus()[status].length }}</span>
                  </header>
                  <div
                    class="column-body"
                    [class.readonly]="isReadOnlyColumn(status)"
                    [class.empty]="columnsByStatus()[status].length === 0"
                    (dragover)="onDragOver($event)"
                    (dragenter)="onDragEnter($event, status)"
                    (dragleave)="onDragLeave($event)"
                    (drop)="onDrop($event, status)"
                    [attr.data-drag-over]="dragOverColumn() === status ? 'true' : 'false'"
                    [attr.data-drag-invalid]="invalidDropColumn() === status ? 'true' : 'false'"
                  >
                    @if (columnsByStatus()[status].length === 0) {
                      <p
                        class="column-empty"
                        data-testid="column-empty"
                      >{{ emptyMarker(status) }}</p>
                    } @else {
                      @for (t of columnsByStatus()[status]; track t.id) {
                        <div
                          class="card-slot"
                          [class.card-slot--moving]="isCardInMoveMode(t.id)"
                          [attr.data-ticket-id]="t.id"
                          [attr.data-moving]="isCardInMoveMode(t.id) ? 'true' : 'false'"
                          [attr.tabindex]="0"
                          [attr.role]="'button'"
                          [attr.aria-label]="
                            'Ticket ' + t.number + ', ' + t.title +
                            ', status ' + t.status + ', priority ' + t.priority +
                            '. Press M to move.'
                          "
                          (dragstart)="onDragStart($event, t)"
                          (dragend)="onDragEnd()"
                          (click)="onCardClick(t)"
                          (keydown)="onKeydown($event, t.id)"
                        >
                          <kanban-card
                            [ticket]="t"
                            [isDragDisabled]="isReadOnlyColumn(status)"
                            [isOrphan]="isOrphanPin(t, status)"
                          />
                        </div>
                      }
                    }
                  </div>
                  @if (status === 'Closed' && columnsByStatus()[status].length > 0 && statusFilter() === 'all') {
                    <footer class="column-footer" data-testid="closed-view-list">
                      <a
                        class="view-list-link"
                        href="/tickets?status=Closed"
                        data-testid="closed-view-list-link"
                      >View list →</a>
                    </footer>
                  }
                </section>
              }
            </div>
          }
        }
      </section>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
    }
    .kanban-page {
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
    }
    .kanban-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
    }
    .kanban-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }
    .error-toast {
      background: var(--color-surface);
      border: 1px solid #FECACA;
      border-left: 4px solid var(--color-error);
      border-radius: 10px;
      padding: 12px 16px;
      color: var(--color-error);
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 16px;
      box-shadow: var(--shadow-card);
      animation: fadeInUp var(--duration-base) var(--ease-out) both;
    }
    .filter-strip {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 20px;
      padding: 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 14px;
      box-shadow: var(--shadow-card);
      flex-wrap: wrap;
    }
    .filter-strip > * {
      min-width: 0;
    }
    .filter-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-muted);
      margin-bottom: 6px;
    }
    .filter-search {
      flex: 1 1 240px;
      min-width: 200px;
    }
    .filter-cell {
      flex: 0 0 auto;
      width: 180px;
    }
    .clear-link {
      align-self: flex-end;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--color-primary);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      min-height: var(--field-height, 40px);
      line-height: var(--field-height, 40px);
      transition: color var(--duration-fast) var(--ease-out);
    }
    .clear-link:hover {
      color: var(--color-primary-deep);
    }
    .clear-link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-primary-ring);
      border-radius: 6px;
    }
    .state-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 14px;
      padding: 40px 32px;
      box-sizing: border-box;
      text-align: center;
      max-width: 480px;
      margin: 48px auto;
      box-shadow: var(--shadow-card);
    }
    .state-card .title {
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text);
    }
    .column {
      display: flex;
      flex-direction: column;
      min-height: 320px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 14px;
      box-shadow: var(--shadow-card);
      transition:
        box-shadow var(--duration-base) var(--ease-out),
        transform var(--duration-base) var(--ease-out);
    }
    .column-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--color-border-subtle);
      transition: background-color var(--duration-base) var(--ease-out);
    }
    .column-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.01em;
    }
    .column-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 8px;
      background: var(--color-page-bg);
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 700;
      border-radius: 999px;
    }
    .column-body {
      flex: 1 1 auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition:
        background-color var(--duration-base) var(--ease-out),
        box-shadow var(--duration-base) var(--ease-out);
    }
    .column-body[data-drag-over="true"] {
      background: var(--color-primary-soft-tint, rgba(99, 102, 241, 0.06));
      box-shadow: inset 0 0 0 2px var(--color-primary);
      border-radius: 0 0 14px 14px;
    }
    .column-body[data-drag-invalid="true"] {
      background: rgba(239, 68, 68, 0.06);
      box-shadow: inset 0 0 0 2px var(--color-error);
      border-radius: 0 0 14px 14px;
      animation: shake 220ms ease-in-out;
    }
    .column-body.readonly {
      background: var(--color-page-bg);
    }
    .column-empty {
      margin: auto 0;
      padding: 24px 12px;
      font-size: 13px;
      color: var(--color-muted);
      text-align: center;
    }
    .card-slot {
      cursor: pointer;
      border-radius: 12px;
    }
    .column-footer {
      padding: 10px 12px;
      border-top: 1px solid var(--color-border-subtle);
      text-align: center;
    }
    .view-list-link {
      color: var(--color-primary);
      font-size: 12px;
      text-decoration: none;
      font-weight: 600;
      transition: color var(--duration-fast) var(--ease-out);
    }
    .view-list-link:hover {
      color: var(--color-primary-deep);
    }
    .view-list-link:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--color-primary-ring);
      border-radius: 4px;
    }
    /* Keyboard move-mode — give the focused/active card a subtle
       outline + crosshair so it's visible which card the keys
       are operating on. */
    .card-slot--moving {
      outline: 2px dashed var(--color-primary);
      outline-offset: 4px;
      border-radius: 12px;
      cursor: crosshair;
    }
    .card-slot--moving:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 4px;
    }
    /* When a column is the current keyboard-move target, paint
       a soft tint so the user knows where Enter will land. */
    .column-targeted > .column-header {
      background: rgba(99, 102, 241, 0.06);
      border-radius: 14px 14px 0 0;
    }
    .column-targeted > .column-body {
      box-shadow: inset 0 0 0 2px var(--color-primary);
      border-radius: 0 0 14px 14px;
    }
    /* Visually hidden but available to assistive tech. */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-2px); }
      80% { transform: translateX(2px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .error-toast,
      .column-body[data-drag-invalid="true"] {
        animation: none;
      }
    }
  `],
})
export class AgentKanbanPageComponent implements OnInit, OnDestroy {
  private readonly ticketService = inject(TicketService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly columns = COLUMNS;
  readonly priorityOptions = PRIORITY_OPTIONS;
  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly statusOptions = STATUS_OPTIONS;

  // Render-state machine.
  readonly renderState = signal<RenderState>('loading');
  readonly errorMessage = signal<string | null>(null);
  readonly moveError = signal<string | null>(null);

  // Source data.
  readonly tickets = signal<Ticket[]>([]);
  readonly agents = signal<AgentSummary[]>([]);

  // Filter signals.
  readonly searchValue = signal<string>('');
  readonly priorityFilter = signal<'all' | TicketPriority>('all');
  readonly categoryFilter = signal<'all' | TicketCategory>('all');
  readonly ownerFilter = signal<OwnerFilter>('all');
  readonly statusFilter = signal<'all' | TicketStatus>('all');

  // Drag-state.
  private draggingTicket: Ticket | null = null;
  readonly dragOverColumn = signal<TicketStatus | null>(null);
  readonly invalidDropColumn = signal<TicketStatus | null>(null);
  private invalidDropTimer?: ReturnType<typeof setTimeout>;

  // Search debounce.
  private searchDebounceTimer?: ReturnType<typeof setTimeout>;

  // System-error toast (auto-dismiss after 5s per EXPERIENCE.md).
  private errorTimer?: ReturnType<typeof setTimeout>;

  // Keyboard move-mode (accessibility fallback for drag-and-drop).
  // When set, the matching card is in "move mode" — the user picks
  // a target column via 1-4 / arrow keys, then Enter to commit,
  // Esc to cancel. The aria-live region announces the prompt.
  readonly movingTicketId = signal<number | null>(null);
  readonly moveTargetStatus = signal<TicketStatus | null>(null);
  readonly moveModeAnnouncement = signal<string>('');

  /**
   * Set the system-error toast message. The toast auto-dismisses
   * after 5s; subsequent setError() calls cancel the prior timer
   * so the latest message gets a fresh 5s window.
   */
  setError(msg: string): void {
    this.moveError.set(msg);
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => {
      this.moveError.set(null);
      this.errorTimer = undefined;
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.errorTimer) clearTimeout(this.errorTimer);
  }

  /**
   * All tickets that pass every active filter, partitioned into
   * the four columns by status. Computed on demand so any filter
   * change + any drag-and-drop local signal update redraws the
   * board without a manual recompute call.
   *
   * Within-column ordering:
   *   Open / In Progress / Resolved → createdAt ASC (oldest first;
   *     "aging tickets float up" per the UX spec).
   *   Closed → createdAt DESC (newest first; tail of scan).
   *   Open column additionally pins `owner === null` to the top so
   *     orphans surface instantly.
   */
  readonly columnsByStatus = computed<Record<TicketStatus, Ticket[]>>(() => {
    const filtered = this.applyFilters(this.tickets());
    const buckets: Record<TicketStatus, Ticket[]> = {
      Open: [],
      'In Progress': [],
      Resolved: [],
      Closed: [],
    };
    for (const t of filtered) {
      buckets[t.status].push(t);
    }
    const ascending = (a: Ticket, b: Ticket) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    const descending = (a: Ticket, b: Ticket) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    buckets.Open.sort((a, b) => {
      // Orphans first (owner === null), then createdAt ASC.
      const aOrphan = a.owner === null ? 0 : 1;
      const bOrphan = b.owner === null ? 0 : 1;
      if (aOrphan !== bOrphan) return aOrphan - bOrphan;
      return ascending(a, b);
    });
    buckets['In Progress'].sort(ascending);
    buckets.Resolved.sort(ascending);
    buckets.Closed.sort(descending);
    return buckets;
  });

  readonly ownerOptions = computed<SelectOption[]>(() => {
    const me = this.authService.userSnapshot()?.id.toString() ?? 'me';
    const opts: SelectOption[] = [
      { value: 'all', label: 'All owners' },
      { value: 'me', label: 'Mine' },
      { value: 'unassigned', label: 'Unassigned' },
    ];
    // Each active agent gets an option keyed by numeric id.
    for (const agent of this.agents()) {
      // Avoid duplicating "Mine" if the current user is in the list.
      if (agent.id.toString() === me) continue;
      opts.push({ value: agent.id.toString(), label: agent.displayName });
    }
    return opts;
  });

  readonly hasActiveFilter = computed(() => {
    return (
      this.searchValue().trim() !== '' ||
      this.priorityFilter() !== 'all' ||
      this.categoryFilter() !== 'all' ||
      this.ownerFilter() !== 'all' ||
      this.statusFilter() !== 'all'
    );
  });

  ngOnInit(): void {
    // Read initial filter state from the URL.
    const params = this.route.snapshot.queryParamMap;
    const q = params.get('q');
    const priority = params.get('priority');
    const category = params.get('category');
    const owner = params.get('owner');
    const status = params.get('status');
    if (q !== null) this.searchValue.set(q);
    if (priority === 'High' || priority === 'Medium' || priority === 'Low') {
      this.priorityFilter.set(priority);
    }
    if (
      category === 'IT' ||
      category === 'HR' ||
      category === 'Finance' ||
      category === 'General'
    ) {
      this.categoryFilter.set(category);
    }
    if (owner === 'me' || owner === 'unassigned' || /^\d+$/.test(owner ?? '')) {
      this.ownerFilter.set(owner as OwnerFilter);
    }
    if (
      status === 'Open' ||
      status === 'In Progress' ||
      status === 'Resolved' ||
      status === 'Closed'
    ) {
      this.statusFilter.set(status);
    }

    void this.load();

    this.destroyRef.onDestroy(() => {
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      if (this.invalidDropTimer) clearTimeout(this.invalidDropTimer);
    });
  }

  // ─── Render lifecycle ────────────────────────────────────────────

  refresh(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.renderState.set('loading');
    this.errorMessage.set(null);
    try {
      const [list, agents] = await Promise.all([
        this.ticketService.listForQueue(),
        this.userService.listAgents().catch(() => []),
      ]);
      this.tickets.set(list);
      this.agents.set(agents);
      this.renderState.set('success');
    } catch (err) {
      // 401 → silent sign-out handled by the auth interceptor;
      // the rest is a generic failure.
      if (err instanceof ApiError && err.status === 401) {
        this.errorMessage.set('Your session expired. Please sign in again.');
      } else {
        this.errorMessage.set(GENERIC_LOAD_ERROR);
      }
      this.renderState.set('error');
    }
  }

  // ─── Filter handlers ─────────────────────────────────────────────

  onSearchInput(value: string): void {
    // Local signal updates immediately so the UI feels responsive;
    // the URL (and the formal "search query") is debounced 200ms
    // so a flurry of keystrokes doesn't spam history entries.
    this.searchValue.set(value);
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      void this.syncFiltersToUrl({ q: value.trim() === '' ? null : value.trim() });
    }, 200);
  }

  onPriorityChange(value: string): void {
    const next: 'all' | TicketPriority =
      value === 'High' || value === 'Medium' || value === 'Low'
        ? value
        : 'all';
    this.priorityFilter.set(next);
    void this.syncFiltersToUrl({
      priority: next === 'all' ? null : next,
    });
  }

  onCategoryChange(value: string): void {
    const next: 'all' | TicketCategory =
      value === 'IT' || value === 'HR' || value === 'Finance' || value === 'General'
        ? value
        : 'all';
    this.categoryFilter.set(next);
    void this.syncFiltersToUrl({
      category: next === 'all' ? null : next,
    });
  }

  onOwnerChange(value: string): void {
    const next: OwnerFilter =
      value === 'me' || value === 'unassigned' || value === 'all' || /^\d+$/.test(value)
        ? value
        : 'all';
    this.ownerFilter.set(next);
    const param =
      next === 'all' ? null : next;
    void this.syncFiltersToUrl({ owner: param });
  }

  onStatusChange(value: string): void {
    const next: 'all' | TicketStatus =
      value === 'Open' || value === 'In Progress' || value === 'Resolved' || value === 'Closed'
        ? value
        : 'all';
    this.statusFilter.set(next);
    void this.syncFiltersToUrl({
      status: next === 'all' ? null : next,
    });
  }

  clearFilters(): void {
    this.searchValue.set('');
    this.priorityFilter.set('all');
    this.categoryFilter.set('all');
    this.ownerFilter.set('all');
    this.statusFilter.set('all');
    void this.syncFiltersToUrl({
      q: null,
      priority: null,
      category: null,
      owner: null,
      status: null,
    });
  }

  private async syncFiltersToUrl(updates: {
    q?: string | null;
    priority?: string | null;
    category?: string | null;
    owner?: string | null;
    status?: string | null;
  }): Promise<void> {
    const queryParams: Record<string, string | null> = {};
    if (updates.q !== undefined) queryParams['q'] = updates.q;
    if (updates.priority !== undefined) queryParams['priority'] = updates.priority;
    if (updates.category !== undefined) queryParams['category'] = updates.category;
    if (updates.owner !== undefined) queryParams['owner'] = updates.owner;
    if (updates.status !== undefined) queryParams['status'] = updates.status;
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  // ─── Filtering ───────────────────────────────────────────────────

  private applyFilters(input: Ticket[]): Ticket[] {
    const q = this.searchValue().trim().toLowerCase();
    const priority = this.priorityFilter();
    const category = this.categoryFilter();
    const owner = this.ownerFilter();
    const status = this.statusFilter();
    const meId = this.authService.userSnapshot()?.id;

    return input.filter((t) => {
      if (priority !== 'all' && t.priority !== priority) return false;
      if (category !== 'all' && t.category !== category) return false;
      if (status !== 'all' && t.status !== status) return false;
      if (owner === 'unassigned' && t.owner !== null) return false;
      if (owner === 'me') {
        if (meId === undefined || t.owner?.id !== meId) return false;
      } else if (owner !== 'all' && /^\d+$/.test(owner)) {
        if (t.owner?.id.toString() !== owner) return false;
      }
      if (q !== '') {
        const hay = `${t.number} ${t.title} ${t.submitter.displayName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // ─── Column helper accessors (template-only) ─────────────────────

  isReadOnlyColumn(status: TicketStatus): boolean {
    // Closed is read-only end-to-end (drag-in + drag-out disabled).
    return status === 'Closed';
  }

  isOrphanPin(ticket: Ticket, status: TicketStatus): boolean {
    // Orphans are only "pinned" in the Open column. Other columns
    // render null-owner tickets flat in createdAt-ASC order.
    return status === 'Open' && ticket.owner === null;
  }

  emptyMarker(status: TicketStatus): string {
    if (this.hasActiveFilter()) {
      return 'No tickets match your filters.';
    }
    return 'Nothing here.';
  }

  // ─── Drag-and-drop ───────────────────────────────────────────────

  onDragStart(event: DragEvent, ticket: Ticket): void {
    if (!event.dataTransfer) return;
    this.draggingTicket = ticket;
    event.dataTransfer.setData(
      TICKET_MIME,
      JSON.stringify({ ticketId: ticket.id, fromStatus: ticket.status }),
    );
    // The spec calls for an opaque ghost-style cursor; setting
    // effectAllowed lets the browser render its native drag image
    // while we keep the wire payload as the source of truth.
    event.dataTransfer.effectAllowed = 'move';
    // Mark source column as well — it stays put while dragActive.
    this.moveError.set(null);
  }

  onDragEnd(): void {
    this.draggingTicket = null;
    this.dragOverColumn.set(null);
    this.invalidDropColumn.set(null);
  }

  onDragOver(event: DragEvent): void {
    // Required to permit drop. preventDefault must be called in
    // dragover (not just drop) for the drop event to fire.
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragEnter(event: DragEvent, status: TicketStatus): void {
    event.preventDefault();
    if (!this.draggingTicket) return;
    const valid = this.isLegalTransition(
      this.draggingTicket.status,
      status,
    );
    if (valid) {
      this.dragOverColumn.set(status);
      this.invalidDropColumn.set(null);
    } else {
      this.dragOverColumn.set(null);
      this.invalidDropColumn.set(status);
    }
  }

  onDragLeave(event: DragEvent): void {
    // Only clear the highlight if the leave event is actually leaving
    // the column body (not bouncing off a child card). relatedTarget
    // is the element being entered; if it's null or outside the
    // current target's subtree, the leave is real.
    const related = event.relatedTarget as Node | null;
    const target = event.currentTarget as HTMLElement | null;
    if (target && related && target.contains(related)) {
      return;
    }
    if (this.dragOverColumn() !== null) {
      this.dragOverColumn.set(null);
    }
    if (this.invalidDropColumn() !== null) {
      this.invalidDropColumn.set(null);
    }
  }

  async onDrop(event: DragEvent, targetStatus: TicketStatus): Promise<void> {
    event.preventDefault();
    const ticket = this.draggingTicket;
    this.dragOverColumn.set(null);
    this.invalidDropColumn.set(null);
    this.draggingTicket = null;
    if (!ticket) return;
    if (ticket.status === targetStatus) return;

    if (!this.isLegalTransition(ticket.status, targetStatus)) {
      this.flagInvalidDrop(targetStatus);
      return;
    }

    // Optimistic move: patch the local signal first so the card
    // jumps to the new column on the next render. If PATCH fails,
    // we revert to the original status.
    const fromStatus = ticket.status;
    this.moveTicketLocally(ticket.id, targetStatus);
    try {
      const updated = await this.ticketService.patch(ticket.id, {
        status: targetStatus,
      });
      // Replace the locally-cached instance with the eager-loaded
      // response so subsequent renders reflect server-side state
      // (timestamps / activity log merges etc.).
      this.replaceTicketLocally(updated);
    } catch {
      this.moveTicketLocally(ticket.id, fromStatus);
      this.setError(GENERIC_MOVE_ERROR);
    }
  }

  private flagInvalidDrop(status: TicketStatus): void {
    this.invalidDropColumn.set(status);
    if (this.invalidDropTimer) clearTimeout(this.invalidDropTimer);
    this.invalidDropTimer = setTimeout(() => {
      this.invalidDropColumn.set(null);
    }, 600);
  }

  private isLegalTransition(from: TicketStatus, to: TicketStatus): boolean {
    return (LEGAL_TRANSITIONS[from] ?? []).includes(to);
  }

  private moveTicketLocally(ticketId: number, status: TicketStatus): void {
    const next = this.tickets().map((t) =>
      t.id === ticketId ? { ...t, status } : t,
    );
    this.tickets.set(next);
  }

  private replaceTicketLocally(updated: Ticket): void {
    const next = this.tickets().map((t) => (t.id === updated.id ? updated : t));
    this.tickets.set(next);
  }

  // ─── Keyboard move-mode (a11y fallback for drag-and-drop) ─────────

  /**
   * Mapped from a 1-based column index to its status. The order
   * matches `COLUMNS` so screen-reader / keyboard users get a
   * predictable, column-ordered enumeration (Open = 1, Closed = 4).
   */
  private readonly columnByIndex: TicketStatus[] = COLUMNS;

  /**
   * Per EXPERIENCE.md §"Accessibility Floor":
   *   "Drag-and-drop has a keyboard fallback: select card,
   *    press M to move, arrow keys to choose column, Enter to
   *    confirm."
   *
   * Key map:
   *   M       → open move mode (only when not already in it)
   *   1-4     → pick target column by index
   *   ←/→     → cycle target column left/right
   *   Enter   → commit the move (same code path as a successful drop)
   *   Esc     → cancel and exit move mode
   */
  onKeydown(event: KeyboardEvent, ticketId: number): void {
    const key = event.key;
    // Don't intercept while a modifier is held — let the browser
    // do its normal thing (Cmd+R, Ctrl+M, etc.).
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const inMoveMode = this.movingTicketId() === ticketId;

    if (!inMoveMode) {
      if (key === 'm' || key === 'M') {
        event.preventDefault();
        this.enterMoveMode(ticketId);
      }
      return;
    }

    // Inside move mode — every relevant key consumes the event so
    // the browser doesn't fire a stray click / submit.
    event.preventDefault();

    if (key === 'Escape') {
      this.exitMoveMode();
      return;
    }

    if (key === 'Enter') {
      void this.commitKeyboardMove(ticketId);
      return;
    }

    if (key >= '1' && key <= '4') {
      const idx = parseInt(key, 10) - 1;
      const target = this.columnByIndex[idx];
      if (target) this.setMoveTarget(ticketId, target);
      return;
    }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const current = this.moveTargetStatus();
      const currentIdx = current
        ? this.columnByIndex.indexOf(current)
        : 0;
      const delta = key === 'ArrowRight' ? 1 : -1;
      const nextIdx =
        (currentIdx + delta + this.columnByIndex.length) %
        this.columnByIndex.length;
      const target = this.columnByIndex[nextIdx]!;
      this.setMoveTarget(ticketId, target);
      return;
    }
  }

  /** True when the given card is currently the one in move mode. */
  isCardInMoveMode(ticketId: number): boolean {
    return this.movingTicketId() === ticketId;
  }

  /** True when the given column is the currently selected target. */
  isColumnTargeted(status: TicketStatus): boolean {
    return (
      this.movingTicketId() !== null &&
      this.moveTargetStatus() === status
    );
  }

  /** True when a move-mode session is in progress on this card. */
  isMoveModeActiveFor(ticketId: number): boolean {
    return this.movingTicketId() === ticketId;
  }

  private enterMoveMode(ticketId: number): void {
    const ticket = this.tickets().find((t) => t.id === ticketId);
    if (!ticket) return;
    this.movingTicketId.set(ticketId);
    // Default the target to the first legal transition; if none,
    // default to the next column in the cycle so a power-user
    // can still pick a target manually.
    const legal = LEGAL_TRANSITIONS[ticket.status] ?? [];
    const initialTarget =
      legal[0] ?? this.nextColumnOf(ticket.status) ?? ticket.status;
    this.setMoveTarget(ticketId, initialTarget);
  }

  private setMoveTarget(ticketId: number, target: TicketStatus): void {
    this.moveTargetStatus.set(target);
    const ticket = this.tickets().find((t) => t.id === ticketId);
    if (!ticket) return;
    const legal = this.isLegalTransition(ticket.status, target);
    const suffix = legal
      ? `Target ${target} selected.`
      : `Target ${target} is not a legal transition from ${ticket.status}.`;
    this.moveModeAnnouncement.set(
      `Move mode active for ticket ${ticket.number}. ` +
        `Press 1 for Open, 2 for In Progress, 3 for Resolved, 4 for Closed. ` +
        `Enter to confirm, Esc to cancel. ${suffix}`,
    );
  }

  private exitMoveMode(): void {
    this.movingTicketId.set(null);
    this.moveTargetStatus.set(null);
    this.moveModeAnnouncement.set('Move mode cancelled.');
  }

  private nextColumnOf(status: TicketStatus): TicketStatus | null {
    const i = this.columnByIndex.indexOf(status);
    if (i < 0) return null;
    return this.columnByIndex[(i + 1) % this.columnByIndex.length] ?? null;
  }

  /** Same optimistic-move + PATCH + revert pipeline as a drop event. */
  private async commitKeyboardMove(ticketId: number): Promise<void> {
    const ticket = this.tickets().find((t) => t.id === ticketId);
    const target = this.moveTargetStatus();
    if (!ticket || !target) {
      this.exitMoveMode();
      return;
    }
    this.exitMoveMode();

    if (ticket.status === target) return;
    if (!this.isLegalTransition(ticket.status, target)) {
      this.setError(
        `Can't move ticket from ${ticket.status} to ${target}.`,
      );
      return;
    }

    const fromStatus = ticket.status;
    this.moveTicketLocally(ticket.id, target);
    try {
      const updated = await this.ticketService.patch(ticket.id, {
        status: target,
      });
      this.replaceTicketLocally(updated);
    } catch {
      this.moveTicketLocally(ticket.id, fromStatus);
      this.setError(GENERIC_MOVE_ERROR);
    }
  }

  // ─── Card click ──────────────────────────────────────────────────

  onCardClick(ticket: Ticket): void {
    void this.router.navigateByUrl(`/tickets/${ticket.id}`);
  }
}
