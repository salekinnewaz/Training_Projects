import { test, expect, Page } from './fixtures';
import { loginAs, logout } from './fixtures';
import {
  request as playwrightRequest,
  type APIRequestContext,
} from '@playwright/test';

/**
 * Feature: Notification delivery across all three roles.
 *
 * Exercises the notification matrix end-to-end through the LIVE
 * backend — no API stubbing — so a broken recipient rule fails here
 * rather than in production.
 *
 * The matrix under test (see
 * `backend/src/services/notificationService.ts`):
 *
 *   ┌──────────────────┬───────────────────────────────────────────┐
 *   │ Event            │ Recipients                                │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ ticket_created   │ every active Support Agent + every        │
 *   │                  │ active Admin                              │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ comment_added    │ User author  → ticket owner + all active   │
 *   │                  │               Agents and Admins           │
 *   │                  │ Staff author → ticket submitter + ticket  │
 *   │                  │               owner + all active Admins   │
 *   ├──────────────────┼───────────────────────────────────────────┤
 *   │ status changed   │ ticket submitter + ticket owner + Admins │
 *   │ assigned         │ submitter + new owner + prior owner +     │
 *   │                  │ Admins                                     │
 *   └──────────────────┴───────────────────────────────────────────┘
 *
 * Two invariants hold across every rule:
 *   1. The actor never receives a notification for their own action.
 *   2. The ticket submitter is notified of every activity on their
 *      own ticket.
 *
 * ## Why this hits the API directly
 *
 * The bell polls every 30s, which is far too slow for an E2E
 * assertion. Rather than stubbing the notifications route (which
 * would test the stub, not the rule), these tests drive the real
 * REST endpoints and then assert on what the UI renders after an
 * explicit refresh. The UI is still the thing under test — the API
 * is only used to *create* the events and to read the feed
 * deterministically.
 *
 * The API calls run in a **separate** `APIRequestContext` from the
 * browser page. Sharing one context would drop the API session
 * cookie into the browser's cookie jar, so `page.goto('/login')`
 * would redirect straight to the dashboard and the UI login step
 * would never run.
 */

/** A seeded account, with the role it plays. */
type Persona = 'admin' | 'sam' | 'morgan' | 'eli' | 'jess' | 'noah' | 'priya';

const EMAILS: Record<Persona, string> = {
  admin: 'admin@company.com',
  sam: 'sam@company.com',
  morgan: 'morgan@company.com',
  eli: 'eli@company.com',
  jess: 'jess@company.com',
  noah: 'noah@company.com',
  priya: 'priya@company.com',
};

/** The base URL the API lives at (same host as the frontend dev
 * server; the backend's CORS allowlist covers the dev ports). */
const API_BASE = process.env['API_BASE_URL'] ?? 'http://localhost:3000';

/**
 * A logged-in API session, isolated from the browser page's cookie
 * jar so the UI login flow still runs.
 */
interface ApiSession {
  ctx: APIRequestContext;
  id: number;
  role: string;
}

/** Log in through the API and return an isolated request context. */
async function apiLogin(who: Persona): Promise<ApiSession> {
  const ctx = await playwrightRequest.newContext({
    baseURL: API_BASE,
  });

  const res = await ctx.post('/api/auth/login', {
    data: { email: EMAILS[who], password: 'password123' },
  });
  expect(res.status(), `login for ${who}`).toBe(200);

  const me = await ctx.get('/api/auth/me');
  expect(me.status()).toBe(200);
  const body = (await me.json()) as { user: { id: number; role: string } };

  return { ctx, id: body.user.id, role: body.user.role };
}

/** Create a ticket as this session and return its id + number. */
async function apiCreateTicket(
  session: ApiSession,
  title: string,
): Promise<{ id: number; number: string }> {
  const res = await session.ctx.post('/api/tickets', {
    data: {
      title,
      description: 'Created by the notification E2E suite.',
      category: 'General',
      priority: 'Medium',
    },
  });
  expect(res.status(), 'ticket creation').toBe(201);
  const body = (await res.json()) as { ticket: { id: number; number: string } };
  return { id: body.ticket.id, number: body.ticket.number };
}

/** Read a session's notification feed through the API. */
async function apiNotifications(
  session: ApiSession,
): Promise<{
  items: Array<{
    id: number;
    type: string;
    title: string;
    body: string | null;
    ticketId: number | null;
    actor: { id: number; displayName: string } | null;
    unread: boolean;
  }>;
  unreadCount: number;
}> {
  const res = await session.ctx.get('/api/notifications?limit=50');
  expect(res.status()).toBe(200);
  return (await res.json()) as never;
}

/** The notification types a persona holds for one ticket. */
function typesFor(
  feed: { items: Array<{ type: string; ticketId: number | null }> },
  ticketId: number,
): string[] {
  return feed.items
    .filter((item) => item.ticketId === ticketId)
    .map((item) => item.type);
}

/**
 * Open the bell panel and wait for the feed to settle.
 *
 * The bell polls on a 30s timer, but opening the panel forces an
 * immediate refresh — so the panel always reflects the server state
 * at the moment it is opened.
 */
async function openPanel(page: Page): Promise<void> {
  const bell = page.getByTestId('notification-bell');
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByTestId('notifications-panel')).toBeVisible();
}

/** Re-read the feed through the UI by reopening the panel. */
async function refreshPanel(page: Page): Promise<void> {
  await openPanel(page);
  await page.getByTestId('notification-bell').click(); // close
  await page.keyboard.press('Escape');
}


test.describe('Feature: Notification delivery across roles', () => {
  // The bell badge and the panel rows are what a user actually sees,
  // so the UI assertions below are the primary contract. The API
  // reads exist only to make the *timing* deterministic — the bell
  // polls every 30s, which is far too slow to assert on directly.

  test('a User creating a ticket notifies every Support Agent and the Admin', async () => {
    const jess = await apiLogin('jess');
    const sam = await apiLogin('sam');
    const morgan = await apiLogin('morgan');
    const admin = await apiLogin('admin');

    const ticket = await apiCreateTicket(jess, 'E2E new ticket');

    const samFeed = await apiNotifications(sam);
    const morganFeed = await apiNotifications(morgan);
    const adminFeed = await apiNotifications(admin);
    const jessFeed = await apiNotifications(jess);

    // Both agents and the Admin are notified of the new ticket.
    expect(typesFor(samFeed, ticket.id)).toContain('ticket_created');
    expect(typesFor(morganFeed, ticket.id)).toContain('ticket_created');
    expect(typesFor(adminFeed, ticket.id)).toContain('ticket_created');

    // The submitter is not notified of their own ticket.
    expect(typesFor(jessFeed, ticket.id)).not.toContain('ticket_created');
  });

  test('the bell badge and panel show the notification to a Support Agent', async ({
    page,
  }) => {
    const jess = await apiLogin('jess');
    await apiCreateTicket(jess, 'E2E bell badge ticket');

    await loginAs(page, 'sam');

    // The bell shows the red dot because there is an unread row.
    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible();
    await expect(page.locator('.notification-dot')).toBeVisible();

    // The panel lists the new ticket.
    await openPanel(page);
    await expect(page.getByText(/New ticket HD-/).first()).toBeVisible();
  });

  test('a User comment notifies the Support Agents and the Admin', async () => {
    const jess = await apiLogin('jess');
    const sam = await apiLogin('sam');
    const morgan = await apiLogin('morgan');
    const admin = await apiLogin('admin');

    const ticket = await apiCreateTicket(jess, 'E2E comment ticket');

    const res = await jess.ctx.post(`/api/tickets/${ticket.id}/comments`, {
      data: { body: 'User comment for the notification matrix.' },
    });
    expect(res.status()).toBe(201);

    const samFeed = await apiNotifications(sam);
    const morganFeed = await apiNotifications(morgan);
    const adminFeed = await apiNotifications(admin);
    const jessFeed = await apiNotifications(jess);

    expect(typesFor(samFeed, ticket.id)).toContain('comment_added');
    expect(typesFor(morganFeed, ticket.id)).toContain('comment_added');
    expect(typesFor(adminFeed, ticket.id)).toContain('comment_added');

    // The commenter is not notified of their own comment.
    expect(typesFor(jessFeed, ticket.id)).not.toContain('comment_added');
  });

  test('a Support Agent comment notifies the ticket owner (the submitter)', async () => {
    const jess = await apiLogin('jess');
    const sam = await apiLogin('sam');
    const admin = await apiLogin('admin');

    const ticket = await apiCreateTicket(jess, 'E2E agent comment ticket');

    const res = await sam.ctx.post(`/api/tickets/${ticket.id}/comments`, {
      data: { body: 'Agent reply for the notification matrix.' },
    });
    expect(res.status()).toBe(201);

    const jessFeed = await apiNotifications(jess);
    const adminFeed = await apiNotifications(admin);

    // The submitter hears back from the agent.
    expect(typesFor(jessFeed, ticket.id)).toContain('comment_added');
    // The Admin oversees every ticket, so they hear it too.
    expect(typesFor(adminFeed, ticket.id)).toContain('comment_added');
  });

  test('an Admin comment notifies the ticket owner (the submitter)', async () => {
    const jess = await apiLogin('jess');
    const admin = await apiLogin('admin');

    const ticket = await apiCreateTicket(jess, 'E2E admin comment ticket');

    const res = await admin.ctx.post(`/api/tickets/${ticket.id}/comments`, {
      data: { body: 'Admin reply for the notification matrix.' },
    });
    expect(res.status()).toBe(201);

    const jessFeed = await apiNotifications(jess);
    const adminFeed = await apiNotifications(admin);

    // The submitter hears back from the admin.
    expect(typesFor(jessFeed, ticket.id)).toContain('comment_added');
    // The Admin does NOT get a notification for their own comment.
    expect(typesFor(adminFeed, ticket.id)).not.toContain('comment_added');
  });

  test('the ticket submitter is notified of every activity on their own ticket', async () => {
    const jess = await apiLogin('jess');
    const sam = await apiLogin('sam');
    const admin = await apiLogin('admin');

    const ticket = await apiCreateTicket(jess, 'E2E every activity');

    // 1. The ticket is assigned to an agent.
    const assign = await admin.ctx.patch(`/api/tickets/${ticket.id}`, {
      data: { ownerId: sam.id },
    });
    expect(assign.status()).toBe(200);

    // 2. The agent comments.
    const comment = await sam.ctx.post(`/api/tickets/${ticket.id}/comments`, {
      data: { body: 'Working on it.' },
    });
    expect(comment.status()).toBe(201);

    // 3. The agent changes the status.
    const status = await sam.ctx.patch(`/api/tickets/${ticket.id}`, {
      data: { status: 'In Progress' },
    });
    expect(status.status()).toBe(200);

    const jessFeed = await apiNotifications(jess);
    const types = typesFor(jessFeed, ticket.id);

    expect(types).toContain('ticket_assigned');
    expect(types).toContain('comment_added');
    expect(types).toContain('ticket_status_changed');
  });

  test('a status change notifies the ticket submitter', async () => {
    const jess = await apiLogin('jess');
    const sam = await apiLogin('sam');

    const ticket = await apiCreateTicket(jess, 'E2E status change');

    const res = await sam.ctx.patch(`/api/tickets/${ticket.id}`, {
      data: { status: 'In Progress' },
    });
    expect(res.status()).toBe(200);

    const jessFeed = await apiNotifications(jess);
    expect(typesFor(jessFeed, ticket.id)).toContain('ticket_status_changed');
  });

  test('assigning a ticket notifies the new owner and the submitter', async () => {
    const jess = await apiLogin('jess');
    const sam = await apiLogin('sam');
    const admin = await apiLogin('admin');

    const ticket = await apiCreateTicket(jess, 'E2E assignment');

    const res = await admin.ctx.patch(`/api/tickets/${ticket.id}`, {
      data: { ownerId: sam.id },
    });
    expect(res.status()).toBe(200);

    const samFeed = await apiNotifications(sam);
    const jessFeed = await apiNotifications(jess);

    expect(typesFor(samFeed, ticket.id)).toContain('ticket_assigned');
    expect(typesFor(jessFeed, ticket.id)).toContain('ticket_assigned');
  });

  test('the bell dot clears when every notification is marked read', async ({
    page,
  }) => {
    const jess = await apiLogin('jess');
    await apiCreateTicket(jess, 'E2E mark all read');

    await loginAs(page, 'morgan');
    await openPanel(page);

    // "Mark all as read" is offered while something is unread.
    const markAll = page.getByTestId('notifications-mark-all');
    await expect(markAll).toBeVisible();

    await markAll.click();

    // The dot disappears and the panel no longer offers the action.
    await expect(page.locator('.notification-dot')).toHaveCount(0);
    await expect(page.getByTestId('notifications-mark-all')).toHaveCount(0);
  });

  test('clicking a notification marks it read and deep-links to the ticket', async ({
    page,
  }) => {
    const jess = await apiLogin('jess');
    const ticket = await apiCreateTicket(jess, 'E2E deep link');

    await loginAs(page, 'sam');
    await openPanel(page);

    // Click the row for the ticket we just created.
    const row = page.getByRole('button', { name: `New ticket ${ticket.number}` });
    await expect(row).toBeVisible();
    await row.click();

    // We land on the ticket detail page.
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticket.id}`));

    // And the row is now read on the server.
    const sam = await apiLogin('sam');
    const feed = await apiNotifications(sam);
    const hit = feed.items.find((item) => item.ticketId === ticket.id);
    expect(hit, 'notification row for the ticket').toBeTruthy();
    expect(hit!.unread, 'row is read after clicking it').toBe(false);
  });

  test('a User sees their own ticket activity in the bell', async ({ page }) => {
    const jess = await apiLogin('jess');
    const sam = await apiLogin('sam');

    const ticket = await apiCreateTicket(jess, 'E2E user bell');

    await sam.ctx.post(`/api/tickets/${ticket.id}/comments`, {
      data: { body: 'Here is your update.' },
    });

    await loginAs(page, 'jess');
    await openPanel(page);

    await expect(
      page.getByRole('button', { name: `New comment on ${ticket.number}` }),
    ).toBeVisible();
  });

  test('the Admin bell shows new tickets', async ({ page }) => {
    const jess = await apiLogin('jess');
    await apiCreateTicket(jess, 'E2E admin bell');

    await loginAs(page, 'admin');
    await openPanel(page);

    await expect(page.getByText(/New ticket HD-/).first()).toBeVisible();
  });

  test('the notification panel is reachable for every role', async ({ page }) => {
    for (const who of ['jess', 'sam', 'admin'] as const) {
      await loginAs(page, who);
      await openPanel(page);
      await expect(page.getByTestId('notifications-panel')).toBeVisible();
      await logout(page, who);
    }
  });
});
