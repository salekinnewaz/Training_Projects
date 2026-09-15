/**
 * file-drop — organism (HD-008).
 *
 * Dashed-border drop zone for a single file attachment. Owns the
 * dragover / drop / dismiss logic + the visible state machine
 * (empty → has-file → error → empty). The page owns the 10 MB
 * cap check (the file size lives on the File, which the page reads
 * before passing it to submit) and the inline error display under
 * the drop zone.
 *
 * API:
 *   Inputs:
 *     id (req)
 *     disabled             — when true, the dashed border greys,
 *                            click-to-browse no-ops, drop events
 *                            are ignored. The page also projects
 *                            a hint ("Attach a file (coming soon)")
 *                            through <ng-content> so the consumer
 *                            owns the disabled-state copy.
 *     currentFile          — the currently-attached file (or null).
 *                            Drives the has-file display.
 *     error                — page-owned error string (e.g. "File
 *                            is larger than 10 MB."). Rendered
 *                            below the drop zone in error color.
 *   Outputs:
 *     fileSelected         — emits File | null when the user picks
 *                            a file (click-to-browse) or drops a
 *                            file, or when they click the × button
 *                            on an attached file.
 *
 * HD-008 ships this organism disabled (OQ-1, locked 2026-09-15,
 * choice A). The drop zone still renders its dashed border +
 * projected helper text; the underlying state simply ignores
 * user gestures. HD-011 (or the attachments slice) will add the
 * upload endpoint and flip [disabled] to false.
 *
 * OnPush. Dragover state lives in a signal so the dashed border
 * can darken on dragover without external coordination.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'file-drop',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="dropzone"
      [class.disabled]="disabled()"
      [class.has-file]="currentFile() !== null"
      [class.drag-over]="dragOver() && !disabled()"
      [class.has-error]="error() !== null"
      (click)="onZoneClick()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      @if (currentFile(); as file) {
        <div class="file-row">
          <div class="file-meta">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatSize(file.size) }}</span>
          </div>
          @if (!disabled()) {
            <button
              type="button"
              class="remove"
              [attr.aria-label]="'Remove ' + file.name"
              (click)="onRemove($event)"
            >
              ×
            </button>
          }
        </div>
      } @else {
        <ng-content></ng-content>
      }
      @if (error(); as errMsg) {
        <p class="error-text" role="alert">{{ errMsg }}</p>
      }
    </div>
    <input
      #fileInput
      type="file"
      class="visually-hidden"
      [attr.aria-hidden]="true"
      [tabindex]="-1"
      [disabled]="disabled()"
      (change)="onFileInput($event)"
    />
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .dropzone {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      min-height: 96px;
      padding: 16px;
      border: 1.5px dashed var(--color-border-strong);
      border-radius: var(--field-radius);
      background: var(--color-surface);
      color: var(--color-muted);
      font-size: 14px;
      text-align: center;
      cursor: pointer;
      transition: border-color 120ms ease, background-color 120ms ease;
      box-sizing: border-box;
    }
    .dropzone:hover:not(.disabled):not(.has-file) {
      border-color: var(--color-primary);
    }
    .dropzone.drag-over {
      border-color: var(--color-primary);
      background: var(--color-surface-subtle);
    }
    .dropzone.disabled {
      cursor: not-allowed;
      color: var(--color-disabled);
      border-color: var(--color-disabled);
      background: var(--color-surface-subtle);
    }
    .dropzone.has-file {
      justify-content: flex-start;
      text-align: left;
      cursor: default;
      border-style: solid;
      border-color: var(--color-border);
    }
    .dropzone.has-error {
      border-color: var(--color-error);
    }
    .file-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    }
    .file-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .file-name {
      color: var(--color-primary);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-size {
      color: var(--color-muted);
      font-size: 12px;
    }
    .remove {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--color-muted);
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      border-radius: 4px;
    }
    .remove:hover {
      color: var(--color-error);
      background: var(--color-surface-subtle);
    }
    .error-text {
      margin: 8px 0 0;
      color: var(--color-error);
      font-size: 13px;
      line-height: 1.4;
      text-align: left;
    }
    .visually-hidden {
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
  `],
})
export class FileDropComponent {
  readonly id = input.required<string>();
  readonly disabled = input<boolean>(false);
  readonly currentFile = input<File | null>(null);
  readonly error = input<string | null>(null);

  @Output() readonly fileSelected = new EventEmitter<File | null>();

  readonly dragOver = signal<boolean>(false);

  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  private get fileInput(): HTMLInputElement | undefined {
    return this.fileInputRef()?.nativeElement;
  }

  /**
   * Block dragover on the host so the browser doesn't try to
   * navigate to the dropped file. The drop handler then picks the
   * file off `event.dataTransfer.files[0]`.
   */
  @HostListener('dragover', ['$event'])
  onHostDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onZoneClick(): void {
    if (this.disabled()) return;
    this.fileInput?.click();
  }

  onDragOver(event: DragEvent): void {
    if (this.disabled()) return;
    event.preventDefault();
    if (!this.dragOver()) {
      this.dragOver.set(true);
    }
  }

  onDragLeave(event: DragEvent): void {
    if (this.disabled()) return;
    // Only clear when the drag leaves the dropzone itself, not its
    // children (event.target === currentTarget).
    if (event.target === event.currentTarget) {
      this.dragOver.set(false);
    }
  }

  onDrop(event: DragEvent): void {
    if (this.disabled()) return;
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
  }

  onFileInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] ?? null;
    this.fileSelected.emit(file);
    // Reset so picking the same file twice fires a second change.
    target.value = '';
  }

  onRemove(event: MouseEvent): void {
    event.stopPropagation();
    this.fileSelected.emit(null);
  }

  /** Human-readable size in KB / MB. */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}