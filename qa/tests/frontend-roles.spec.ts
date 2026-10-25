import { test, expect, loginAs } from './fixtures';

/**
 * Frontend role audit — exercises the real UI for each of the three
 * roles: route access, guard redirects, and role-specific chrome.
 *
 * Run against the local dev stack:
 *   BASE_URL=http://localhost:4200 npx playwright test qa/role-audit/frontend-roles.spec.ts
 */

async function signIn(page, who: 'admin' | 'sam' | 'jess') {
  await loginAs(page, who);
  await page.waitForLoadState('networkidle');
}

test.describe('USER (employee) frontend', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'jess');
  });

  test('lands on the employee dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('body')).toContainText(/my tickets/i);
  });

  test('can reach the create-ticket page', async ({ page }) => {
    await page.goto('/tickets/new');
    await expect(page).toHaveURL(/\/tickets\/new/);
    await expect(page.locator('body')).toContainText(/new ticket|create a ticket/i);
  });

  test('can submit a ticket and reach the confirmation page', async ({ page }) => {
    await page.goto('/tickets/new');
    const title = `FE probe ${Date.now()}`;
    // Title + description are the two required fields.
    const inputs = page.locator('input');
    await inputs.first().fill(title);
    const textareas = page.locator('textarea');
    await textareas.first().fill('Submitted by the frontend role audit.');
    await page.getByRole('button', { name: /submit/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tickets\/\d+\/created/);
    // Per submission-confirmation.md the three signals are: the
    // "Ticket created" headline, the ticket NUMBER (#HD-nn), and
    // the initial status chip (Open). The title is NOT shown.
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/ticket created/i);
    expect(body).toMatch(/#HD-\d+/);
    expect(body).toMatch(/open/i);
  });

  test('dashboard lists the employee own tickets', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/HD-\d+/);
  });

  test('can open an own ticket detail page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // The dashboard renders a `ticket-table`; each body row opens the
    // ticket detail on click.
    const row = page.locator('[data-testid="ticket-table"] tbody tr').first();
    await expect(row).toBeVisible();
    await row.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tickets\/\d+/);
    await expect(page.locator('body')).toContainText(/activity|comment/i);
  });

  test('is redirected away from agent-only /queue', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('is redirected away from admin-only /admin', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('is redirected away from admin-only /users', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('is redirected away from the agent+admin tickets list', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('forbidden page renders the access-denied copy', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/don't have access|forbidden|no access|permission/i);
  });

  test('cannot reach profile pages', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/profile/);
    await page.goto('/profile/password');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/profile\/password/);
  });
});

test.describe('SUPPORT AGENT frontend', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'sam');
  });

  test('lands on the agent tickets list (the agent home since HD-019)', async ({ page }) => {
    await expect(page).toHaveURL(/\/tickets/);
  });

  test('can still open the kanban queue board at /queue', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/queue/);
  });

  test('kanban renders its four status columns', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/open/i);
    expect(body).toMatch(/in progress/i);
    expect(body).toMatch(/resolved/i);
  });

  test('can reach the shared tickets list', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tickets/);
    await expect(page.locator('body')).toContainText(/tickets/i);
  });

  test('is redirected away from admin-only /admin', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('is redirected away from admin-only /users', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('is redirected away from employee-only /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('is redirected away from employee-only /tickets/new', async ({ page }) => {
    await page.goto('/tickets/new');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('can open a ticket detail page', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');
    const row = page.locator('[data-testid="ticket-table"] tbody tr').first();
    await expect(row).toBeVisible();
    await row.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tickets\/\d+/);
    await expect(page.locator('body')).toContainText(/activity|comment/i);
  });
});

test.describe('ADMIN frontend', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'admin');
  });

  test('lands on the admin dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin/);
  });

  test('admin dashboard renders the four status buckets', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/open/i);
    expect(body).toMatch(/in progress/i);
    expect(body).toMatch(/resolved/i);
    expect(body).toMatch(/closed/i);
  });

  test('can reach the users tab', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/users/);
    await expect(page.locator('body')).toContainText(/users/i);
  });

  test('users tab lists users', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/@company\.com/);
  });

  test('can reach the shared tickets list', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/tickets/);
  });

  test('is redirected away from employee-only /dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });

  test('is redirected away from the agent-only /queue', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/forbidden/);
  });
});

test.describe('Unauthenticated access', () => {
  test('protected routes redirect to login with return_to', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login\?return_to=/);
  });

  test('/admin redirects to login when logged out', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/login\?return_to=/);
  });

  test('/login is reachable while logged out', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input#login-email')).toBeVisible();
  });
});
