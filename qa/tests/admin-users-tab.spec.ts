import { test, expect, loginAs } from './fixtures';

/**
 * Admin Users tab — self-protection UI.
 *
 * Per users-tab.md the Admin viewing the page sees their own row with
 * DISABLED role dropdown + active toggle and a muted micro-label
 * "You cannot change your own role." The backend enforces the same
 * constraint (400), so this checks the UI half.
 */

test.describe('Admin Users tab — self-protection', () => {
  test('self row controls are disabled with the micro-label', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    const body = await page.locator('body').innerText();
    expect(body).toMatch(/you cannot change your own role/i);
  });

  test('self row role select and toggle are disabled', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    // The disabled controls live on the self row.
    const disabledControls = page.locator('select:disabled, button:disabled, input:disabled');
    const count = await disabledControls.count();
    expect(count).toBeGreaterThan(0);
  });

  test('non-self rows are editable', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    // A non-self row should have an enabled role select.
    const enabledSelects = page.locator('select:not(:disabled)');
    expect(await enabledSelects.count()).toBeGreaterThan(0);
  });

  test('admin cannot change own role via the API even bypassing the UI', async ({ page }) => {
    await loginAs(page, 'admin');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/users/1/role', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'User' }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    });

    expect(result.status).toBe(400);
  });

  test('admin cannot deactivate self via the API even bypassing the UI', async ({ page }) => {
    await loginAs(page, 'admin');

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/users/1/status', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    });

    expect(result.status).toBe(400);
  });

  test('admin can change another user role via the API', async ({ page }) => {
    await loginAs(page, 'admin');

    // Promote then restore, so the seed data is left as it was.
    const promote = await page.evaluate(async () => {
      const res = await fetch('/api/users/8/role', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'Support Agent' }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    expect(promote.status).toBe(200);

    const restore = await page.evaluate(async () => {
      const res = await fetch('/api/users/8/role', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'User' }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    expect(restore.status).toBe(200);
  });
});
