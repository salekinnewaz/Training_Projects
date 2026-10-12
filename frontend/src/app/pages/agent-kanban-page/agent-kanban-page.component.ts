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
                  [attr.data-status]="status"
                  [attr.data-empty]="columnsByStatus()[status].length === 0 ? 'true' : 'false'"
                  [attr.data-readonly]="isReadOnlyColumn(status) ? 'true' : 'false'"
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
                          [attr.data-ticket-id]="t.id"
                          (dragstart)="onDragStart($event, t)"
                          (dragend)="onDragEnd()"
                          (click)="onCardClick(t)"
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
      margin-bottom: 16px;
    }
    .kanban-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: var(--color-primary);
    }
    .error-toast {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-left: 4px solid var(--color-error);
      border-radius: 6px;
      padding: 10px 14px;
      color: var(--color-error);
      font-size: 14px;
      margin-bottom: 16px;
    }
    .filter-strip {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .filter-strip > * {
      min-width: 0;
    }
    .filter-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-muted);
      margin-bottom: 4px;
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
      cursor: pointer;
      text-decoration: underline;
      min-height: var(--field-height, 40px);
      line-height: var(--field-height, 40px);
    }
    .clear-link:focus-visible {
      outline: var(--focus-ring-width) solid var(--focus-ring-color);
      outline-offset: 2px;
    }
    .state-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 32px;
      box-sizing: border-box;
      text-align: center;
      max-width: 480px;
      margin: 32px auto;
    }
    .state-card .title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-primary);
    }
    .column-empty {
      margin: 0;
      font-size: 13px;
      color: var(--color-muted);
      text-align: center;
    }
    .card-slot {
      cursor: pointer;
    }
  `],
})
export class AgentKanbanPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly columns = COLUMNS;
  readonly priorityOptions = PRIORITY_OPTIONS;
  readonly categoryOptions = CATEGORY_OPTIONS;

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

  // Drag-state.
  private draggingTicket: Ticket | null = null;
  readonly dragOverColumn = signal<TicketStatus | null>(null);
  readonly invalidDropColumn = signal<TicketStatus | null>(null);
  private invalidDropTimer?: ReturnType<typeof setTimeout>;

  // Search debounce.
  private searchDebounceTimer?: ReturnType<typeof setTimeout>;

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
      this.ownerFilter() !== 'all'
    );
  });

  ngOnInit(): void {
    // Read initial filter state from the URL.
    const params = this.route.snapshot.queryParamMap;
    const q = params.get('q');
    const priority = params.get('priority');
    const category = params.get('category');
    const owner = params.get('owner');
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

  clearFilters(): void {
    this.searchValue.set('');
    this.priorityFilter.set('all');
    this.categoryFilter.set('all');
    this.ownerFilter.set('all');
    void this.syncFiltersToUrl({
      q: null,
      priority: null,
      category: null,
      owner: null,
    });
  }

  private async syncFiltersToUrl(updates: {
    q?: string | null;
    priority?: string | null;
    category?: string | null;
    owner?: string | null;
  }): Promise<void> {
    const queryParams: Record<string, string | null> = {};
    if (updates.q !== undefined) queryParams['q'] = updates.q;
    if (updates.priority !== undefined) queryParams['priority'] = updates.priority;
    if (updates.category !== undefined) queryParams['category'] = updates.category;
    if (updates.owner !== undefined) queryParams['owner'] = updates.owner;
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
    const meId = this.authService.userSnapshot()?.id;

    return input.filter((t) => {
      if (priority !== 'all' && t.priority !== priority) return false;
      if (category !== 'all' && t.category !== category) return false;
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
      this.moveError.set(GENERIC_MOVE_ERROR);
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

  // ─── Card click ──────────────────────────────────────────────────

  onCardClick(ticket: Ticket): void {
    void this.router.navigateByUrl(`/tickets/${ticket.id}`);
  }
}
