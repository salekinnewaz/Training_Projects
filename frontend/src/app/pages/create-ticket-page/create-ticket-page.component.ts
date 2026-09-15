/**
 * CreateTicketPageComponent — HD-008.
 *
 * The "New ticket" page Eli lands on from the Employee Dashboard's
 * "Create Ticket" button. Five fields (Title / Description /
 * Category / Priority / Attachment) + Submit, wrapped in
 * `<app-chrome>` to inherit the header chrome + skip-link.
 *
 * Render states:
 *   idle      → form enabled, all fields empty / default
 *   submitting → form fields + Submit disabled, button shows
 *                spinner + "Submitting…", Cancel stays enabled
 *   server-error → inline error above Submit, fields preserved
 *
 * Behaviors:
 *   - Submit click → client-side validation (every required field,
 *     120-char Title cap, 5000-char Description cap). On failure:
 *     per-field inline error + focus the first invalid field.
 *   - 201 → router.navigateByUrl('/tickets/<id>/created').
 *   - 400 with `fields` → map 1-to-1 onto the per-field error UX.
 *   - 401 → stash {title, description, category, priority} to
 *     sessionStorage['hd:draft:create-ticket'], then redirect to
 *     /login?return_to=/tickets/new. On the round-trip back,
 *     ngOnInit restores the stash + removeItem so reloads don't
 *     double-apply.
 *   - 5xx / network → "Couldn't submit your ticket. Please try
 *     again." inline above Submit. Form state preserved, Submit
 *     re-enabled. (No retry button — the spec says "click Submit
 *     again".)
 *
 * Cross-page:
 *   - beforeunload: if title OR description has content AND submit
 *     has not yet returned 2xx → confirm. Cancel / Back links
 *     removeEventListener first so the explicit discard is silent.
 *   - ngOnDestroy teardown: removeEventListener (defensive — the
 *     success path may already have removed it).
 *   - Direct-arrival from a /login?return_to=%2Ftickets%2Fnew
 *     redirect triggers the sessionStorage restore path.
 *
 * Attachment (HD-008 OQ-1 / choice A): the drop zone ships
 * disabled. The page still owns the field state signal + the
 * 10 MB cap check (the file size lives on the File, read in
 * onFilePicked) so when HD-011 flips the drop zone on, the
 * 10 MB enforcement is already wired. Until then the value is
 * always null and Submit never sees an attachmentId.
 */

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ApiError } from '../../services/api-error';
import {
  CreateTicketPayload,
  TicketService,
} from '../../services/ticket.service';
import type { TicketCategory, TicketPriority } from '../../models/enums';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { FormFieldComponent } from '../../components/molecules/form-field/form-field.component';
import { InputTextComponent } from '../../components/atoms/input-text/input-text.component';
import { TextareaComponent } from '../../components/atoms/textarea/textarea.component';
import { SelectComponent } from '../../components/atoms/select/select.component';
import { FileDropComponent } from '../../components/organisms/file-drop/file-drop.component';

const STORAGE_KEY = 'hd:draft:create-ticket';
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;
const FILE_MAX_BYTES = 10 * 1024 * 1024;

interface DraftPayload {
  title: string;
  description: string;
  category: TicketCategory | '';
  priority: TicketPriority;
}

const CATEGORY_OPTIONS = [
  { value: 'IT', label: 'IT' },
  { value: 'HR', label: 'HR' },
  { value: 'Finance', label: 'Finance' },
  { value: 'General', label: 'General' },
];

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
];

@Component({
  selector: 'app-create-ticket-page',
  standalone: true,
  imports: [
    AppChromeComponent,
    ButtonComponent,
    FormFieldComponent,
    InputTextComponent,
    TextareaComponent,
    SelectComponent,
    FileDropComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome>
      <section class="create-ticket">
        <a
          class="back-link"
          href="/dashboard"
          (click)="onBack($event)"
        >← Back to My Tickets</a>

        <h1>New ticket</h1>

        <form (submit)="onSubmit($event)" novalidate>
          <form-field
            id="title"
            label="Title"
            [required]="true"
            [error]="titleError()"
          >
            <atom-input
              id="title"
              type="text"
              [value]="title()"
              [invalid]="titleError() !== null"
              [required]="true"
              [disabled]="submitting()"
              placeholder="Short summary of the issue"
              (valueChange)="onTitleChange($event)"
            />
          </form-field>

          <form-field
            id="description"
            label="Description"
            [required]="true"
            [error]="descriptionError()"
          >
            <atom-textarea
              id="description"
              [value]="description()"
              [invalid]="descriptionError() !== null"
              [required]="true"
              [disabled]="submitting()"
              [rows]="6"
              placeholder="Describe what's happening — what you expected, what's actually happening, and anything you've already tried."
              (valueChange)="onDescriptionChange($event)"
            />
          </form-field>

          @if (description().length > 4500) {
            <p class="char-counter">
              {{ DESCRIPTION_MAX - description().length }} characters left
            </p>
          }

          <form-field
            id="category"
            label="Category"
            [error]="categoryError()"
          >
            <atom-select
              id="category"
              [value]="category()"
              [options]="categoryOptions"
              [placeholderOption]="{ value: '', label: 'Select category…' }"
              [disabled]="submitting()"
              (valueChange)="onCategoryChange($event)"
            />
          </form-field>

          <form-field
            id="priority"
            label="Priority"
            [required]="true"
            [error]="priorityError()"
          >
            <atom-select
              id="priority"
              [value]="priority()"
              [options]="priorityOptions"
              [disabled]="submitting()"
              (valueChange)="onPriorityChange($event)"
            />
          </form-field>

          <form-field
            id="attachment"
            label="Attachment"
            [error]="attachmentError()"
          >
            <div class="attachment-label-row">
              <file-drop
                id="attachment"
                [disabled]="submitting() || attachmentDisabled()"
                [currentFile]="attachment()"
                [error]="attachmentError()"
                (fileSelected)="onFilePicked($event)"
              >
                <span class="dropzone-helper">Attach a file (coming soon)</span>
              </file-drop>
            </div>
          </form-field>

          @if (serverError(); as err) {
            <p class="server-error" role="alert">{{ err }}</p>
          }

          <atom-button
            variant="primary"
            size="lg"
            type="submit"
            [loading]="submitting()"
            [disabled]="!canSubmit()"
          >Submit ticket</atom-button>

          <a
            class="cancel-link"
            href="/dashboard"
            (click)="onCancel($event)"
          >Cancel — return to My Tickets</a>
        </form>
      </section>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
    }
    .create-ticket {
      max-width: 720px;
      margin: 0 auto;
      padding-bottom: 32px;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 16px;
      color: var(--color-muted);
      font-size: 14px;
      text-decoration: none;
    }
    .back-link:hover {
      text-decoration: underline;
    }
    h1 {
      margin: 0 0 24px;
      font-size: 24px;
      font-weight: 600;
      color: var(--color-primary);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .char-counter {
      margin: -16px 0 0;
      color: var(--color-muted);
      font-size: 13px;
      text-align: right;
    }
    .attachment-label-row {
      display: block;
    }
    .dropzone-helper {
      font-size: 14px;
      color: var(--color-muted);
    }
    .server-error {
      margin: 0;
      padding: 12px 16px;
      border: 1px solid var(--color-error);
      background: var(--color-surface);
      color: var(--color-error);
      font-size: 14px;
      border-radius: 6px;
    }
    .cancel-link {
      align-self: flex-start;
      color: var(--color-muted);
      font-size: 14px;
      text-decoration: none;
    }
    .cancel-link:hover {
      text-decoration: underline;
    }
  `],
})
export class CreateTicketPageComponent implements OnInit, OnDestroy {
  private readonly ticketService = inject(TicketService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  // Constants exposed to the template.
  readonly DESCRIPTION_MAX = DESCRIPTION_MAX;
  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly priorityOptions = PRIORITY_OPTIONS;

  // ── Form state ────────────────────────────────────────────────────
  readonly title = signal<string>('');
  readonly description = signal<string>('');
  readonly category = signal<TicketCategory | ''>('');
  readonly priority = signal<TicketPriority>('Medium');
  readonly attachment = signal<File | null>(null);

  // Per-field error signals. null = no error; the form-field molecule
  // renders the error string under the input.
  readonly titleError = signal<string | null>(null);
  readonly descriptionError = signal<string | null>(null);
  readonly categoryError = signal<string | null>(null);
  readonly priorityError = signal<string | null>(null);
  readonly attachmentError = signal<string | null>(null);

  // Above-the-form / above-the-button server-side error.
  readonly serverError = signal<string | null>(null);

  // Submission lifecycle.
  readonly submitting = signal<boolean>(false);

  // Per-field "touched" flags. After the FIRST submit attempt,
  // blur on each field re-runs validation so an empty Title gets
  // its inline error as soon as the user tabs out.
  private readonly touched = {
    title: false,
    description: false,
    category: false,
    priority: false,
    attachment: false,
  };

  // Tracks whether the last submit attempt succeeded. While false
  // AND title or description has content → beforeunload warning.
  private lastSubmitSucceeded = false;
  private beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null =
    null;

  // OQ-1 lock: drop zone ships disabled. HD-011 will flip this.
  readonly attachmentDisabled = signal<boolean>(true);

  // ── Template helpers ──────────────────────────────────────────────
  canSubmit(): boolean {
    return (
      !this.submitting() &&
      this.title().trim().length > 0 &&
      this.description().trim().length > 0 &&
      this.title().length <= TITLE_MAX &&
      this.description().length <= DESCRIPTION_MAX
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────
  ngOnInit(): void {
    this.maybeRestoreDraft();
    this.installBeforeUnload();
  }

  ngOnDestroy(): void {
    this.removeBeforeUnload();
  }

  private maybeRestoreDraft(): void {
    // Only restore when the URL is /tickets/new AND sessionStorage
    // has a stashed draft. The return_to query param is how the
    // post-401 /login bounce signals "land me back on the form".
    const returnTo = this.route.snapshot.queryParamMap.get('return_to');
    const hasDraft =
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(STORAGE_KEY) !== null;
    if (returnTo !== '/tickets/new' || !hasDraft) return;

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DraftPayload>;
      if (typeof parsed.title === 'string') this.title.set(parsed.title);
      if (typeof parsed.description === 'string')
        this.description.set(parsed.description);
      if (typeof parsed.category === 'string') this.category.set(parsed.category);
      if (
        parsed.priority === 'Low' ||
        parsed.priority === 'Medium' ||
        parsed.priority === 'High'
      ) {
        this.priority.set(parsed.priority);
      }
    } catch {
      // Bad JSON — ignore; we don't want to break the page over a
      // corrupted stash.
    } finally {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  private installBeforeUnload(): void {
    // Browser contract: the handler must be a named (non-arrow)
    // function AND must attach a returnValue — Chromium-based
    // browsers honor that, others fall back to their localized
    // "Changes you made may not be saved" string.
    this.beforeUnloadHandler = (event: BeforeUnloadEvent): void => {
      if (this.lastSubmitSucceeded) return;
      if (!this.hasUnsavedContent()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    this.destroyRef.onDestroy(() => this.removeBeforeUnload());
  }

  private removeBeforeUnload(): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }

  private hasUnsavedContent(): boolean {
    return this.title().length > 0 || this.description().length > 0;
  }

  // ── Field change handlers ─────────────────────────────────────────
  onTitleChange(value: string): void {
    this.title.set(value);
    if (this.touched.title) {
      // Re-run validation as the user fixes the field after the
      // first failed submit attempt.
      this.validateTitle({ silent: false });
    }
    this.clearServerError();
  }

  onDescriptionChange(value: string): void {
    this.description.set(value);
    if (this.touched.description) {
      this.validateDescription({ silent: false });
    }
    this.clearServerError();
  }

  onCategoryChange(value: string): void {
    this.category.set(value as TicketCategory | '');
    this.clearServerError();
  }

  onPriorityChange(value: string): void {
    if (value === 'Low' || value === 'Medium' || value === 'High') {
      this.priority.set(value);
    }
    this.clearServerError();
  }

  onFilePicked(file: File | null): void {
    // Per spec: the page owns the > 10 MB error. Read the size off
    // the File before passing it through to submit. The drop zone
    // is disabled in HD-008, so this branch is exercised once HD-011
    // turns the zone on — but it's wired now so flipping the flag
    // is the only change needed.
    this.attachmentError.set(null);
    if (file && file.size > FILE_MAX_BYTES) {
      this.attachmentError.set(
        'File is larger than 10 MB. Pick a smaller file.',
      );
      this.attachment.set(null);
      return;
    }
    this.attachment.set(file);
  }

  // ── Per-field validators ──────────────────────────────────────────
  private validateTitle(opts: { silent: boolean }): boolean {
    const value = this.title().trim();
    if (value.length === 0) {
      this.titleError.set(this.touched.title || !opts.silent ? 'Enter a title.' : null);
      return false;
    }
    if (this.title().length > TITLE_MAX) {
      this.titleError.set(
        this.touched.title || !opts.silent
          ? 'Keep the title under 120 characters.'
          : null,
      );
      return false;
    }
    this.titleError.set(null);
    return true;
  }

  private validateDescription(opts: { silent: boolean }): boolean {
    const value = this.description().trim();
    if (value.length === 0) {
      this.descriptionError.set(
        this.touched.description || !opts.silent ? 'Describe the issue.' : null,
      );
      return false;
    }
    if (this.description().length > DESCRIPTION_MAX) {
      this.descriptionError.set(
        this.touched.description || !opts.silent
          ? 'Description is limited to 5000 characters.'
          : null,
      );
      return false;
    }
    this.descriptionError.set(null);
    return true;
  }

  private clearServerError(): void {
    if (this.serverError() !== null) {
      this.serverError.set(null);
    }
  }

  private focusFirstInvalid(): void {
    if (this.titleError()) {
      document.getElementById('title')?.focus();
    } else if (this.descriptionError()) {
      document.getElementById('description')?.focus();
    } else if (this.categoryError()) {
      document.getElementById('category')?.focus();
    } else if (this.priorityError()) {
      document.getElementById('priority')?.focus();
    } else if (this.attachmentError()) {
      document.getElementById('attachment')?.focus();
    }
  }

  // ── Submit lifecycle ──────────────────────────────────────────────
  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;

    // Mark every field touched so per-field blur re-runs validation
    // after the first failed submit attempt.
    this.touched.title = true;
    this.touched.description = true;
    this.touched.category = true;
    this.touched.priority = true;
    this.touched.attachment = true;

    const titleOk = this.validateTitle({ silent: false });
    const descriptionOk = this.validateDescription({ silent: false });
    if (!titleOk || !descriptionOk) {
      this.focusFirstInvalid();
      return;
    }

    this.submitting.set(true);
    this.serverError.set(null);

    // Per HD-008: attachment uploads are disabled in MVP; the
    // payload never carries an attachmentId until HD-011 lands.
    const payload: CreateTicketPayload = {
      title: this.title().trim(),
      description: this.description().trim(),
      priority: this.priority(),
    };
    if (this.category() !== '') {
      payload.category = this.category() as TicketCategory;
    }

    try {
      const ticket = await this.ticketService.create(payload);
      this.lastSubmitSucceeded = true;
      // Clear state before navigating so the success path skips
      // the beforeunload prompt cleanly.
      this.removeBeforeUnload();
      await this.router.navigateByUrl(`/tickets/${ticket.id}/created`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          this.handleSessionExpired();
          return;
        }
        if (err.status === 400 && err.fields) {
          this.mapServerFields(err.fields);
          this.focusFirstInvalid();
          return;
        }
      }
      this.serverError.set(
        "Couldn't submit your ticket. Please try again.",
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private handleSessionExpired(): void {
    // Stash the form so re-login lands Eli back where she was.
    try {
      const draft: DraftPayload = {
        title: this.title(),
        description: this.description(),
        category: this.category(),
        priority: this.priority(),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // sessionStorage may be unavailable (private mode) — silently
      // drop the stash; the user can still log back in.
    }
    // Tear down the beforeunload guard so the navigation to /login
    // doesn't trigger its own prompt.
    this.removeBeforeUnload();
    void this.router.navigate(['/login'], {
      queryParams: { return_to: '/tickets/new' },
    });
  }

  private mapServerFields(fields: Record<string, string>): void {
    if (fields['title']) {
      this.titleError.set(fields['title']);
      this.touched.title = true;
    }
    if (fields['description']) {
      this.descriptionError.set(fields['description']);
      this.touched.description = true;
    }
    if (fields['category']) {
      this.categoryError.set(fields['category']);
      this.touched.category = true;
    }
    if (fields['priority']) {
      this.priorityError.set(fields['priority']);
      this.touched.priority = true;
    }
    if (fields['attachmentId']) {
      this.attachmentError.set(fields['attachmentId']);
      this.touched.attachment = true;
    }
    // If the server returned a non-field error, surface it above Submit.
    const otherErrors = Object.entries(fields)
      .filter(
        ([k]) =>
          k !== 'title' &&
          k !== 'description' &&
          k !== 'category' &&
          k !== 'priority' &&
          k !== 'attachmentId',
      )
      .map(([, msg]) => msg);
    if (otherErrors.length > 0) {
      this.serverError.set(otherErrors.join(' '));
    }
  }

  // ── Navigation ────────────────────────────────────────────────────
  onBack(event: MouseEvent): void {
    event.preventDefault();
    this.removeBeforeUnload();
    void this.router.navigateByUrl('/dashboard');
  }

  onCancel(event: MouseEvent): void {
    event.preventDefault();
    this.removeBeforeUnload();
    void this.router.navigateByUrl('/dashboard');
  }

  // ── Reactive blur handlers (per-field, after first submit attempt) ─
  @HostListener('focusout', ['$event'])
  onFieldBlur(event: FocusEvent): void {
    if (!this.touched.title && !this.touched.description && !this.touched.category && !this.touched.priority) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const id = target.id;
    if (id === 'title') {
      this.touched.title = true;
      this.validateTitle({ silent: false });
    } else if (id === 'description') {
      this.touched.description = true;
      this.validateDescription({ silent: false });
    } else if (id === 'category' || id === 'priority') {
      // No client validation can fail (enum-bounded by the <atom-select>
      // options list). Set touched so a subsequent server error renders.
      if (id === 'category') this.touched.category = true;
      else this.touched.priority = true;
    }
  }
}