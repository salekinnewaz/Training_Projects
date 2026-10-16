/**
 * `components/atoms/` barrel — D6 slice.
 *
 * Selective re-export of the 13 atom components and their
 * accompanying public types. **Additive only** — every existing
 * deep import path (`./button/button.component`, etc.) keeps
 * working unchanged. New consumers can write:
 *
 *   import {
 *     ButtonComponent,
 *     InputTextComponent,
 *     SelectComponent,
 *     SelectOption,
 *   } from '../../components/atoms';
 *
 * instead of the full path. Each re-export is explicit (no
 * `export *`) so:
 *
 *   1. A new atom added later doesn't accidentally leak into
 *      a consumer's bundle via the barrel until someone adds
 *      it to this file.
 *   2. TypeScript's "value-only re-export" rule for `isolatedModules`
 *      is satisfied for every line.
 *   3. A future barrel that mixes `imports: [...]` arrays (which
 *      need value re-exports) and type imports (which need
 *      `export type`) doesn't silently drop a type or a value.
 *
 * No new pattern — this is the standard ES module barrel. See
 * `_bmad-output/implementation-artifacts/spec-d6-component-barrels.md`
 * for the slice spec and the close rationale.
 */

export { ButtonComponent } from './button/button.component';
export { InputTextComponent } from './input-text/input-text.component';
export { LinkComponent } from './link/link.component';
export { ShowPasswordToggleComponent } from './show-password-toggle/show-password-toggle.component';
export { TextareaComponent } from './textarea/textarea.component';
export { SelectComponent } from './select/select.component';
export type { SelectOption } from './select/select.component';
export type { SelectPlaceholderOption } from './select/select.component';
export { BadgePriorityComponent } from './badge-priority/badge-priority.component';
export { BadgeCategoryComponent } from './badge-category/badge-category.component';
export { BadgeRoleComponent } from './badge-role/badge-role.component';
export { BadgeStatusComponent } from './badge-status/badge-status.component';
export { CaretDownComponent } from './caret-down/caret-down.component';
export { CheckCircleComponent } from './check-circle/check-circle.component';
export type { CheckCircleSize } from './check-circle/check-circle.component';
export { ChromeAvatarComponent } from './chrome-avatar/chrome-avatar.component';
export { DividerHrComponent } from './divider-hr/divider-hr.component';
