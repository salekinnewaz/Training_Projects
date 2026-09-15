/**
 * chrome-preview — TEMPORARY page (HD-004).
 *
 * Renders `<app-chrome />` with a placeholder body so we can
 * smoke-test the chrome end-to-end before HD-005 (login form)
 * and HD-006 (route guards) land.
 *
 * TODO(hd-006): remove this page wholesale when the real route
 * tree wraps every post-login page in <app-chrome /> via a parent
 * route + the authGuard.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';

@Component({
  selector: 'app-chrome-preview-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppChromeComponent],
  template: `
    <app-chrome>
      <p>HD-004 preview — verify the chrome + dropdown + logout dialog.</p>
      <p>Use curl to log in (see the README / progress log for the full command).</p>
      <p>This page will be removed in HD-006.</p>
    </app-chrome>
  `,
})
export class ChromePreviewPageComponent {}
