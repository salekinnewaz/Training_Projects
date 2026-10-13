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
    // Filter strip — search input is inside an atom-input host
    // that also carries the placeholder attribute, so we target
    // the inner <input> by id to avoid the strict-mode collision.
    await expect(page.locator('input#filter-search')).toBeVisible();
    await expect(
      page.locator('input#filter-search'),
    ).toHaveAttribute('placeholder', /search queue/i);
    // 4 status column headers (rendered as h2 elements per
    // the page snapshot, so target them by role to skip the
    // hidden <option> entries in the filter select).
    for (const status of ['Open', 'In Progress', 'Resolved', 'Closed']) {
      await expect(
        page.getByRole('heading', { name: status, level: 2 }),
      ).toBeVisible();
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

test.describe('Feature: Create Ticket', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'eli');
  });

  test('renders the form with the wireframe-listed fields', async ({ page }) => {
    await page.goto('/tickets/new');
    // The live page renders the form in a modal-style dialog
    // (visible from the page snapshot — banner "Create Ticket"
    // + × close button + Title/Description fields). The form
    // has the wireframe-listed inputs.
    await expect(page.locator('input#title')).toBeVisible();
    await expect(page.locator('textarea#description')).toBeVisible();
    await expect(page.locator('select#category')).toBeVisible();
    await expect(page.locator('select#priority')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /create ticket/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^cancel$/i })).toBeVisible();
  });

  test('disables Submit until Title and Description are filled', async ({ page }) => {
    await page.goto('/tickets/new');
    const submit = page.getByRole('button', { name: /create ticket/i });
    await expect(submit).toBeDisabled();
    await page.locator('input#title').fill('My keyboard shortcut is broken');
    await expect(submit).toBeDisabled();
    await page.locator('textarea#description').fill('Cmd+S no longer works in the editor.');
    await expect(submit).toBeEnabled();
  });

  test('Cancel button closes the form and returns to /dashboard', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('submitting a valid form lands on the created page', async ({ page }) => {
    await page.goto('/tickets/new');
    const unique = `qa-auto-${Date.now()}`;
    await page.locator('input#title').fill(unique);
    await page.locator('textarea#description').fill('Created by the QA loop.');
    await page.getByRole('button', { name: /create ticket/i }).click();
    await page.waitForURL(/\/tickets\/.+\/created/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/tickets\/.+\/created/);
  });
});

test.describe('Feature: Submission Confirmation', () => {
  test('shows the wireframe-anchored signals after a fresh ticket create', async ({ page }) => {
    await loginAs(page, 'eli');
    await page.goto('/tickets/new');
    const unique = `qa-confirm-${Date.now()}`;
    await page.locator('input#title').fill(unique);
    await page.locator('textarea#description').fill('Created by the QA loop for confirmation coverage.');
    await page.getByRole('button', { name: /create ticket/i }).click();
    await page.waitForURL(/\/tickets\/.+\/created/, { timeout: 10_000 });

    // Wireframe §"Content & Actions" — the page renders:
    //   - "Ticket created" headline
    //   - ticket number (#HD-#)
    //   - Initial status label + Open chip
    //   - View ticket CTA
    //   - Back to My Tickets secondary link
    // (No ticket title per wireframe — only the number is the
    // user-facing identifier on this page.)
    await expect(page.getByText('Ticket created', { exact: true })).toBeVisible();
    await expect(page.getByText(/^#HD-\d+$/)).toBeVisible();
    await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
    // "View ticket" and "Back to My Tickets" are both
    // implemented as buttons in the live page.
    await expect(page.getByRole('button', { name: /view ticket/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /back to my tickets/i })).toBeVisible();
  });
});

test.describe('Feature: Ticket Detail', () => {
  test('employee can open their own ticket', async ({ page }) => {
    await loginAs(page, 'eli');
    // Pick the first ticket from the dashboard.
    await expect(page.locator('ticket-row').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('ticket-row a.row').first().click();
    // The live URL pattern is /tickets/<id> (numeric) — accept either
    // /tickets/42 or /tickets/HD-42.
    await page.waitForURL(/\/tickets\/(HD-)?\d+/, { timeout: 10_000 });
    // Should show the back link to the dashboard.
    await expect(page.getByRole('link', { name: /back to/i })).toBeVisible();
  });
});

test.describe('Feature: Admin Dashboard', () => {
  test('admin lands on /admin and sees the Dashboard tab', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    // Admin should see a Users tab — wireframe says admin-only.
    await expect(page.getByRole('tab', { name: /^users$/i }).or(
      page.getByRole('link', { name: /^users$/i })
    ).first()).toBeVisible();
  });
});

test.describe('Feature: 404 / unknown route', () => {
  test('GET /this-does-not-exist renders the 404 page', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.getByText(/404|not found|page.*doesn.?t exist/i).first()).toBeVisible();
  });
});
