/**
 * TicketDetailPageComponent — HD-010.
 *
 * GitHub-Issues-style detail page (`/tickets/:id`).
 *
 * Sections:
 *   - Title + #HD-<n> + 4-column meta grid (Status / Priority /
 *     Category / Assignee) with `<atom-select>` dropdowns gated
 *     per role.
 *   - Description card.
 *   - Comments thread (oldest-first) + composer.
 *   - Activity timeline (newest-first) below.
 *
 * Render states (mutually exclusive `@switch`):
 *   loading  → <loading-skeleton>
 *   notFound → "Ticket not found" card
 *   error    → "Couldn't load this ticket" card
 *   success  → full detail view
 *
 * Role-aware controls (computed):
 *   - isAgent              → Support Agent or Admin
 *   - canEditMeta          → agent only (Status / Priority / Assignee)
 *   - canEditCategory      → false for everyone (UX decision — User
 *                            doesn't get inline edit on category)
 *   - canReopen            → User AND submitter AND status=Resolved
 *   - canConfirmClose      → submitter AND status=Resolved
 *   - canSelfAssign        → agent AND not the current owner
 *   - isClosed             → ticket.status === 'Closed'
 *   - canComment           → not Closed
 *
 * Self-assign: hidden when the agent IS the owner, when the ticket
 * is Closed, and for Users. The page sets a `currentUser` signal
 * from AuthService at init time.
 *
 * Reopen is gated behind a `<dialog-modal>` confirmation; the spec
 * mandates the dialog copy verbatim:
 *   "This will reopen the ticket. Previous conversation and
 *    history will be kept."
 *
 * Confirm-and-close is one-click — no modal per spec.
 *
 * On any mutation that the backend accepts (200/201), the local
 * `ticket` signal is replaced with the response. The activity
 * timeline is NOT refetched; the spec says "no realtime updates"
 * and the page trusts the local signal until the user reloads.
 *
 * Lifecycle:
 *   - ngOnInit parses `:id`, navigates to `/dashboard` on NaN.
 *   - Loads ticket / comments / activity / agents in parallel after
 *     auth settles. Agents failure is a graceful degradation (only
 *     "Unassigned" in the assignee dropdown). Ticket / comments /
 *     activity failure maps to the error / notFound render states.
 *
 * Mirrors the HD-009 submission-confirmation-page signal-state
 * pattern: loading | notFound | error | success @switch + DestroyRef
 * for cleanup.
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
import type { ActivityLog } from '../../models/activity-log';
import type { Comment } from '../../models/comment';
import type { Ticket } from '../../models/ticket';
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserRole,
} from '../../models/enums';
import type { UserPublic } from '../../models/user';

import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { LoadingSkeletonComponent } from '../../components/patterns/loading-skeleton/loading-skeleton.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { SelectComponent, type SelectOption } from '../../components/atoms/select/select.component';
import { TextareaComponent } from '../../components/atoms/textarea/textarea.component';
import { ChromeAvatarComponent } from '../../components/atoms/chrome-avatar/chrome-avatar.component';
import { DialogModalComponent } from '../../components/molecules/dialog-modal/dialog-modal.component';
import { TimelineEntryComponent, type ActorLookup } from '../../components/molecules/timeline-entry/timeline-entry.component';

type RenderState = 'loading' | 'notFound' | 'error' | 'success';

const COMMENT_MAX = 5000;

@Component({
  selector: 'app-ticket-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppChromeComponent,
    LoadingSkeletonComponent,
    ButtonComponent,
    SelectComponent,
    TextareaComponent,
    ChromeAvatarComponent,
    DialogModalComponent,
    TimelineEntryComponent,
  ],
  template: `
    <app-chrome>
      <section class="detail-page">
        @if (composerError(); as msg) {
          <div
            class="error-toast"
            role="alert"
            aria-live="polite"
            data-testid="error-toast"
          >{{ msg }}</div>
        }
        @switch (renderState()) {
          @case ('loading') {
            <loading-skeleton [rows]="3" />
          }
          @case ('notFound') {
            <div class="state-card" role="alert" data-testid="not-found-card">
              <h1 class="title">Ticket not found</h1>
              <p class="message">
                We couldn't find that ticket. It may have been removed.
              </p>
              <atom-button
                variant="primary"
                size="md"
                (pressed)="goToDashboard()"
              >Back to Dashboard</atom-button>
            </div>
          }
          @case ('error') {
            <div class="state-card" role="alert" data-testid="error-card">
              <h1 class="title">Couldn't load this ticket</h1>
              <p class="message">Please try again.</p>
              <atom-button
                variant="primary"
                size="md"
                (pressed)="goToDashboard()"
              >Back to Dashboard</atom-button>
            </div>
          }
          @case ('success') {
            @if (ticket(); as t) {
              <header class="header" data-testid="detail-header">
                <h1 class="title-text">{{ t.title }}</h1>
                <span class="ticket-number">#{{ t.number }}</span>
              </header>

              @if (isClosed()) {
                <div class="closed-banner" role="status" data-testid="closed-banner">
                  This ticket is closed.
                </div>
              }

              <section class="meta-grid" data-testid="meta-grid">
                <label class="meta-cell">
                  <span class="meta-label">Status</span>
                  <atom-select
                    id="meta-status"
                    [value]="t.status"
                    [options]="statusOptions()"
                    [disabled]="!canEditMeta()"
                    (valueChange)="onStatusChange($event)"
                  />
                </label>

                <label class="meta-cell">
                  <span class="meta-label">Priority</span>
                  <atom-select
                    id="meta-priority"
                    [value]="t.priority"
                    [options]="priorityOptions"
                    [disabled]="!canEditMeta()"
                    (valueChange)="onPriorityChange($event)"
                  />
                </label>

                <label class="meta-cell">
                  <span class="meta-label">Category</span>
                  <atom-select
                    id="meta-category"
                    [value]="t.category ?? ''"
                    [options]="categoryOptions"
                    [disabled]="!canEditCategory()"
                    (valueChange)="onCategoryChange($event)"
                  />
                </label>

                <label class="meta-cell">
                  <span class="meta-label">Assignee</span>
                  <atom-select
                    id="meta-assignee"
                    [value]="t.owner ? t.owner.id.toString() : ''"
                    [options]="assigneeOptions()"
                    [disabled]="!canEditMeta()"
                    (valueChange)="onAssigneeChange($event)"
                  />
                  @if (canSelfAssign()) {
                    <button
                      type="button"
                      class="self-assign-link"
                      data-testid="self-assign-btn"
                      (click)="onSelfAssign()"
                    >Assign to me</button>
                  }
                </label>
              </section>

              @if (canReopen() || canConfirmClose()) {
                <section class="submitter-actions" data-testid="submitter-actions">
                  @if (canReopen()) {
                    <atom-button
                      variant="primary"
                      size="md"
                      data-testid="reopen-btn"
                      (pressed)="openReopenModal()"
                    >Reopen</atom-button>
                  }
                  @if (canConfirmClose()) {
                    <atom-button
                      variant="secondary"
                      size="md"
                      data-testid="confirm-close-btn"
                      (pressed)="onConfirmClose()"
                    >Confirm and close</atom-button>
                  }
                </section>
              }

              <section class="description-card">
                <h2 class="section-title">Description</h2>
                <p class="description-body">{{ t.description }}</p>
              </section>

              <section class="comments-section" data-testid="comments-section">
                <h2 class="section-title">Comments ({{ comments().length }})</h2>
                @if (comments().length === 0) {
                  <p class="empty-marker">No comments yet.</p>
                } @else {
                  <ul class="comments-list">
                    @for (c of comments(); track c.id) {
                      <li class="comment" data-testid="comment-row">
                        <chrome-avatar
                          [displayName]="c.author.displayName"
                          [size]="24"
                        />
                        <div class="comment-body">
                          <p class="comment-header">
                            <span class="comment-author">{{ c.author.displayName }}</span>
                            @if (c.author.role !== 'User') {
                              <span class="agent-badge" data-testid="agent-badge">
                                {{ c.author.role === 'Admin' ? 'Admin' : 'Agent' }}
                              </span>
                            }
                            <time class="comment-time" [attr.datetime]="c.createdAt">
                              {{ c.createdAt }}
                            </time>
                          </p>
                          <p class="comment-text">{{ c.body }}</p>
                        </div>
                      </li>
                    }
                  </ul>
                }

                @if (canComment()) {
                  <div class="composer" data-testid="comment-composer">
                    <atom-textarea
                      id="comment-body"
                      [value]="composerValue()"
                      [rows]="3"
                      [disabled]="postingComment()"
                      placeholder="Add a comment…"
                      (valueChange)="onComposerInput($event)"
                    />
                    <div class="composer-actions">
                      <span class="composer-counter">
                        {{ composerValue().length }} / {{ COMMENT_MAX }}
                      </span>
                      <atom-button
                        variant="primary"
                        size="md"
                        [disabled]="!canSubmitComment()"
                        [loading]="postingComment()"
                        data-testid="comment-send-btn"
                        (pressed)="onSendComment()"
                      >Send</atom-button>
                    </div>
                  </div>
                }
              </section>

              <section class="activity-section" data-testid="activity-section">
                <h2 class="section-title">Activity ({{ activity().length }})</h2>
                @if (activity().length === 0) {
                  <p class="empty-marker">No activity yet.</p>
                } @else {
                  <ol class="timeline">
                    @for (entry of activity(); track entry.id) {
                      <li class="timeline-item">
                        <timeline-entry
                          [eventType]="entry.eventType"
                          [actor]="entry.actor"
                          [createdAt]="entry.createdAt"
                          [payload]="entry.payload"
                          [lookup]="actorLookup()"
                        />
                      </li>
                    }
                  </ol>
                }
              </section>
            }

            @if (reopenModalOpen()) {
              <dialog-modal
                headline="Reopen ticket"
                cancelLabel="Cancel"
                confirmLabel="Reopen"
                (cancel)="closeReopenModal()"
                (confirm)="onReopenConfirmed()"
              >
                <p>This will reopen the ticket. Previous conversation and history will be kept.</p>
              </dialog-modal>
            }
          }
        }
      </section>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
    }
    .detail-page {
      width: 100%;
      max-width: 960px;
      margin: 0 auto;
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
    .header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 16px;
    }
    .title-text {
      font-size: 24px;
      font-weight: 600;
      color: var(--color-primary);
      margin: 0;
    }
    .ticket-number {
      font-family: var(--font-mono);
      font-size: 16px;
      color: var(--color-muted);
    }
    .closed-banner {
      background: var(--color-surface-subtle);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 12px 16px;
      color: var(--color-muted);
      font-size: 14px;
      margin-bottom: 16px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    @media (max-width: 720px) {
      .meta-grid { grid-template-columns: repeat(2, 1fr); }
    }
    .meta-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
    }
    .meta-label {
      font-size: 12px;
      color: var(--color-muted);
    }
    .self-assign-link {
      background: none;
      border: none;
      padding: 0;
      margin-top: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      color: var(--color-primary);
      text-align: left;
    }
    .self-assign-link:hover {
      text-decoration: underline;
    }
    .submitter-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .submitter-actions atom-button {
      width: auto;
      min-width: 140px;
    }
    .description-card, .comments-section, .activity-section {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-primary);
      margin: 0 0 12px;
    }
    .description-body {
      margin: 0;
      white-space: pre-wrap;
      color: var(--color-primary);
      line-height: 1.5;
    }
    .empty-marker {
      color: var(--color-muted);
      font-size: 14px;
      margin: 0;
    }
    .comments-list {
      list-style: none;
      padding: 0;
      margin: 0 0 16px;
    }
    .comment {
      display: flex;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--color-border);
    }
    .comment:last-child {
      border-bottom: none;
    }
    .comment-body {
      flex: 1;
      min-width: 0;
    }
    .comment-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 4px;
      font-size: 14px;
    }
    .comment-author {
      font-weight: 600;
      color: var(--color-primary);
    }
    .agent-badge {
      display: inline-block;
      background: var(--color-primary);
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.4;
    }
    .comment-time {
      font-size: 12px;
      color: var(--color-muted);
      margin-left: auto;
    }
    .comment-text {
      margin: 0;
      color: var(--color-primary);
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .composer {
      border-top: 1px solid var(--color-border);
      padding-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .composer-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .composer-counter {
      font-size: 12px;
      color: var(--color-muted);
    }
    .composer atom-button {
      width: auto;
      min-width: 100px;
    }
    .timeline {
      list-style: none;
      padding: 0;
      margin: 0;
      border-left: 2px solid var(--color-border);
      padding-left: 12px;
    }
    .timeline-item {
      margin: 0;
    }
    .state-card {
      max-width: 480px;
      margin: 48px auto;
      padding: 32px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .state-card .title {
      font-size: 22px;
      font-weight: 600;
      color: var(--color-primary);
      margin: 0;
    }
    .state-card .message {
      margin: 0;
      font-size: 14px;
      color: var(--color-muted);
    }
    .state-card atom-button {
      width: auto;
      min-width: 200px;
    }
  `],
})
export class TicketDetailPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** The fetched ticket. */
  readonly ticket = signal<Ticket | null>(null);

  /** Comments oldest-first. */
  readonly comments = signal<Comment[]>([]);

  /** Activity newest-first. */
  readonly activity = signal<ActivityLog[]>([]);

  /** Agents cache (Support Agent + Admin, active). */
  readonly agents = signal<AgentSummary[]>([]);

  /** The active JWT user. */
  readonly currentUser = signal<UserPublic | null>(null);

  /** Render branch. */
  readonly renderState = signal<RenderState>('loading');

  /** Reopen confirmation modal visibility. */
  readonly reopenModalOpen = signal<boolean>(false);

  /** Comment composer draft text. */
  readonly composerValue = signal<string>('');

  /** Whether a comment POST is currently in flight. */
  readonly postingComment = signal<boolean>(false);

  /** Last error message for the composer (e.g. closed ticket toast). */
  readonly composerError = signal<string | null>(null);

  // ─── Static dropdown option lists ─────────────────────────────────

  readonly priorityOptions: SelectOption[] = [
    { value: 'Low', label: 'Low' },
    { value: 'Medium', label: 'Medium' },
    { value: 'High', label: 'High' },
  ];

  readonly categoryOptions: SelectOption[] = [
    { value: '', label: 'Uncategorized' },
    { value: 'IT', label: 'IT' },
    { value: 'HR', label: 'HR' },
    { value: 'Finance', label: 'Finance' },
    { value: 'General', label: 'General' },
  ];

  /** Per-ticket status options. Open → In Progress / Resolved; etc. */
  readonly statusOptions = computed<SelectOption[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    return validNextStatuses(t.status).map((s) => ({ value: s, label: s }));
  });

  /** Assignee options = "Unassigned" + agents list. */
  readonly assigneeOptions = computed<SelectOption[]>(() => {
    const opts: SelectOption[] = [{ value: '', label: 'Unassigned' }];
    for (const a of this.agents()) {
      opts.push({ value: String(a.id), label: a.displayName });
    }
    return opts;
  });

  // ─── Role + status derived flags ──────────────────────────────────

  readonly isAgent = computed<boolean>(() => {
    const u = this.currentUser();
    return !!u && (u.role === 'Support Agent' || u.role === 'Admin');
  });

  readonly canEditMeta = computed<boolean>(() => {
    return this.isAgent() && !this.isClosed();
  });

  readonly canEditCategory = computed<boolean>(
    () => this.isAgent() && !this.isClosed(),
  );

  readonly isClosed = computed<boolean>(
    () => this.ticket()?.status === 'Closed',
  );

  readonly isSubmitter = computed<boolean>(() => {
    const u = this.currentUser();
    const t = this.ticket();
    return !!u && !!t && u.id === t.submitter.id;
  });

  readonly canReopen = computed<boolean>(
    () =>
      !!this.currentUser() &&
      this.currentUser()!.role === 'User' &&
      this.isSubmitter() &&
      this.ticket()?.status === 'Resolved',
  );

  readonly canConfirmClose = computed<boolean>(
    () =>
      this.isSubmitter() &&
      this.ticket()?.status === 'Resolved',
  );

  readonly canSelfAssign = computed<boolean>(() => {
    if (!this.isAgent() || this.isClosed()) return false;
    const u = this.currentUser();
    const t = this.ticket();
    if (!u || !t) return false;
    return t.owner?.id !== u.id;
  });

  readonly canComment = computed<boolean>(() => !this.isClosed());

  readonly canSubmitComment = computed<boolean>(() => {
    const trimmed = this.composerValue().trim();
    return (
      this.canComment() &&
      trimmed.length > 0 &&
      trimmed.length <= COMMENT_MAX &&
      !this.postingComment()
    );
  });

  /**
   * Lookup table of user-id → displayName for the timeline-entry
   * molecule. Combines agents + ticket submitter + ticket owner so
   * every row in the activity log can resolve a human name. Falls
   * back to the actor's own displayName when an id can't be
   * resolved so the row never prints `undefined`.
   */
  readonly actorLookup = computed<ActorLookup>(() => {
    const map: ActorLookup = {};
    for (const a of this.agents()) map[a.id] = a.displayName;
    const t = this.ticket();
    if (t) {
      map[t.submitter.id] = t.submitter.displayName;
      if (t.owner) map[t.owner.id] = t.owner.displayName;
    }
    return map;
  });

  // ─── Lifecycle ────────────────────────────────────────────────────

  /** Exposed to the template for the COMMENT_MAX constant. */
  readonly COMMENT_MAX = COMMENT_MAX;

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
      void this.router.navigateByUrl('/dashboard');
      return;
    }

    // Resolve the active user before fetching so role gates can be
    // derived synchronously after `load()` returns. If the snapshot
    // is empty (cold load right after login), fall back to /me.
    const snap = this.authService.userSnapshot();
    if (snap) {
      this.currentUser.set(snap);
    } else {
      this.authService.refreshUser()
        .then(() => this.currentUser.set(this.authService.userSnapshot()))
        .catch(() => {
          // best-effort — leave currentUser null; gates simply disable
        });
    }

    void this.load(parsed);
  }

  goToDashboard(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  // ─── Mutation handlers ────────────────────────────────────────────

  async onStatusChange(value: string): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    if (value === t.status) return;
    try {
      const updated = await this.ticketService.patch(t.id, {
        status: value as TicketStatus,
      });
      this.ticket.set(updated);
      this.composerError.set(null);
    } catch (err) {
      if (err instanceof ApiError) {
        this.composerError.set(this.formatApiError(err, "Couldn't change status."));
      }
    }
  }

  async onPriorityChange(value: string): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    if (value === t.priority) return;
    try {
      const updated = await this.ticketService.patch(t.id, {
        priority: value as TicketPriority,
      });
      this.ticket.set(updated);
      this.composerError.set(null);
    } catch (err) {
      if (err instanceof ApiError) {
        this.composerError.set(this.formatApiError(err, "Couldn't change priority."));
      }
    }
  }

  async onCategoryChange(value: string): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const next = value === '' ? null : (value as TicketCategory);
    const current = t.category ?? null;
    if (next === current) return;
    try {
      const updated = await this.ticketService.patch(t.id, {
        category: next,
      });
      this.ticket.set(updated);
      this.composerError.set(null);
    } catch (err) {
      if (err instanceof ApiError) {
        this.composerError.set(this.formatApiError(err, "Couldn't change category."));
      }
    }
  }

  async onAssigneeChange(value: string): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const next = value === '' ? null : Number.parseInt(value, 10);
    const currentId = t.owner?.id ?? null;
    if (next === currentId) return;
    try {
      const updated = await this.ticketService.patch(t.id, {
        ownerId: next,
      });
      this.ticket.set(updated);
      this.composerError.set(null);
    } catch (err) {
      if (err instanceof ApiError) {
        this.composerError.set(this.formatApiError(err, "Couldn't change assignee."));
      }
    }
  }

  async onSelfAssign(): Promise<void> {
    const u = this.currentUser();
    const t = this.ticket();
    if (!u || !t) return;
    try {
      const updated = await this.ticketService.patch(t.id, {
        ownerId: u.id,
      });
      this.ticket.set(updated);
      this.composerError.set(null);
    } catch (err) {
      if (err instanceof ApiError) {
        this.composerError.set(this.formatApiError(err, "Couldn't assign to you."));
      }
    }
  }

  openReopenModal(): void {
    this.reopenModalOpen.set(true);
  }

  closeReopenModal(): void {
    this.reopenModalOpen.set(false);
  }

  async onReopenConfirmed(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    try {
      const updated = await this.ticketService.reopen(t.id);
      this.ticket.set(updated);
      this.composerError.set(null);
      this.closeReopenModal();
    } catch (err) {
      if (err instanceof ApiError) {
        this.composerError.set(this.formatApiError(err, "Couldn't reopen."));
        this.closeReopenModal();
      }
    }
  }

  async onConfirmClose(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    try {
      const updated = await this.ticketService.confirmClose(t.id);
      this.ticket.set(updated);
      this.composerError.set(null);
    } catch (err) {
      if (err instanceof ApiError) {
        this.composerError.set(this.formatApiError(err, "Couldn't close."));
      }
    }
  }

  onComposerInput(value: string): void {
    this.composerValue.set(value);
  }

  async onSendComment(): Promise<void> {
    const t = this.ticket();
    if (!t) return;
    const body = this.composerValue().trim();
    if (!body) return;
    this.postingComment.set(true);
    try {
      const created = await this.ticketService.addComment(t.id, body);
      this.comments.update((rows) => [...rows, created]);
      this.composerValue.set('');
      this.composerError.set(null);
    } catch (err) {
      if (err instanceof ApiError) {
        this.composerError.set(this.formatApiError(err, "Couldn't add your comment."));
      }
    } finally {
      this.postingComment.set(false);
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────

  private async load(id: number): Promise<void> {
    this.renderState.set('loading');

    let primaryError: unknown = null;
    try {
      const [ticket, comments, activity] = await Promise.all([
        this.ticketService.getById(id),
        this.ticketService.listComments(id),
        this.ticketService.listActivity(id),
      ]);
      this.ticket.set(ticket);
      this.comments.set(comments);
      this.activity.set(activity);
      this.renderState.set('success');
    } catch (err) {
      primaryError = err;
    }

    // Agents failure is non-fatal — the assignee dropdown will
    // degrade to "Unassigned"-only. Fetch in a separate try/catch
    // so a 503 on /users/agents doesn't block the success view.
    try {
      const agents = await this.userService.listAgents();
      this.agents.set(agents);
    } catch {
      this.agents.set([]);
    }

    if (primaryError !== undefined && primaryError !== null) {
      if (primaryError instanceof ApiError && primaryError.status === 404) {
        this.renderState.set('notFound');
      } else {
        this.renderState.set('error');
      }
    }
  }

  private formatApiError(err: ApiError, fallback: string): string {
    if (err.status === 403 && err.message.toLowerCase().includes('closed')) {
      return "Ticket is closed and can't accept new comments.";
    }
    return err.message || fallback;
  }
}

/**
 * Compute the legal next-status options for a given current status,
 * matching the server-side matrix in EXPERIENCE.md "Ticket Status
 * Workflow Controls".
 *
 * The Status dropdown only offers legal transitions so the agent can't
 * attempt Closed → Open via the UI. The backend re-validates and
 * returns 400 for anything that's not on the matrix.
 */
function validNextStatuses(
  current: TicketStatus,
): TicketStatus[] {
  switch (current) {
    case 'Open':
      return ['Open', 'In Progress', 'Resolved'];
    case 'In Progress':
      return ['Open', 'In Progress', 'Resolved'];
    case 'Resolved':
      return ['Open', 'Resolved', 'Closed'];
    case 'Closed':
      return ['Closed'];
    default: {
      const _exhaustive: never = current;
      return [_exhaustive];
    }
  }
}