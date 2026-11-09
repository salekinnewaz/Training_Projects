/**
 * admin-sidebar — molecule (WDS-2026 Admin Workspace).
 *
 * The left navigation rail of the Admin Workspace. Two sections:
 *
 *   ┌──────────────────────────────────────┐
 *   │ ⌂  Dashboard                    ◂── active, indigo, left bar
 *   │ ▣  Tickets                    156 │
 *   │ ♟  Users                       8  │
 *   │ ────────────────────────────────────│
 *   │ Settings                            │
 *   │ ▢  Categories                       │
 *   │ ⚑  Priorities                       │
 *   │ ▤  Custom Fields                    │
 *   │ ✉  Email Templates                  │
 *   │ ⚭  Integrations                     │
 *   │ ◷  Audit Logs                       │
 *   │                                      │
 *   │ ┌──────────────────────────────┐    │
 *   │ │ ♛ HelpDesk Lite              │    │  ← footer card
 *   │ │    Admin Workspace            │    │
 *   │ │    Manage tickets, users …    │    │
 *   │ └──────────────────────────────┘    │
 *   └──────────────────────────────────────┘
 *
 * Only Dashboard, Tickets and Users are live routes. The Settings
 * items are the reference design's placeholders — they are
 * rendered as non-interactive rows (no link, not focusable) rather
 * than as dead links that go nowhere, so they read as "planned"
 * instead of "broken".
 *
 * The badge counts (Tickets 156, Users 8) are live data supplied
 * by the page.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface AdminSidebarBadge {
  readonly tickets?: number;
  readonly users?: number;
}

@Component({
  selector: 'admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="sidebar" aria-label="Admin workspace">
      <ul class="nav-list" role="list">
        <li>
          <a
            class="nav-item"
            routerLink="/admin"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            data-testid="admin-nav-dashboard"
          >
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 8.5 L10 3 L17 8.5 V16 a1 1 0 0 1-1 1 H4 a1 1 0 0 1-1-1 Z" />
                <path d="M8 17 v-5 h4 v5" />
              </svg>
            </span>
            <span class="label">Dashboard</span>
          </a>
        </li>
        <li>
          <a
            class="nav-item"
            routerLink="/tickets"
            routerLinkActive="active"
            data-testid="admin-nav-tickets"
          >
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6 a1 1 0 0 1 1-1 h9 l4 4 v9 a1 1 0 0 1-1 1 H4 a1 1 0 0 1-1-1 Z" />
                <path d="M13 5 v4 h4" />
              </svg>
            </span>
            <span class="label">Tickets</span>
            @if (badge().tickets !== undefined) {
              <span class="badge">{{ format(badge().tickets!) }}</span>
            }
          </a>
        </li>
        <li>
          <a
            class="nav-item"
            routerLink="/users"
            routerLinkActive="active"
            data-testid="admin-nav-users"
          >
            <span class="icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="7.5" cy="7" r="3" />
                <path d="M2.5 17 a5 5 0 0 1 10 0" />
                <path d="M13.5 4.6 a3 3 0 0 1 0 5.6" />
                <path d="M14.5 13 a4.5 4.5 0 0 1 3 4" />
              </svg>
            </span>
            <span class="label">Users</span>
            @if (badge().users !== undefined) {
              <span class="badge">{{ format(badge().users!) }}</span>
            }
          </a>
        </li>
      </ul>

      <div class="divider" role="separator"></div>

      <p class="section-label">Manage</p>

      <ul class="nav-list settings" role="list">
        @for (item of settingsItems(); track item.label) {
          <li>
            <span class="nav-item is-static" [attr.aria-disabled]="'true'">
              <span class="icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  @switch (item.icon) {
                    @case ('folder') {
                      <path d="M2.5 5.5 a1 1 0 0 1 1-1 H7 l1.8 2.2 h7.7 a1 1 0 0 1 1 1 V15 a1 1 0 0 1-1 1 H3.5 a1 1 0 0 1-1-1 Z" />
                    }
                    @case ('flag') {
                      <path d="M5 17 V3.5 h9 l-1.6 3 1.6 3 H5" />
                    }
                    @case ('table') {
                      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
                      <path d="M2.5 8 h15 M8 8 v8.5" />
                    }
                    @case ('mail') {
                      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
                      <path d="M3 5.5 L10 11 L17 5.5" />
                    }
                    @case ('link') {
                      <path d="M8.5 11.5 a3 3 0 0 0 4.2 0 l2.6-2.6 a3 3 0 0 0-4.2-4.2 l-1 1" />
                      <path d="M11.5 8.5 a3 3 0 0 0-4.2 0 l-2.6 2.6 a3 3 0 0 0 4.2 4.2 l1-1" />
                    }
                    @case ('gear') {
                      <circle cx="10" cy="10" r="3" />
                      <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4m-7.8 7.8-1.4 1.4m11.2 0-1.4-1.4m-7.8-7.8L5.3 4.7" />
                    }
                    @default {
                      <circle cx="10" cy="10" r="7" />
                      <path d="M10 6.5 V10 l2.5 1.6" />
                    }
                  }
                </svg>
              </span>
              <span class="label">{{ item.label }}</span>
            </span>
          </li>
        }
      </ul>

      <div class="footer-card">
        <div class="footer-head">
          <span class="crown" aria-hidden="true">
            <svg viewBox="0 0 20 20" width="36" height="36" fill="none">
              <circle cx="10" cy="10" r="9" fill="#FFF0C8" />
              <path d="M5.2 12.4 h9.6 v1.4 a1 1 0 0 1-1 1 H6.2 a1 1 0 0 1-1-1 Z M5.6 11.2 L4.4 5.8 l3.3 2.4 L10 4.8 l2.3 3.4 3.3-2.4 -1.2 5.4 Z" fill="#E5A400" />
            </svg>
          </span>
          <div class="footer-titles">
            <span class="footer-title">HelpDesk Lite</span>
            <span class="footer-subtitle">Admin Workspace</span>
          </div>
        </div>
        <p class="footer-copy">
          Manage tickets, users and system settings from a single place.
        </p>
        <svg class="footer-waves" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="adminSidebarWave" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#2563eb" stop-opacity=".38" />
              <stop offset="1" stop-color="#2563eb" stop-opacity=".03" />
            </linearGradient>
          </defs>
          <path d="M0 31 C25 20 39 18 61 29 S96 41 120 27 S160 14 184 26 S195 31 200 28 V48 H0Z" fill="url(#adminSidebarWave)" />
          <path d="M0 30 C25 19 42 18 62 28 S98 39 120 26 S160 13 184 25 S195 30 200 27" fill="none" stroke="#368bff" stroke-opacity=".6" stroke-width="1" />
          <path d="M0 41 C31 30 47 33 72 40 S120 43 143 36 S179 31 200 38" fill="none" stroke="#2d66c7" stroke-opacity=".55" stroke-width="1" />
        </svg>
      </div>
    </nav>
  `,
  styles: [`
    :host {
      display: block;
      width: 236px;
      flex: 0 0 236px;
      /* The rail's height is set by the page (100vh minus the chrome
         strip). The host must fill it so the sidebar's own flex
         column can push its footer card to the bottom. */
      height: 100%;
      min-height: 0;
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 22px 11px 31px 9px;
      box-sizing: border-box;
      /* The reference's rail is a very slight vertical wash rather
         than a flat fill. */
      background: linear-gradient(
        180deg,
        var(--admin-sidebar-bg-top, #F9FBFE) 0%,
        var(--admin-sidebar-bg, #FAFBFE) 40%,
        var(--admin-sidebar-bg-bottom, #F7F9FE) 100%
      );
      border-right: 1px solid var(--admin-sidebar-border, #E9EDF5);
      /* The rail is a fixed-height flex column: the nav lists sit
         at the top, the footer card is pushed to the bottom by
         margin-top:auto, and the whole column scrolls if the
         viewport is too short for both. */
      overflow-y: auto;
    }
    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .nav-item {
      position: relative;
      display: flex;
      align-items: center;
      gap: 18px;
      height: 42px;
      padding: 0 12px 0 24px;
      border-radius: 9px;
      color: var(--admin-nav-text, #334155);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: background-color var(--duration-fast) var(--ease-out),
        color var(--duration-fast) var(--ease-out);
    }
    a.nav-item:hover {
      background: var(--admin-nav-hover-bg, #F1F4FB);
    }
    .nav-item.active {
      background: var(--admin-nav-active-bg, #F0EFFE);
      color: var(--admin-nav-active-text, #4F3DF5);
      font-weight: 600;
    }
    /* The reference's active row carries a slim blue bar inside
       the row's left edge. */
    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--color-primary);
      border-radius: 2px 0 0 2px;
    }
    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      flex: 0 0 20px;
      color: currentColor;
      opacity: 0.85;
    }
    .nav-item.active .icon {
      opacity: 1;
    }
    .label {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .badge {
      flex: 0 0 auto;
      min-width: 30px;
      height: 22px;
      padding: 0 8px;
      border-radius: 999px;
      background: var(--admin-badge-bg, #EEF1F8);
      color: var(--admin-badge-text, #64748B);
      font-size: 12px;
      font-weight: 700;
      line-height: 22px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .nav-item.active .badge {
      background: var(--color-primary);
      color: #ffffff;
    }
    /* The Settings rows are placeholders in the reference design.
       They render as static rows (not links) so they do not look
       like broken navigation. */
    .nav-item.is-static {
      color: var(--admin-nav-muted-text, #64748B);
      cursor: default;
    }
    .divider {
      height: 1px;
      margin: 7px 12px 18px;
      background: var(--admin-sidebar-border, #E9EDF5);
    }
    /* The reference uses a small uppercase eyebrow for this group. */
    .section-label {
      margin: 0 0 4px;
      padding: 0 12px 0 26px;
      color: var(--admin-section-label, #94A3B8);
      position: relative;
      top: 3px;
      font-size: 11px;
      letter-spacing: .035em;
      text-transform: uppercase;
      font-weight: 500;
    }
    .settings {
      gap: 4px;
    }
    .footer-card {
      margin-top: auto;
      margin-left: 14px;
      margin-right: 0;
      /* The reference pins the footer card to the bottom of the
         rail. margin-top:auto inside a flex column does that
         only when the column is TALLER than its content — so the
         rail's height is set by the page (100vh - the chrome
         strip), not by its own content. */
      min-height: 171px;
      padding: 23px 16px 16px;
      border-radius: 12px;
      background: var(--admin-footer-card-bg, #F5F7FD);
      border: 1px solid var(--admin-footer-card-border, #E9EEF9);
    }
    .footer-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 11px;
    }
    .crown {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      border-radius: 50%;
    }
    .footer-titles {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .footer-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--admin-nav-active-text, #4F3DF5);
    }
    .footer-subtitle {
      font-size: 13px;
      color: var(--admin-nav-muted-text, #64748B);
    }
    .footer-copy {
      margin: 0;
      font-size: 10.5px;
      line-height: 1.5;
      color: var(--admin-nav-muted-text, #64748B);
    }

    /* The supplied Admin sidebar reference uses a dark, floating
       workspace with a bright active item and blue wave footer. */
    .sidebar {
      position: relative;
      width: auto;
      height: calc(100% - 15px);
      margin: 0 28px 15px 10px;
      padding: 16px 14px 24px 15px;
      border-radius: 0 0 14px 14px;
      background: linear-gradient(180deg, #111b2e 0%, #121d31 55%, #101a2c 100%);
      border-right: 0;
    }
    .nav-list { gap: 1px; }
    .nav-item {
      height: 38px;
      gap: 11px;
      padding: 0 10px;
      color: #c2ccdc;
      font-size: 12px;
      border-radius: 9px;
    }
    .nav-item:hover,
    a.nav-item:hover { background: #1a2941; color: #f5f8ff; }
    .nav-item.active:hover,
    a.nav-item.active:hover {
      background: linear-gradient(105deg, #367eff 0%, #4d62fa 54%, #753af1 100%);
      color: #ffffff;
    }
    .nav-item.active {
      height: 36px;
      background: linear-gradient(105deg, #367eff 0%, #4d62fa 54%, #753af1 100%);
      color: #ffffff;
      box-shadow: 0 0 17px rgba(70, 93, 255, .6), 0 7px 18px rgba(38, 92, 230, .28);
    }
    .nav-item.active::before { display: none; }
    .nav-item.active .icon { color: #ffffff; }
    .badge {
      min-width: 27px;
      height: 20px;
      padding: 0 7px;
      background: #173b51;
      color: #7de4e0;
      font-size: 11px;
      line-height: 20px;
    }
    .nav-item.active .badge {
      background: rgba(255,255,255,.22);
      color: #ffffff;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
    }
    .divider { margin: 11px 9px 7px; background: #29364b; }
    .section-label { margin-bottom: 3px; padding-left: 9px; color: #8694ad; }
    .settings { gap: 1px; }
    .settings .nav-item { height: 36px; }
    .settings .nav-item.is-static { color: #b8c3d5; }
    .settings .nav-item.is-static .icon { color: #b8c3d5; }
    .footer-card {
      position: relative;
      overflow: hidden;
      margin-left: 0;
      margin-right: 0;
      min-height: 132px;
      padding: 12px 14px;
      background: linear-gradient(145deg, #1b2940 0%, #17243a 100%);
      border-color: #2b3b58;
      box-shadow: 0 8px 20px rgba(3, 8, 20, .18);
    }
    .footer-head,
    .footer-copy { position: relative; z-index: 1; }
    .footer-head { margin-bottom: 8px; gap: 10px; }
    .crown { width: 28px; height: 28px; flex-basis: 28px; }
    .crown {
      background: radial-gradient(circle at 35% 25%, #ffd867 0%, #cf8a12 82%);
      box-shadow: 0 0 18px rgba(250, 181, 43, .18);
    }
    .footer-title { color: #f5f7fc; font-size: 12px; }
    .footer-subtitle { color: #aab8d0; font-size: 11px; }
    .footer-copy { color: #c0cadb; }
    .footer-waves {
      position: absolute;
      z-index: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 36px;
      pointer-events: none;
    }
  `],
})
export class AdminSidebarComponent {
  /** The live badge counts for the Tickets / Users nav rows. */
  readonly badge = input<AdminSidebarBadge>({});

  /** The Settings section's placeholder rows. */
  readonly settingsItems = computed(() =>
    [
      { label: 'Categories', icon: 'folder' },
      { label: 'Priorities', icon: 'flag' },
      { label: 'Custom Fields', icon: 'table' },
      { label: 'Email Templates', icon: 'mail' },
      { label: 'SLA & Automations', icon: 'clock' },
      { label: 'Integrations', icon: 'link' },
      { label: 'Audit Logs', icon: 'clock' },
      { label: 'Settings', icon: 'gear' },
    ] as const,
  );

  /** Thousands-separated count for the nav badges. */
  protected format(n: number): string {
    return n.toLocaleString('en-US');
  }
}
