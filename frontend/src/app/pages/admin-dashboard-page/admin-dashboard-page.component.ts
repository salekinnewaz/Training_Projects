/**
 * AdminDashboardPageComponent — WDS-2026 Admin Workspace.
 *
 * The `/admin` page. A three-region workspace:
 *
 *   ┌──────────┬─────────────────────────────────────────────┐
 *   │          │  ┌───────────────────────────────────────┐  │
 *   │ sidebar  │  │ hero: greeting + stat chips + art    │  │
 *   │          │  └───────────────────────────────────────┘  │
 *   │          │  [ Total ][ Open ][ In Prog ][ Res ][ Closed ]│
 *   │          │  ┌───────────────────────┬───────────────┐  │
 *   │          │  │ Recent Tickets        │ Users Overview│  │
 *   │          │  └───────────────────────┴───────────────┘  │
 *   │          │  ┌────────────┬────────────┬──────────────┐  │
 *   │          │  │ Trends     │ Priority   │ Recent Users │  │
 *   │          │  └────────────┴────────────┴──────────────┘  │
 *   └──────────┴─────────────────────────────────────────────┘
 *
 * The page reads ONE endpoint — GET /api/admin/workspace — which
 * carries all six widgets' data. A failure renders the error
 * state; a success renders every widget.
 *
 * The legacy two-tab layout (Tickets / Users) is gone: the
 * sidebar now carries that navigation, and the Tickets list and
 * the Users page remain reachable at /tickets and /users.
 *
 * Render states (mutually exclusive @switch):
 *   loading → the workspace skeleton
 *   error   → inline error + Retry button
 *   success → the workspace
 */

import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { TicketService } from '../../services/ticket.service';
import { ApiError } from '../../services/api-error';
import { AuthService } from '../../services/auth.service';
import type {
  AdminWorkspaceBundle,
  TicketStats,
  TrendBucket,
} from '../../services/ticket.service';
import { AppChromeComponent } from '../../components/patterns/app-chrome/app-chrome.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';
import { BadgeStatusComponent } from '../../components/atoms/badge-status/badge-status.component';
import { BadgePriorityComponent } from '../../components/atoms/badge-priority/badge-priority.component';
import { ChromeAvatarComponent } from '../../components/atoms/chrome-avatar/chrome-avatar.component';
import {
  DonutChartComponent,
  type DonutSlice,
} from '../../components/atoms/donut-chart/donut-chart.component';
import {
  StackedBarChartComponent,
  type StackedBar,
  type ChartLegendEntry,
} from '../../components/atoms/stacked-bar-chart/stacked-bar-chart.component';
import { AdminHeroComponent } from '../../components/molecules/admin-hero/admin-hero.component';
import { AdminSidebarComponent } from '../../components/molecules/admin-sidebar/admin-sidebar.component';
import {
  StatStripComponent,
  type StatStripItem,
} from '../../components/molecules/stat-strip/stat-strip.component';
import type { Ticket } from '../../models/ticket';
import type { TicketPriority, TicketStatus } from '../../models/enums';

type RenderState = 'loading' | 'error' | 'success';

const GENERIC_LOAD_ERROR = "Couldn't load the workspace. Refresh to try again.";

/** The status colours the reference uses for pills and chart keys. */
const STATUS_COLOR: Record<TicketStatus, string> = {
  Open: '#7C5CF0',
  'In Progress': '#F5A623',
  Resolved: '#22C55E',
  Closed: '#CBD5E1',
};

/**
 * The colours the reference paints the TRENDS chart's bars with.
 *
 * The reference's legend carries the saturated palette above, but
 * the bars themselves are washed out and shaded: each segment is a
 * vertical gradient whose bottom is a lighter tint and whose top is
 * a touch more saturated. "In Progress" is the striking one — it
 * sweeps from a dusty rose at the bottom of the band to amber at
 * the top, which is what gives the reference's bars their pink
 * middle stripe.
 *
 * Measured off the reference PNG (the bar at page x=360):
 *   Open        #9584f9 (bottom) → #8a7ffc (top)
 *   In Progress #f89ba8 (bottom) → #ffd780 (top)
 *   Resolved    #81dcb4 (bottom) → #78deb9 (top)
 *   Closed      #cdd4e1 (bottom) → #d6dae3 (top)
 */
const TREND_BAR_COLOR: Record<TicketStatus, { bottom: string; top: string }> = {
  Open: { bottom: '#9584F9', top: '#8A7FFC' },
  'In Progress': { bottom: '#F89BA8', top: '#FFD780' },
  Resolved: { bottom: '#81DCB4', top: '#78DEB9' },
  Closed: { bottom: '#CDD4E1', top: '#D6DAE3' },
};

/** The priority colours the reference uses for the distribution donut. */
const PRIORITY_COLOR: Record<TicketPriority | 'None', string> = {
  High: '#EF4444',
  Medium: '#F5A623',
  Low: '#3B82F6',
  None: '#CBD5E1',
};

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [
    AppChromeComponent,
    ButtonComponent,
    BadgeStatusComponent,
    BadgePriorityComponent,
    ChromeAvatarComponent,
    DonutChartComponent,
    StackedBarChartComponent,
    AdminHeroComponent,
    AdminSidebarComponent,
    StatStripComponent,
    // The three "View all" links point at the full queue (/tickets)
    // and the Users page (/users). Without RouterLink in the
    // standalone component's imports, Angular renders the anchor
    // with a literal `routerlink` attribute and NO href — so the
    // link is inert and is not exposed as a link at all.
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-chrome [wide]="true">
      <div class="workspace">
        <admin-sidebar
          class="rail"
          [badge]="{ tickets: totalTickets(), users: totalUsers() }"
        />

        <div class="main">
          @switch (renderState()) {
            @case ('loading') {
              <div class="skeleton" data-testid="admin-workspace-skeleton" aria-busy="true">
                <div class="skeleton-hero"></div>
                <div class="skeleton-strip">
                  @for (i of [1, 2, 3, 4, 5]; track i) {
                    <div class="skeleton-card"></div>
                  }
                </div>
                <div class="skeleton-row">
                  <div class="skeleton-card tall"></div>
                  <div class="skeleton-card tall"></div>
                </div>
              </div>
            }
            @case ('error') {
              <div class="error-card" role="alert">
                <p class="error-message">{{ errorMessage() }}</p>
                <atom-button variant="primary" size="md" (pressed)="onRefresh()">
                  Retry
                </atom-button>
              </div>
            }
            @case ('success') {
              <!-- ── Hero ─────────────────────────────────── -->
              <admin-hero
                [displayName]="displayName()"
                greetingOverride="Good morning"
                [totalTickets]="totalTickets()"
                [totalUsers]="totalUsers()"
                [newUsersThisWeek]="newUsersThisWeek()"
                [ticketDelta]="ticketDelta()"
              />

              <!-- ── Stat strip ────────────────────────────── -->
              <div class="stat-strip" data-testid="admin-stat-strip">
                <stat-strip
                  variant="stacked"
                  totalGlyph="people"
                  [total]="totalTickets()"
                  [statusItems]="statusItems()"
                  totalLabel="Total Tickets"
                  [delta]="ticketDelta()"
                  [deltaLabel]="deltaLabel()"
                  caption="vs last month"
                />
              </div>

              <!-- ── Row 2: Recent Tickets + Users Overview ── -->
              <div class="grid-row-2">
                <section class="card recent-tickets" data-testid="admin-recent-tickets">
                  <header class="card-head">
                    <h2 class="card-title">
                      <span class="title-icon" aria-hidden="true">
                        <!-- The reference draws a TICKET — a rectangle
                             with a notch bitten out of each side. -->
                        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 5.5 h14 v3 a1.5 1.5 0 0 0 0 3 v3 H3 v-3 a1.5 1.5 0 0 0 0-3 Z" />
                        </svg>
                      </span>
                      Recent Tickets
                    </h2>
                    <a class="view-all" routerLink="/tickets">
                      View all
                      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 8 h10 M9 4 l4 4 -4 4" />
                      </svg>
                    </a>
                  </header>

                  <div class="table-wrap">
                    <table class="tickets-table">
                      <!-- The column tracks are declared on a <colgroup>
                           rather than on the header cells, because with
                           a fixed table layout the FIRST row's cells
                           decide the widths — and the <col> element is
                           the one place a column's width can be a
                           minmax() (a floor and a share), which is
                           what lets the table compress instead of
                           clipping.

                           The floors are each column's own content
                           width; the shares are the reference's
                           proportions. At the reference's 816px table
                           the shares win and the columns land on
                           107 / 228 / 108 / 100 / 160 / 113 exactly as
                           the reference draws them; narrower, each
                           column slides down to its floor and the
                           Title column takes what is left. -->
                      <colgroup>
                        <col class="col-num" />
                        <col class="col-title" />
                        <col class="col-status" />
                        <col class="col-priority" />
                        <col class="col-assignee" />
                        <col class="col-updated" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th scope="col" class="col-num">#</th>
                          <th scope="col">Title</th>
                          <th scope="col">Status</th>
                          <th scope="col">Priority</th>
                          <th scope="col">Assignee</th>
                          <th scope="col">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (ticket of recentTickets(); track ticket.id) {
                          <tr
                            class="ticket-row"
                            (click)="openTicket(ticket)"
                            tabindex="0"
                            (keydown.enter)="openTicket(ticket)"
                            (keydown.space)="openTicket(ticket); $event.preventDefault()"
                          >
                            <td class="col-num">
                              <span class="num-cell">
                                <!-- The reference draws a DOCUMENT with a
                                     folded top-right corner and a short
                                     dash inside it. -->
                                <span class="file-icon" aria-hidden="true">
                                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3.5 1.8 h5.4 l3.6 3.6 v8.8 h-9 Z" />
                                    <path d="M8.9 1.8 v3.6 h3.6" />
                                    <path d="M5.6 8.8 h4.8" />
                                  </svg>
                                </span>
                                {{ ticket.number }}
                              </span>
                            </td>
                            <td class="col-title">
                              <span class="title-text" [title]="ticket.title">{{ ticket.title }}</span>
                            </td>
                            <td><badge-status [status]="ticket.status" /></td>
                            <td><badge-priority [priority]="ticket.priority" /></td>
                            <td>
                              <span class="assignee">
                                @if (ticket.owner; as owner) {
                                  <chrome-avatar [displayName]="owner.displayName" [size]="24" />
                                  <span class="assignee-name">{{ owner.displayName }}</span>
                                } @else {
                                  <span class="avatar avatar-unassigned" aria-hidden="true">
                                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                      <circle cx="8" cy="5.4" r="2.6" />
                                      <path d="M3 13.4 a5 5 0 0 1 10 0" />
                                    </svg>
                                  </span>
                                  <span class="assignee-name is-muted">Unassigned</span>
                                }
                              </span>
                            </td>
                            <td class="updated-cell">{{ relativeTime(ticket.updatedAt) }}</td>
                          </tr>
                        } @empty {
                          <tr>
                            <td colspan="6" class="empty-cell">No tickets yet</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </section>

                <section class="card users-overview" data-testid="admin-users-overview">
                  <header class="card-head">
                    <h2 class="card-title">
                      <span class="title-icon" aria-hidden="true">
                        <!-- The reference draws a single user INSIDE a
                             ring, not the two-person "users" glyph. -->
                        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="10" cy="10" r="7.2" />
                          <circle cx="10" cy="7.4" r="2.4" />
                          <path d="M5.6 15 a4.7 4.7 0 0 1 8.8 0" />
                        </svg>
                      </span>
                      Users Overview
                    </h2>
                    <a class="view-all" routerLink="/users">
                      View all
                      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 8 h10 M9 4 l4 4 -4 4" />
                      </svg>
                    </a>
                  </header>

                  <div class="overview-body">
                    <div class="donut-wrap">
                      <atom-donut-chart
                        [slices]="userSlices()"
                        [size]="145"
                        [stroke]="28"
                        ariaLabel="Active and inactive users"
                      >
                        <span class="donut-centre">
                          <span class="donut-value">{{ usersOverview().total }}</span>
                          <span class="donut-label">Total Users</span>
                        </span>
                      </atom-donut-chart>
                    </div>

                    <ul class="legend" role="list">
                      @for (entry of userLegend(); track entry.key) {
                        <!-- The reference's legend row reads
                             dot | count | label | ..... | percentage —
                             the COUNT sits between the dot and the
                             label, and the percentage is pushed to
                             the card's right edge. The dot itself
                             sits inside a soft tinted disc. -->
                        <li class="legend-row">
                          <span class="legend-dot" [style.background]="entry.color"></span>
                          <span class="legend-value">{{ entry.value }}</span>
                          <span class="legend-label">{{ entry.label }}</span>
                          <span class="legend-pct">{{ entry.pct }}</span>
                        </li>
                      }
                    </ul>

                    <div class="divider"></div>

                    <!-- The reference's per-role breakdown sits BELOW
                         the divider and STACKS vertically — Admins,
                         Support Agents, then Employees — each led by
                         a tinted rounded-square badge. -->
                    <ul class="legend roles" role="list">
                      @for (entry of roleLegend(); track entry.key) {
                        <li class="legend-row role-cell">
                          <span class="legend-icon" [class]="entry.icon">
                            @switch (entry.icon) {
                              @case ('crown') {
                                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M4 12.5 h8 v1.2 a1 1 0 0 1-1 1 H5 a1 1 0 0 1-1-1 Z" />
                                  <path d="M4.2 11.4 L3 5.4 l3.6 2.7 L8 4.2 l1.4 3.9 L13 5.4 l-1.2 6 Z" />
                                </svg>
                              }
                              @case ('agent') {
                                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                  <circle cx="6.4" cy="5.6" r="2.4" />
                                  <path d="M2.6 13.4 a3.9 3.9 0 0 1 7.6 0" />
                                  <circle cx="11.6" cy="6.2" r="1.8" />
                                  <path d="M11 10.2 a3 3 0 0 1 3.2 2.6" />
                                </svg>
                              }
                              @default {
                                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                  <circle cx="8" cy="5.6" r="2.6" />
                                  <path d="M4.2 13.4 a3.9 3.9 0 0 1 7.6 0" />
                                </svg>
                              }
                            }
                          </span>
                          <span class="legend-value">{{ entry.value }}</span>
                          <span class="legend-label">{{ entry.label }}</span>
                          <span class="legend-pct">{{ entry.pct }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                </section>
              </div>

              <!-- ── Row 3: Trends + Priority + Recent Users ── -->
              <div class="grid-row-3">
                <section class="card trends" data-testid="admin-ticket-trends">
                  <header class="card-head">
                    <h2 class="card-title">
                      <span class="title-icon" aria-hidden="true">
                        <!-- The reference draws three ascending bars
                             with a trend line rising over them and an
                             arrowhead at the top right. -->
                        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3.4 17 V11.6 M8.6 17 V8.4 M13.8 17 V4.4" />
                          <path d="M2.4 13.4 L8.2 9.6 L11.6 11 L17.4 4.6" />
                          <path d="M13.6 4.4 h4 v4" />
                        </svg>
                      </span>
                      Ticket Trends
                    </h2>
                    <span class="period-pill">
                      Last {{ trendsDays() }} days
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 6 L8 10 L12 6" />
                      </svg>
                    </span>
                  </header>

                  <div class="chart-wrap">
                    <atom-stacked-bar-chart
                      [bars]="trendBars()"
                      [width]="463"
                      [height]="163"
                      [axisGutter]="27.5"
                      [bottomGutter]="28.5"
                      [topGutter]="15.5"
                      [plotRightInset]="9"
                      [barFill]="0.558"
                      ariaLabel="Tickets created per day by status"
                    />
                  </div>

                  <ul class="chart-legend" role="list">
                    @for (entry of trendLegend(); track entry.key) {
                      <li class="chart-legend-item">
                        <span class="legend-square" [style.background]="entry.color"></span>
                        {{ entry.label }}
                      </li>
                    }
                  </ul>
                </section>

                <section class="card priority" data-testid="admin-priority-distribution">
                  <header class="card-head">
                    <h2 class="card-title">
                      <span class="title-icon" aria-hidden="true">
                        <!-- The reference draws a TAG — a rounded
                             pentagon with a punched hole at the
                             upper right — not a target. -->
                        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M10 2.6 a6.6 6.6 0 0 0-4.7 1.9 L2.9 6.9 a2 2 0 0 0 0 2.8 l5.4 5.4 a2 2 0 0 0 2.8 0 l2.4-2.4 a6.6 6.6 0 0 0 1.9-4.7 a6.6 6.6 0 0 0-5.4-5.4 Z" />
                          <circle cx="13.4" cy="6.6" r="1.5" />
                        </svg>
                      </span>
                      Priority Distribution
                    </h2>
                  </header>

                  <div class="priority-body">
                    <!-- The reference draws a hairline between the
                         card's header and its body, at page y=757. -->
                    <div class="priority-divider"></div>

                    <div class="donut-wrap">
                      <atom-donut-chart
                        [slices]="prioritySlices()"
                        [size]="146"
                        [stroke]="28"
                        ariaLabel="Tickets by priority"
                      >
                        <span class="donut-centre">
                          <span class="donut-value">{{ totalTickets() }}</span>
                          <span class="donut-label">Tickets</span>
                        </span>
                      </atom-donut-chart>
                    </div>

                    <ul class="legend" role="list">
                      @for (entry of priorityLegend(); track entry.key) {
                        <li class="legend-row">
                          <span class="legend-dot" [style.background]="entry.color"></span>
                          <span class="legend-label">{{ entry.label }}</span>
                          <span class="legend-value">{{ entry.value }}</span>
                          <span class="legend-pct">{{ entry.pct }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                </section>

                <section class="card recent-users" data-testid="admin-recent-users">
                  <header class="card-head">
                    <h2 class="card-title">
                      <span class="title-icon" aria-hidden="true">
                        <!-- The reference's glyph is a hand-drawn
                             "user in a bubble" — traced off the PNG
                             (icons-all.mjs): a rounded-square outline
                             spanning x 1149..1163 and y 716..733 whose
                             bottom-right corner is left open, with a
                             small head-and-shoulders figure sitting
                             in the upper-middle of it. The strokes
                             wobble a little, the same pen family as
                             the hero's ticket glyph. -->
                        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M18.2 20.4 c-0.6 1 -1.8 1.5 -3.4 1.5 H6.6 c-2.1 0 -3.4 -1.5 -3.4 -3.5 V7.2 c0 -2 1.3 -3.5 3.4 -3.5 h7.4 c1.6 0 2.7 0.5 3.3 1.5" />
                          <path d="M17.9 8.4 c1.1 1.2 1.7 2.8 1.7 4.5 v3.7" />
                          <path d="M10.4 7.7 c1.2 0 2.1 0.9 2.1 2 c0 0.7 -0.4 1.3 -1 1.7 c1.3 0.5 2.2 1.4 2.4 2.8 c0.1 0.6 -0.2 0.9 -0.7 1 c-0.5 0.1 -0.9 -0.2 -1 -0.8 c-0.2 -1.1 -1.1 -1.8 -2.4 -1.8 c-1.3 0 -2.2 0.7 -2.4 1.8 c-0.1 0.6 -0.5 0.9 -1 0.8 c-0.5 -0.1 -0.8 -0.4 -0.7 -1 c0.2 -1.4 1.1 -2.3 2.4 -2.8 c-0.6 -0.4 -1 -1 -1 -1.7 c0 -1.1 0.9 -2 2.3 -2 Z" />
                        </svg>
                      </span>
                      Recent Users
                    </h2>
                    <a class="view-all" routerLink="/users">
                      View all
                      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 8 h10 M9 4 l4 4 -4 4" />
                      </svg>
                    </a>
                  </header>

                  <ul class="ru-list" role="list">
                    @for (user of recentUsers(); track user.id; let i = $index) {
                      <li class="ru-row" [style.--avatar-bg]="avatarBg(i)" [style.--avatar-fg]="avatarFg(i)">
                        <chrome-avatar
                          class="ru-avatar"
                          [displayName]="user.displayName"
                          [size]="40"
                        />
                        <span class="ru-meta">
                          <span class="ru-name">{{ user.displayName }}</span>
                          <span class="ru-role">{{ roleLabel(user.role) }}</span>
                        </span>
                        <span class="ru-dot" [class.is-offline]="!user.isActive"></span>
                        <span class="ru-time">{{ relativeTime(user.lastActiveAt ?? user.createdAt) }}</span>
                      </li>
                    } @empty {
                      <li class="empty-cell">No users yet</li>
                    }
                  </ul>
                </section>
              </div>
            }
          }
        </div>
      </div>
    </app-chrome>
  `,
  styles: [`
    :host {
      display: block;
      flex: 1 1 auto;

      /* The reference's page canvas is a soft diagonal wash rather
         than the app's flat --color-page-bg: the shadow-free gaps
         between the rows read #F9FBFE at the top-left and #F2F7FE
         at the bottom-right (y=316 and y=1000 respectively). The
         wash is scoped to the admin page so the employee and agent
         dashboards keep the app-wide flat canvas.

         The wash is anchored to the viewport (background-attachment:
         fixed) so the gradient's extent does not stretch with the
         page's height — the reference's wash is a fixed diagonal
         over the 1024px design frame. */
      background: linear-gradient(135deg, #f8fbfe 0%, #f3f7fe 55%, #f2f7fe 100%);
      background-attachment: fixed;

      /* The Admin Workspace draws its status and priority pills in
         its own palette — sampled from the reference screenshot and
         kept off the User/Agent surfaces. Re-pointing the app-wide
         tokens here cascades them into the badge atoms, which read
         them by name. */
      --status-open-bg: var(--admin-status-open-bg);
      --status-open-text: var(--admin-status-open-text);
      --status-in-progress-bg: var(--admin-status-in-progress-bg);
      --status-in-progress-text: var(--admin-status-in-progress-text);
      --status-resolved-bg: var(--admin-status-resolved-bg);
      --status-resolved-text: var(--admin-status-resolved-text);
      --status-closed-bg: var(--admin-status-closed-bg);
      --status-closed-text: var(--admin-status-closed-text);
      --priority-low-bg: var(--admin-priority-low-bg);
      --priority-low-text: var(--admin-priority-low-text);
      --priority-medium-bg: var(--admin-priority-medium-bg);
      --priority-medium-text: var(--admin-priority-medium-text);
      --priority-high-bg: var(--admin-priority-high-bg);
      --priority-high-text: var(--admin-priority-high-text);
    }
    /* The workspace is a full-bleed two-column grid: the sidebar
       rail is a fixed 248px, the main column takes the rest.

       The reference puts the sidebar hard against the viewport's
       left edge (it starts at x=0, not inside the page gutter),
       so the rail pulls itself back out of the chrome's 32px
       gutter with a negative margin. The main column then starts
       at 248 + 36 = 284px and ends at 1507px, which are exactly
       where the reference's first and last cards begin and end. */
    .workspace {
      display: flex;
      align-items: stretch;
      gap: 36px;
      width: 100%;
      margin: 0 auto;
      padding: 0 0 40px;
      box-sizing: border-box;
      /* The admin design is set in the geometric Figtree face. It is
         scoped to this workspace so the employee and agent
         dashboards keep the app-wide Inter face. */
      font-family: var(--font-admin, "Figtree", var(--font-sans));
    }
    .rail {
      position: sticky;
      top: var(--chrome-height);
      align-self: flex-start;
      height: calc(100vh - var(--chrome-height));
      min-height: 0;
      margin-left: -32px;
      padding-left: 0;
    }
    /* The sidebar host fills the rail so its footer card can be
       pushed to the bottom of the viewport. */
    .rail > admin-sidebar {
      height: 100%;
    }
    .main {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      /* The reference's content column runs x=284..1507 — 1224px
         wide, with the last card's 1px right border on x=1507. The
         rail + gutter put the column's left edge at 284, so the
         column starts flush against it and the right inset is
         trimmed to 28px to land that border on the reference's
         pixel. */
      padding: 0 28px 0 0;
    }
    /* The reference's vertical rhythm, measured off the PNG's card
       borders:
         hero     y  65..221
         strip    y 222..311   (90px)
         row 2    y 328..680   (353px)
         row 3    y 692..985   (294px)
       so the gaps are 1px below the hero, 16px below the strip and
       11px below row 2. */
    .stat-strip {
      margin-top: 1px;
      /* The admin reference's strip is a 1223px row whose five cards
         measure 259 / 225 / 230 / 229 / 230px wide with gaps of
         11-14px — narrower and shorter than the HD-021 strip's own
         reference, so the shared molecule is re-proportioned here
         through its custom properties (its defaults are untouched,
         so the Employee dashboard and the Agent ticket list are
         unaffected).

         The widths are the reference's measured card extents, with
         the 12px of gap between them removed before they are turned
         into fractions:
           259 - 12 = 247 | 225 - 12 = 213 | 230 - 12 = 218
           229 - 12 = 217 | 230 - 12 = 218
         which sum to 1113 against the 1223px row minus four 12px
         gaps (1175px of card). */
      /* The tracks are FLOORED, not just fractional.

         The reference's card widths are the fractions above, but a
         pure fractional split is only correct while the strip is
         exactly the reference's width. The moment the strip narrows,
         every card narrows with it — and the Total card's "Total
         Tickets" label (73px of ink, in a box that is
         'card width - 176' wide) stops fitting at a card narrower
         than 249px, which is 239.7px at a 1440px viewport. The label
         then ellipsises to "Total Tic…".

         The floors restore the reference's 1536px geometry exactly
         (at a 1224px strip the fractions still win — 261 / 225 /
         230 / 229 / 230 — so nothing moves) AND hold the floor
         below it: the Total card never drops under 252px and no
         status card drops under 204px, which is the width at which
         the longest status label ("In Progress", 64px of ink in a
         'card width - 140' box) still fits.

         Below the width where the five floors can all hold — the
         floors need 252 + 4x204 + 4x12 = 1116px of strip, which is
         a 1428px viewport — the strip steps down to three columns
         (and then to two), which is the shared molecule's own
         documented ladder, reached through the SAME custom
         properties so the molecule is never forked. */
      --stat-strip-columns:
        minmax(252px, 247fr)
        minmax(204px, 213fr)
        minmax(204px, 218fr)
        minmax(204px, 217fr)
        minmax(204px, 218fr);
      --stat-strip-gap: 12px;
      /* The reference's strip card runs y=222..311 — 90px tall. */
      --stat-strip-card-height: 90px;
      /* The reference's icon tile is a 52x52 tinted rounded square at
         card+17 .. card+68 horizontally and card+19 .. card+70
         vertically.

         Measured off the reference PNG: the tint's first painted
         pixel is at x=306 / y=241 on the Total card, whose origin is
         x=285 / y=222 — so card+21 / card+19 for the LAVENDER
         tile, whose rounded corner starts a pixel in. The status
         cards' paler tiles run card+17..card+68.

         The offsets are from the card's PADDING box, whose left edge
         sits 1px inside the border box, so the tile's left edge
         lands at card+17. */
      --stat-strip-tile-size: 52px;
      --stat-strip-tile-left: 16px;
      --stat-strip-tile-top: 18px;
      /* The reference's value and label share ONE left edge — and
         that edge is NOT the same on the Total card as on the status
         cards.

         The reference's STATUS cards put their text at card+79: the
         Open card's value ink runs x 633..656 (card+79..+102) and
         its label ink x 633..661 (card+79..+108); the In Progress
         card's value runs card+80..+103 and its label card+79..+142.

         The reference's TOTAL card puts its text 4px further right,
         at card+83: its value ink runs x 368..405 (card+83..+120)
         and its label ink card+83..+155.

         These offsets are from the card's BORDER box; the tile's
         left edge is at card+17, so the status cards leave 62px of
         clear space between the tile and the text, and the Total
         card leaves 66px. */
      --stat-strip-label-left: 78px;
      --stat-strip-value-left: 78px;
      --stat-strip-total-text-left: 82px;
      /* The Admin reference's Total card packs four pieces of text
         into one 261px card: the value, the delta pill, the label
         and the caption. Measured against the reference PNG:

           value ink   card+90 .. card+118
           label ink   card+84 .. card+155   (71px)
           caption ink card+190 .. card+244  (55px)
           delta pill  card+189 .. card+239

         The label and the caption share the card's lower row, so
         both have to be narrow enough to leave the reference's
         ~35px of clear space between them — at the shared
         molecule's defaults the label's box ran into the caption's
         and the two overlapped. */
      --stat-strip-label-size: 12.5px;
      /* The Admin reference's labels are Figtree 700 at 12.5px with
         NORMAL tracking. Measured off the reference PNG the five
         labels are 73, 30, 64, 51 and 39px of ink over a 9-10px cap
         height, which is exactly what Figtree 700 at 12.5px renders
         (73, 31, 63, 51, 39) — letterform for letterform, including
         the "C"'s cut terminal and the "e"'s bar.

         The -0.7px tracking that used to be here shaved 5-9px off
         every label (we rendered 63, 29, 55, 46, 35) and was the
         reason the strip's text block never reached the width the
         reference draws. */
      --stat-strip-label-tracking: 0;
      --stat-strip-label-weight: 700;
      /* The Admin reference's stat VALUES are set in Roboto Condensed,
         not in the admin's body face. Measured off the reference PNG
         the value "156" has a 37x19px ink box whose per-glyph widths
         are 7, 11 and 12px, and the trace shows a "1" that is a bare
         stem with no foot serif, a "5" with a flat top bar over a left
         stem, and a "6" with a round bowl.

         Roboto Condensed 700 at 26px reproduces those three letterforms
         stroke-for-stroke and hits the 37x19 box exactly. A normal
         grotesque cannot reach it: Figtree 700 at 26px measures 40x20
         (glyphs 7/12/13), and at 23px — where the widths finally
         match — its cap height drops to 17px. */
      --stat-strip-value-font: 'Roboto Condensed', var(--font-admin);
      --stat-strip-value-weight: 600;
      --stat-strip-value-tracking: 0;
      --stat-strip-caption-size: 12px;
      /* The admin reference's status cards carry a wide sparkline
         and NO share-of-total progress bar.

         Measured off the PNG (Open card, card origin x=554 /
         y=222): the blue stroke runs x 695..745 (card+141..+191)
         and y 267..282 (card+45..+60). The polyline's left end
         sits low and it rises to the right, dipping once around
         card+168.

         The stroke's vertical band (card+45..+60) sits ABOVE the
         card's label glyphs (card+61..+70), so the reference's
         curve and its label do not collide. The spark's box is
         26px tall and its top is card+37, which puts the wash's
         top edge there. */
      --stat-strip-spark-width: 78px;
      --stat-strip-spark-height: 26px;
      --stat-strip-spark-top: 37px;
      --stat-strip-spark-right: 17px;
      --stat-strip-bar-display: none;
      /* The Admin reference draws its status sparklines in the card's
         OWN accent at full strength — the Open card's curve is a
         saturated blue whose darkest pixels sample at #2878FC, and
         it is a sharp polyline rather than a smooth curve.

         The shared --stat-spark-* tokens carry the HD-021
         reference's pale washes instead (the curves there are pale,
         and the amber family borrows the shared periwinkle), so the
         Admin page re-points them at its own saturated family.

         These are the values sampled off ref-strip-now.png, where
         each status card's curve is plainly its own hue: blue, amber,
         green and slate. */
      --stat-spark-open: #2878fc;
      --stat-spark-in-progress: #feb021;
      --stat-spark-resolved: #08d076;
      --stat-spark-closed: #5d749d;
    }

    /* ── Recent Tickets table ─────────────────────────────────────────
       The Admin reference's table is laid out to a fixed set of
       column starts, all measured off the reference PNG. The card's
       content box starts at page x=304 (inside the card's 18px of
       left padding) and the table is full-bleed to the card's edges:

         file icon   304..317   (14px wide)
         ticket no.  336..373   "HD-53"
         Title       411..590   "Health check failing on server"
         Status      639..681   the pill (dot 639..646)
         Priority    747..785   the pill (dot 747..754)
         Assignee    854..952   the avatar (854..866) and the name
         Updated     1015..1054 "16m ago"

       The header is a BANDED row — a #F8F9FC fill from y=392 to
       y=432 — with the column labels sitting inside it, and the
       rows are 48px tall with a hairline separator at y=478, 526,
       574 and 623.

       The table's own overrides live in styles.css, alongside the
       other Admin Workspace rules — they are the heaviest block on
       the page and would otherwise push this component's inline
       style budget over its 8kB ceiling. */
    .grid-row-2 {
      /* The stat strip's bottom edge is y=311 and the second row's
         top edge is y=328 — a 16px gap. */
      margin-top: 16px;
      /* The reference's second row runs y=328..680 — 353px tall. The
         Recent Tickets table's five rows plus the Users Overview
         donut and its two legend blocks fill it exactly. */
      height: 353px;
    }
    .grid-row-3 {
      /* The second row's bottom edge is y=680 and the third row's top
         edge is y=692 — an 11px gap. */
      margin-top: 11px;
      /* The reference's third row runs y=692..985 — 294px tall. */
      height: 294px;
    }
    .grid-row-2 > .card,
    .grid-row-3 > .card {
      height: 100%;
      /* A grid item defaults to an automatic minimum size, so a card
         whose content is taller than its track would push the whole
         row past the reference's row height. The reference's rows are
         fixed-height bands, so the content clips instead. */
      min-height: 0;
      overflow: hidden;
    }
    /* The reference's "Ticket Trends" card is measured off the
       screenshot, and every number below is a PAGE coordinate:

         card      x 284..781, y 692..985
         icon      a 32px tile at x=303, y=708
         divider   a 1px rule at y=757, spanning x 302..765
         plot      the y-axis rule at x=329.5, the gridlines at
                   y 773.5 / 803.25 / 833 / 862.75 / 892.5
                   (so the plot runs 119px for 40 tickets) and the
                   gridlines' right end at x=756
         bars      34px wide on a 60.9px pitch, the first at
                   x=343
         x-labels  ink at y 906..914
         legend    12px swatches at y 939..950, the first at x=344

       The card's own padding is therefore 18px on the left and 15px
       on the right, and the header is 16px deep at the top — the
       shared card's 18px/20px padding would push every one of these
       landmarks out of place. */
    .card.trends {
      padding: 16px 15px 0 18px;
    }
    .card.trends .card-head {
      margin-bottom: 0;
      /* The header's rule sits 17px below the icon tile's top, at
         y=757 — so the head is padded out to the rule and the rule
         is its border. */
      padding-bottom: 16px;
      border-bottom: 1px solid var(--admin-card-border);
      min-height: 33px;
    }
    .card.trends .title-icon {
      width: 32px;
      height: 32px;
      flex: 0 0 32px;
      border-radius: 10px;
    }
    /* The chart's SVG is laid out in page pixels so the plot's
       landmarks can be placed exactly: the plot runs from the
       divider down to the baseline, with the y-axis rule at the
       card's content origin plus the axis gutter. */
    .card.trends .chart-wrap {
      margin-top: 0;
      /* The wrap is a flex child that would otherwise GROW to fill
         the card's leftover height and push the legend to the card's
         bottom edge. The reference's legend sits directly under the
         x-axis labels (its swatches' ink starts at y=939, 25px below
         the labels' ink at 905..914), with blank card space beneath
         it — so the wrap keeps its natural height here. */
      flex: 0 0 auto;
    }
    .card.trends .chart-legend {
      margin-top: 15px;
      /* The reference's four legend items sit in ONE row on a fixed
         30px rhythm — their swatches start at x 344, 426, 541 and
         644, and the last label ends at x 704, short of the card's
         right edge. The rhythm comes from each label's own width
         plus a constant 30px gutter, so the row is a plain flex row
         with a 30px gap rather than a space-between (which would
         push the last item to the card's edge). */
      justify-content: flex-start;
      padding-left: 41px;
      gap: 10px 30px;
    }
    .card.trends .chart-legend-item {
      font-size: 13px;
      gap: 8px;
    }
    .card.trends .legend-square {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }
    /* The "Users Overview" card's internals are measured off the
       reference PNG. The card's content box starts at page x=1128
       and its top edge at y=384, so every offset below is relative
       to that origin:

         donut    145px across, outer edge x=1133..1277 and
                  y=401..547 — a 28px ring, centre (1205, 474)
         legend   a right-hand column starting at page x=1294:
                    Active   ink y 411..421
                    Inactive ink y 446..456
                    (the two rows are 35px apart)
         divider  a hairline at y=518, spanning x 1294..1489
         roles    three rows STACKED VERTICALLY below it, all
                  sharing the legend's left edge at x=1294:
                    Admins          ink y 543..553
                    Support Agents  ink y 583..595
                    Employees       ink y 623..635
                  (40px apart)

       Each legend row is the same four-column grid — a 13px badge,
       the COUNT, the label, then the percentage pushed to the
       column's right edge at page x=1489. */
    .users-overview .overview-body {
      position: relative;
      display: block;
      height: 100%;
    }
    .users-overview .donut-wrap {
      position: absolute;
      left: 5px;
      top: 17px;
    }
    .users-overview .legend {
      position: absolute;
      /* The reference's legend block starts at page x=1294, which is
         card+182 (the card's left border is at x=1112). The block's
         offsets are relative to the body's PADDING box, whose left
         edge sits 20px inside the card's border box, so the block's
         left is 182 - 20 = 162px. */
      left: 162px;
      top: 21px;
      /* The block runs from card+182 to card+377 — the reference's
         percentage column ends at x=1489, which is card+377. */
      width: 195px;
      gap: 15px;
    }
    /* The reference's dot sits inside a soft tinted disc rather than
       standing alone. */
    .users-overview .legend .legend-dot {
      width: 11px;
      height: 11px;
      border-radius: 999px;
      box-shadow: 0 0 0 5px var(--legend-dot-halo, #E6F7F0);
    }
    .users-overview .legend .legend-row {
      /* Four columns, sized to the reference's own column starts
         (page coordinates, card-relative):

           badge  182   (icon ink 1294..1308)
           count  207   (ink 1319..1324)
           label  231   (ink 1343..1377)
           pct    377   (right-aligned, ink ends 1489)

         The tracks therefore run 25 / 24 / 110 / 36 from the
         legend's left edge at card+182.

         The percentage's track is 36px, not 32px: "87.5%" renders
         36px of ink at 12.5px Figtree, so a 32px track clipped it
         even at the reference's own 1536px width. The label's track
         gives up the 4px to pay for it — the widest label in the
         card is "Support Agents" at 89px of ink, which still fits
         the 110px track. */
      grid-template-columns: 25px 24px 110px 36px;
      justify-content: start;
      column-gap: 0px;
      align-items: center;
    }
    .users-overview .legend .legend-value {
      text-align: left;
      padding-left: 0px;
    }
    .users-overview .divider {
      position: absolute;
      left: 162px;
      top: 134px;
      width: 195px;
    }
    /* The reference's role breakdown STACKS VERTICALLY below the
       divider — Admins, then Support Agents, then Employees — each
       row led by a tinted rounded-square badge holding the role's
       glyph.

       The reference's three badges sit at page y 539, 579 and 619 —
       a 40px pitch. The rows are 19px tall, so the gap between them
       is 21px. */
    .users-overview .legend.roles {
      position: absolute;
      left: 162px;
      top: 152px;
      width: 195px;
      flex-direction: column;
      gap: 21px;
    }
    .users-overview .legend.roles .role-cell {
      display: grid;
      grid-template-columns: 25px 24px 110px 36px;
      column-gap: 0px;
      align-items: center;
    }
    .users-overview .legend.roles .legend-icon {
      /* The shared .legend-icon rule in styles.css sets
         display:inline-flex, so the badge's own box needs the extra
         weight here. */
      display: grid !important;
      place-items: center;
      width: 14px;
      height: 14px;
      border-radius: 4px;
      background: var(--role-badge-bg, #F1F5FB);
      color: var(--role-badge-fg, #3B82F6);
      overflow: visible;
    }
    .users-overview .legend.roles .legend-icon svg {
      display: block;
    }
    .users-overview .legend.roles .legend-icon.crown {
      background: #FEF3D5;
      color: #F5A623;
    }
    .users-overview .legend.roles .legend-icon.agent {
      background: #DDEAFE;
      color: #3B82F6;
    }
    .users-overview .legend.roles .legend-icon.person {
      background: #E0F2FE;
      color: #38BDF8;
    }
    .users-overview .legend.roles .legend-value,
    .users-overview .legend.roles .legend-pct {
      text-align: left;
    }
    .users-overview .legend.roles .legend-pct {
      text-align: right;
    }

    /* The "Priority Distribution" card's internals are measured off
       the reference screenshot:
         donut     a 146px circle with a 28px ring — the outer edge
                   runs x=805..950 and y=775..925, so its centre is
                   (877.5, 850)
         centre    "156" ink at y=834..849 and "Tickets" at 858..866,
                   i.e. the pair straddles the donut's centre line
         legend    a coloured dot at x=961..969, the label at
                   978..1021, the count at 1045..1058 and the
                   percentage at 1074..1098
         rows      the four rows' ink sits at y=801, 836, 872 and 907
                   — a 35.3px pitch

       The donut is WIDER than the card's 286px content box, so it
       starts 5px to the LEFT of the content box's edge; the legend
       is therefore placed explicitly too rather than left to a
       two-column grid. */
    .card.priority .priority-body {
      position: relative;
      display: block;
      flex: 1 1 auto;
      min-height: 0;
    }
    .card.priority .donut-wrap {
      position: absolute;
      left: -6px;
      top: 24px;
    }
    /* The reference draws a hairline between the card's header and
       its body — a single #F6F8FC row at page y=757, which is 65px
       below the card's top edge (the card starts at y=692). It is
       positioned against the CARD, not the body, because the body's
       own box starts below the header and the card's padding. */
    .card.priority {
      position: relative;
    }
    .card.priority .priority-divider {
      position: absolute;
      left: 0px;
      top: 64px;
      width: 100%;
      height: 1px;
      background: #F6F8FC;
      z-index: 1;
    }
    .card.priority .legend {
      position: absolute;
      left: 151px;
      top: 45px;
      /* The reference's rows are 35.3px apart — 19.5px of row plus
         15.8px of air. */
      gap: 15.8px;
      width: 138px;
    }
    .card.priority .legend .legend-dot {
      width: 9px;
      height: 9px;
    }
    .card.priority .legend .legend-row {
      /* Columns measured from the legend's left edge (page x=961):
           dot   0..9
           label 17..61
           count 84..98, LEFT-aligned
           pct   113..138, right-aligned
         Each column is sized to the START of the next one, and the
         last two are aligned inside theirs, so the count and the
         percentage land on the reference's exact x positions. */
      grid-template-columns: 17px 67px 29px 25px;
      justify-content: start;
      column-gap: 0px;
    }
    /* The reference's count is LEFT-aligned in its column — "72"
       starts on the column's left edge — while the percentage is
     right-aligned against the card's edge. */
    .card.priority .legend .legend-value {
      text-align: left;
    }

    .grid-row-2 {
      display: grid;
      /* The reference's row-2 card borders sit at x 284, 1101, 1112
         and 1507 — so the Recent Tickets card's box is 818px, the
         gutter is 10px and the Users Overview card's box is 396px.
         The tracks are spelled out so the borders land on those
         exact pixels.

         The Users Overview card needs 396px of INTERIOR width for
         its donut and its two legend blocks, so its track is pinned
         to 396px rather than being left to the 1fr remainder. A 1fr
         track collapsed to 140px at a 1280px viewport, which
         squeezed the card 242px past its own content — the legend
         and the divider hung out of the card's right edge.

         Below 1440px the row's two cards no longer fit side by side
         at the reference's widths, so the row breaks into two
         stacked rows instead (see the media query below). */
      grid-template-columns:
        minmax(0, 818px) minmax(0, 10px)
        minmax(396px, 1fr);
      /* The track is pinned so it cannot grow past the row's fixed
         height: an auto-sized track would size itself to the tallest
         card's content and push the row past the reference's band. */
      grid-template-rows: minmax(0, 1fr);
      gap: 0;
    }
    /* The Users Overview card sits in the third track; the narrow
       middle track is the gutter. */
    .grid-row-2 > .card:nth-child(2) {
      grid-column: 3;
    }
    /* The reference's row-3 card borders sit at x 284, 780, 790, 1116,
       1128 and 1507. The three cards are therefore 497px, 327px and
       380px wide, and the two gutters between them are 9px and 11px
       — they are NOT equal, so the tracks are spelled out one by one
       rather than left to a single gap. (A flexible (fr) split
       rounded each card a pixel wider and pushed the second card's
       border to x=790.) */
    .grid-row-3 {
      display: grid;
      /* The reference's row-3 card borders sit at x 284, 780, 790, 1116,
         1128 and 1507. The three cards are therefore 497px, 327px and
         380px wide, and the two gutters between them are 9px and 11px
         — they are NOT equal, so the tracks are spelled out one by one
         rather than left to a single gap. (A flexible (fr) split
         rounded each card a pixel wider and pushed the second card's
         border to x=790.)

         The three CARD tracks are proportional to the reference's
         widths rather than fixed, so the row narrows as a whole
         instead of starving its last card. The two gutters stay
         fixed at 9px and 11px, which is the reference's own
         measurement and the reason they are not a single gap.

         At the reference's 1536px viewport the content column is
         1224px and the fractions land on exactly 497 / 327 / 380 —
         the reference's own widths — because the three shares sum to
         the same 1204px the fixed tracks used to occupy.

         The third card has a 240px FLOOR: the "Recent Users" card's
         header (a 32px icon tile, the title and the "View all" link)
         needs 231px, and without a floor the track collapsed to
         124px at a 1280px viewport and the "View all" link hung
         107px outside the card.

         The SECOND card has a 310px floor for the same reason: the
         "Priority Distribution" card's legend is absolutely
         positioned at card+151 and is 138px wide, so — counting the
         card's own 1px border and 20px padding — the legend ends at
         card+310 and the card has to be at least that wide. Without
         a floor the track collapsed to 257px and the legend hung
         52px out of the card's right edge. The floor sits BELOW the
         card's own 327px share on purpose: a floor above the share
         would steal the difference from its neighbours and the row
         would land on 495 / 330 / 379 instead of the reference's
         497 / 327 / 380.

         The first card (Ticket Trends) has no floor: its plot is
         drawn in the card's own pixels and re-proportions with it. */
      grid-template-columns:
        minmax(0, 497fr) minmax(0, 9px)
        minmax(310px, 327fr) minmax(0, 11px)
        minmax(240px, 380fr);
      grid-template-rows: minmax(0, 1fr);
      gap: 0;
    }
    /* The second and third cards sit in the wide tracks; the narrow
       tracks between them are the gutters. */
    .grid-row-3 > .card:nth-child(2) {
      grid-column: 3;
    }
    .grid-row-3 > .card:nth-child(3) {
      grid-column: 5;
    }
    /* Below 1200px both rows collapse to a single column.

       The cards' explicit grid-column placements MUST be reset
       here as well. A grid item placed in column 3 of a one-column
       grid does not wrap to the next row — the grid grows an
       IMPLICIT track for it, so the row kept its three (or five)
       columns and the cards stayed side by side at 1200px, each
       squeezed into a third of the width.

       The reset has to MATCH the specificity of the rules it
       overrides: a rule with .grid-row-2 > .card:nth-child(2) is
       more specific than one with .grid-row-2 > .card, so a plain
       descendant reset loses and the placement survives. The
       nth-child qualifiers are repeated here for the same reason. */
    @media (max-width: 1200px) {
      .grid-row-2,
      .grid-row-3 {
        grid-template-columns: minmax(0, 1fr);
        grid-auto-rows: minmax(0, auto);
      }
      .grid-row-2 > .card:nth-child(1),
      .grid-row-2 > .card:nth-child(2),
      .grid-row-3 > .card:nth-child(1),
      .grid-row-3 > .card:nth-child(2),
      .grid-row-3 > .card:nth-child(3) {
        grid-column: auto;
      }
      /* The rows are fixed-height bands at the reference width; once
         the cards stack, each card needs its own height. */
      .grid-row-2,
      .grid-row-3 {
        height: auto;
      }
      .grid-row-2 > .card,
      .grid-row-3 > .card {
        height: auto;
        min-height: 353px;
      }
      .grid-row-3 > .card {
        min-height: 294px;
      }
    }
    @media (max-width: 900px) {
      .rail {
        display: none;
      }
      .main {
        padding-right: 20px;
      }
    }
  `],
})
export class AdminDashboardPageComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly renderState = signal<RenderState>('loading');
  readonly errorMessage = signal<string | null>(null);

  /** The full workspace bundle from GET /api/admin/workspace. */
  readonly bundle = signal<AdminWorkspaceBundle | null>(null);

  /** The signed-in admin's display name, for the hero greeting. */
  readonly displayName = computed(() => this.auth.userSnapshot()?.displayName ?? '');

  readonly totalTickets = computed(() => this.bundle()?.summary.totalTickets ?? 0);
  readonly totalUsers = computed(() => this.bundle()?.summary.totalUsers ?? 0);
  readonly newUsersThisWeek = computed(
    () => this.bundle()?.summary.newUsersThisWeek ?? 0,
  );

  /**
   * Period-over-period ticket delta as a percentage. `null` when
   * there is no previous period to compare against — the stat
   * strip then hides the delta pill rather than showing a
   * misleading "+100%".
   */
  readonly ticketDelta = computed<number | null>(() => {
    const s = this.bundle()?.summary;
    if (!s || s.previousTickets <= 0) return null;
    return Math.round(((s.recentTickets - s.previousTickets) / s.previousTickets) * 100);
  });

  /** Pre-formatted delta copy — a bare number; the arrow carries direction. */
  readonly deltaLabel = computed(() => {
    const pct = this.ticketDelta();
    if (pct === null) return '';
    return pct < 0 ? `−${Math.abs(pct)}%` : `${pct}%`;
  });

  /**
   * The four status buckets for the shared stat strip.
   *
   * Each bucket carries the daily series the sparkline plots — the
   * reference's status cards show a 7-day trend curve rather than a
   * share-of-total progress bar, so the series comes from the same
   * daily trend buckets the Ticket Trends chart is built from.
   */
  readonly statusItems = computed<StatStripItem[]>(() => {
    const counts = this.bundle()?.summary.counts;
    if (!counts) return [];
    const total = counts.total || this.totalTickets();
    const trends = this.bundle()?.trends ?? [];
    const seriesOf = (pick: (t: TrendBucket) => number): number[] =>
      trends.length ? trends.map(pick) : [];
    return [
      { label: 'Open', value: counts.open, accent: 'open', total, series: seriesOf((t) => t.open) },
      { label: 'In Progress', value: counts.inProgress, accent: 'inProgress', total, series: seriesOf((t) => t.inProgress) },
      { label: 'Resolved', value: counts.resolved, accent: 'resolved', total, series: seriesOf((t) => t.resolved) },
      { label: 'Closed', value: counts.closed, accent: 'closed', total, series: seriesOf((t) => t.closed) },
    ];
  });

  readonly recentTickets = computed(() => this.bundle()?.recentTickets ?? []);
  readonly recentUsers = computed(() => this.bundle()?.recentUsers ?? []);
  readonly trendsDays = computed(() => this.bundle()?.trends.length ?? 7);

  readonly usersOverview = computed(
    () =>
      this.bundle()?.usersOverview ?? {
        total: 0,
        active: 0,
        inactive: 0,
        byRole: { admins: 0, supportAgents: 0, employees: 0 },
      },
  );

  /** The active/inactive donut slices. */
  readonly userSlices = computed<DonutSlice[]>(() => {
    const o = this.usersOverview();
    return [
      /* The reference's donut paints its active slice a vivid green
         sampled at rgb(32,203,132), over a slate-grey track at
         rgb(193,200,215). */
      { key: 'active', value: o.active, color: '#20CB84' },
      { key: 'inactive', value: o.inactive, color: '#C1C8D7' },
    ];
  });

  /** The active/inactive legend rows. */
  readonly userLegend = computed(() => {
    const o = this.usersOverview();
    const total = o.total || 1;
    return [
      { key: 'active', label: 'Active', value: o.active, pct: `${((o.active / total) * 100).toFixed(1)}%`, color: '#20CB84' },
      { key: 'inactive', label: 'Inactive', value: o.inactive, pct: `${((o.inactive / total) * 100).toFixed(1)}%`, color: '#C1C8D7' },
    ];
  });

  /** The per-role legend rows under the divider. */
  readonly roleLegend = computed(() => {
    const o = this.usersOverview();
    const total = o.total || 1;
    return [
      /* The reference tints each role badge with a soft disc and
         draws the glyph itself in the saturated colour — amber for
         Admins, blue for Support Agents, sky for Employees. Sampled
         off the PNG: #FFE48D on #FEF3D5 for Admins, #87B9FC on
         #DDEAFE for Support Agents, #7DC5EF on #E0F2FE for
         Employees. */
      { key: 'admins', label: 'Admins', value: o.byRole.admins, pct: `${((o.byRole.admins / total) * 100).toFixed(0)}%`, color: '#F5A623', icon: 'crown' },
      { key: 'agents', label: 'Support Agents', value: o.byRole.supportAgents, pct: `${((o.byRole.supportAgents / total) * 100).toFixed(0)}%`, color: '#3B82F6', icon: 'agent' },
      { key: 'employees', label: 'Employees', value: o.byRole.employees, pct: `${((o.byRole.employees / total) * 100).toFixed(0)}%`, color: '#38BDF8', icon: 'person' },
    ];
  });

  /** The priority donut slices. */
  readonly prioritySlices = computed<DonutSlice[]>(() => {
    const priorities = this.bundle()?.priorities ?? [];
    return priorities.map((p) => ({
      key: p.priority,
      value: p.count,
      color: PRIORITY_COLOR[p.priority],
    }));
  });

  /** The priority legend rows. */
  readonly priorityLegend = computed(() => {
    const priorities = this.bundle()?.priorities ?? [];
    const total = priorities.reduce((sum, p) => sum + p.count, 0) || 1;
    return priorities.map((p) => ({
      key: p.priority,
      label: p.priority,
      value: p.count,
      pct: `${Math.round((p.count / total) * 100)}%`,
      color: PRIORITY_COLOR[p.priority],
    }));
  });

  /** The stacked bars for the trends chart. */
  readonly trendBars = computed<StackedBar[]>(() => {
    const trends = this.bundle()?.trends ?? [];
    return trends.map((t) => ({
      key: this.shortDate(t.date),
      segments: [
        {
          key: 'open',
          value: t.open,
          color: TREND_BAR_COLOR.Open.bottom,
          colorTop: TREND_BAR_COLOR.Open.top,
        },
        {
          key: 'inProgress',
          value: t.inProgress,
          color: TREND_BAR_COLOR['In Progress'].bottom,
          colorTop: TREND_BAR_COLOR['In Progress'].top,
        },
        {
          key: 'resolved',
          value: t.resolved,
          color: TREND_BAR_COLOR.Resolved.bottom,
          colorTop: TREND_BAR_COLOR.Resolved.top,
        },
        {
          key: 'closed',
          value: t.closed,
          color: TREND_BAR_COLOR.Closed.bottom,
          colorTop: TREND_BAR_COLOR.Closed.top,
        },
      ],
    }));
  });

  /** The trends chart's legend. */
  readonly trendLegend = computed<ChartLegendEntry[]>(() => [
    { key: 'open', label: 'Open', color: STATUS_COLOR['Open'] },
    { key: 'inProgress', label: 'In Progress', color: STATUS_COLOR['In Progress'] },
    { key: 'resolved', label: 'Resolved', color: STATUS_COLOR['Resolved'] },
    { key: 'closed', label: 'Closed', color: STATUS_COLOR['Closed'] },
  ]);

  ngOnInit(): void {
    void this.load();
  }

  /** Refetch on window focus so the workspace reflects changes made elsewhere. */
  @HostListener('window:focus')
  onWindowFocus(): void {
    if (this.renderState() === 'success') {
      void this.load();
    }
  }

  onRefresh(): void {
    void this.load();
  }

  openTicket(ticket: Ticket): void {
    void this.router.navigate(['/tickets', ticket.id]);
  }

  /** "22m ago" / "3h ago" / "2d ago" — the reference's relative labels. */
  protected relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  /** "Oct 10" — the trends chart's x-axis label. */
  protected shortDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /** The UI label for a role — "Employee" for the `User` role. */
  protected roleLabel(role: string): string {
    if (role === 'User') return 'Employee';
    if (role === 'Support Agent') return 'Support Agent';
    return 'Admin';
  }

  /**
   * The Recent Users card's avatar fills.
   *
   * The reference draws each avatar as a pastel disc with a
   * saturated matching pair of initials. The palette was sampled off
   * the screenshot (users-palette.mjs):
   *   row 1  periwinkle  #C9D6FE  with blue     #2303EE
   *   row 2  pink        #FBD3DE  with red      #F70B34
   *   row 3  mint        #C6F6DB  with green    #008A33
   *   row 4  lavender    #DCCCFB  with indigo   #1701EF
   *   row 5  amber       #FDE8B8  with orange  #E8790B
   * The pair cycles so a longer list keeps the rhythm.
   */
  private static readonly AVATAR_PALETTE: ReadonlyArray<readonly [string, string]> = [
    ['#C9D6FE', '#2303EE'],
    ['#FBD3DE', '#F70B34'],
    ['#C6F6DB', '#008A33'],
    ['#DCCCFB', '#1701EF'],
    ['#FDE8B8', '#E8790B'],
  ];

  protected avatarBg(index: number): string {
    return AdminDashboardPageComponent.AVATAR_PALETTE[index % 5]![0];
  }

  protected avatarFg(index: number): string {
    return AdminDashboardPageComponent.AVATAR_PALETTE[index % 5]![1];
  }

  private async load(): Promise<void> {
    this.renderState.set('loading');
    this.errorMessage.set(null);
    try {
      const bundle = await this.ticketService.workspace();
      this.bundle.set(bundle);
      this.renderState.set('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // The auth guard owns the redirect; don't render an error
        // card over the login screen.
        return;
      }
      this.errorMessage.set(GENERIC_LOAD_ERROR);
      this.renderState.set('error');
    }
  }
}
