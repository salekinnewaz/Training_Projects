/**
 * chrome-avatar — atom (HD-004).
 *
 * Circular avatar showing the user's initials. Background uses
 * --color-disabled so the avatar reads as "neutral" against the
 * chrome strip regardless of role. `displayName` is split on
 * whitespace; first letter of the first word + first letter of
 * the last word, uppercased. Falls back to '?' for empty input.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

@Component({
  selector: 'chrome-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="avatar"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.font-size.px]="size() * 0.4"
      aria-hidden="true"
    >{{ initials() }}</span>
  `,
  styles: [`
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--color-disabled);
      color: #ffffff;
      font-weight: 600;
      line-height: 1;
      user-select: none;
      flex-shrink: 0;
    }
  `],
})
export class ChromeAvatarComponent {
  readonly displayName = input<string>('');
  readonly size = input<24 | 32>(32);

  readonly initials = computed(() => computeInitials(this.displayName()));
}

function computeInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 1).toUpperCase();
  }
  const first = parts[0]!.slice(0, 1);
  const last = parts[parts.length - 1]!.slice(0, 1);
  return (first + last).toUpperCase();
}
