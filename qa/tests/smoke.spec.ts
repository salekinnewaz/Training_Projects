import { test, expect } from './fixtures';

/**
 * Smoke tests — the very first thing to run after each fix.
 * Verifies the live deployment is up and the public chrome
 * responds. Also serves as a wireframe-anchored tripwire for the
 * /login surface so the next dev who adds marketing copy or
 * renames the CTA gets paged.
 */

test.describe('Smoke', () => {
  test('home / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders the brand mark and both fields', async ({ page }) => {
    await page.goto('/login');
    // Wordmark is rendered twice (marketing pane + sign-in card);
    // getByText matches the first occurrence.
    await expect(
      page.getByText('Helpdesk Lite', { exact: false }).first(),
    ).toBeVisible();
    // The atom-input renders a real <input> nested inside the
    // <atom-input> host, and the host shares the same id. We
    // target the inner <input> explicitly to avoid the duplicate
    // id ambiguity and to be robust to label/host id collision.
    await expect(page.locator('input#login-email')).toBeVisible();
    await expect(page.locator('input#login-password')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in', exact: true }),
    ).toBeVisible();
  });

  test('login button is disabled until both fields have content', async ({ page }) => {
    await page.goto('/login');
    const button = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(button).toBeDisabled();
    await page.locator('input#login-email').fill('admin@company.com');
    await expect(button).toBeDisabled();
    await page.locator('input#login-password').fill('password123');
    await expect(button).toBeEnabled();
  });

  test('forgot-password link routes to /forgot-password', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('login page has no SSO and no register link', async ({ page }) => {
    // SSO is out of scope (self-removed) and self-registration is
    // admin-provisioned; both are explicitly forbidden on /login.
    await page.goto('/login');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/sign in with sso/i);
    expect(body).not.toMatch(/don.?t have an account/i);
    expect(await page.locator('a[href="/register"]').count()).toBe(0);
  });

  test('health endpoint responds 200', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('openapi.json responds 200 and lists tags', async ({ request }) => {
    const res = await request.get('/api/docs.json');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe('3.0.3');
    expect(Array.isArray(body.paths ? Object.keys(body.paths) : null)).toBe(true);
    expect((body.paths ? Object.keys(body.paths) : []).length).toBeGreaterThan(10);
  });
});
