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
    // Brand mark: the wordmark is the spec's authoritative anchor.
    await expect(page.getByText('HelpDesk Lite', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    // Wireframe §"Content & Actions" #6 — CTA label is "Log in".
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  });

  test('login button is disabled until both fields have content', async ({ page }) => {
    await page.goto('/login');
    const button = page.getByRole('button', { name: 'Log in', exact: true });
    await expect(button).toBeDisabled();
    await page.getByLabel('Email').fill('admin@company.com');
    await expect(button).toBeDisabled();
    await page.getByLabel('Password').fill('password123');
    await expect(button).toBeEnabled();
  });

  test('forgot-password link routes to /forgot-password', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('login page has no marketing copy, remember-me, or register link', async ({ page }) => {
    // Wireframe §"Content & Actions" explicitly forbids each of
    // these — the page is a threshold, not a landing page. Any
    // regression on these is an automatic fail.
    await page.goto('/login');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/zero chaos/i);
    expect(body).not.toMatch(/trello-style/i);
    expect(body).not.toMatch(/remember me/i);
    expect(body).not.toMatch(/don.?t have an account/i);
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
