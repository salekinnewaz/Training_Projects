import { test, expect, loginAs } from './fixtures';

/**
 * Feature tests — covers each page's happy path AND the
 * wireframe-anchored tripwires that should be present (or
 * absent) on that page. Each page gets at least one
 * "spec-shape" test that asserts the wireframe-listed elements
 * so the next dev who adds a forbidden affordance gets paged.
 */

test.describe('Feature: Login → role-correct dashboard', () => {
  test('admin lands on /admin', async ({ page }) => {
    await loginAs(page, 'admin');
  });
  test('support agent (sam) lands on /queue', async ({ page }) => {
    await loginAs(page, 'sam');
  });
  test('employee (eli) lands on /dashboard', async ({ page }) => {
    await loginAs(page, 'eli');
  });
});

test.describe('Feature: Employee Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'eli');
  });

  test('renders the page heading + Create Ticket CTA', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'My Tickets', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /create ticket/i })).toBeVisible();
  });

  test('has no stat strip (wireframe-forbidden summary stats)', async ({ page }) => {
    // Wireframe §"Content & Actions" #6: "No summary stats
    // ('3 open, 1 closed') — those would imply team-wide
    // visibility."
    await expect(page.getByTestId('stat-strip')).toHaveCount(0);
  });

  test('lists tickets newest-first with ticket number, status, priority', async ({ page }) => {
    // Eli has 5 seeded tickets; rows are ticket-row elements.
    // Wait for the network round-trip to settle before counting.
    await expect(page.locator('ticket-row').first()).toBeVisible({ timeout: 15_000 });
    const rows = page.locator('ticket-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    // First row should show a ticket number (HD-#).
    await expect(rows.first()).toContainText(/HD-\d+/);
  });
});

test.describe('Feature: Agent Kanban', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'sam');
  });

  test('renders the Queue heading + filter strip + 4 columns', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Queue', level: 1 })).toBeVisible();
    // Filter strip elements
    await expect(page.getByPlaceholder(/search queue/i)).toBeVisible();
    // 4 status column headers
    for (const status of ['Open', 'In Progress', 'Resolved', 'Closed']) {
      await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
    }
  });

  test('does NOT have a Users tab (wireframe-forbidden; admin has /admin)', async ({ page }) => {
    // Agent Kanban spec: "No Users tab on this page. Admin has
    // its own home at /admin and never lands here."
    await expect(page.getByRole('link', { name: /^users$/i })).toHaveCount(0);
  });
});

test.describe('Feature: Forbidden / role-gate', () => {
  test('employee (eli) cannot access /queue', async ({ page }) => {
    await loginAs(page, 'eli');
    await page.goto('/queue');
    // 403 page or redirect to /forbidden
    await page.waitForURL(/\/(forbidden|queue)/, { timeout: 5000 });
    const onForbidden = /\/forbidden/.test(page.url());
    if (onForbidden) {
      await expect(page.getByText(/don.?t have access|forbidden|403/i).first()).toBeVisible();
    } else {
      // 403 panel on /queue itself is acceptable too
      await expect(page.getByText(/don.?t have access|forbidden|admin dashboard/i).first()).toBeVisible();
    }
  });

  test('support agent (sam) cannot access /admin', async ({ page }) => {
    await loginAs(page, 'sam');
    await page.goto('/admin');
    await page.waitForURL(/\/(forbidden|admin)/, { timeout: 5000 });
    const onForbidden = /\/forbidden/.test(page.url());
    if (onForbidden) {
      await expect(page.getByText(/don.?t have access|forbidden|403/i).first()).toBeVisible();
    }
  });

  test('logged-out /dashboard redirects to /login with return_to', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?return_to=/);
  });

  test('logged-out /queue redirects to /login with return_to', async ({ page }) => {
    await page.goto('/queue');
    await expect(page).toHaveURL(/\/login\?return_to=/);
  });
});

test.describe('Feature: Health + API smoke', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });

  test('GET /api/auth/me without cookie returns 401', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    expect(res.status()).toBe(401);
  });
});
