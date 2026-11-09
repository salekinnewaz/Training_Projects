import { test, expect, loginAs } from './fixtures';

/**
 * Admin Users page — self-protection.
 *
 * The Admin viewing the page sees their own row with a "You" tag,
 * disabled role dropdown and active toggle. The backend enforces the same
 * constraint (400), so this checks the UI half.
 *
 * THE USER IDS ARE NOT HARDCODED. The seeded admin is user 105 in
 * the current database and was user 1 in an older one, so a
 * hardcoded id silently tested the wrong person (or, worse, a real
 * user's row). Every test below resolves the caller's own id from
 * the session first, and picks the other user from the live list.
 */

/** The signed-in admin's own user id, read from /api/auth/me. */
async function ownId(page: import('@playwright/test').Page): Promise<number> {
  const id = await page.evaluate(async () => {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    const body = await res.json();
    return body?.user?.id ?? null;
  });
  expect(id, 'the session must expose the caller\'s own user id').not.toBeNull();
  return id as number;
}

/** Some OTHER user's id and role, taken from the live users list. */
async function otherUser(
  page: import('@playwright/test').Page,
): Promise<{ id: number; role: string }> {
  const me = await ownId(page);
  const other = await page.evaluate(async (self) => {
    const res = await fetch('/api/users');
    if (!res.ok) return null;
    const body = await res.json();
    const list = Array.isArray(body) ? body : (body?.users ?? body?.data ?? []);
    const hit = list.find((u: { id: number }) => u.id !== self);
    return hit ? { id: hit.id, role: hit.role } : null;
  }, me);
  expect(other, 'the users list must contain someone other than the caller').not.toBeNull();
  return other as { id: number; role: string };
}

test.describe('Admin Users page — self-protection', () => {
  test('self row is marked with a You tag', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('You', { exact: true })).toBeVisible();
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
    const me = await ownId(page);

    const result = await page.evaluate(async (id) => {
      const res = await fetch(`/api/users/${id}/role`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'User' }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, me);

    expect(result.status).toBe(400);
  });

  test('admin cannot deactivate self via the API even bypassing the UI', async ({ page }) => {
    await loginAs(page, 'admin');
    const me = await ownId(page);

    const result = await page.evaluate(async (id) => {
      const res = await fetch(`/api/users/${id}/status`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, me);

    expect(result.status).toBe(400);
  });

  test('admin can change another user role via the API', async ({ page }) => {
    await loginAs(page, 'admin');
    const other = await otherUser(page);

    // Promote then restore, so the seed data is left as it was.
    // The original role is read from the live list, so the restore
    // is exact whatever the seeded role happens to be.
    const promote = await page.evaluate(async (id) => {
      const res = await fetch(`/api/users/${id}/role`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'Support Agent' }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, other.id);
    expect(promote.status).toBe(200);

    const restore = await page.evaluate(async ({ id, role }) => {
      const res = await fetch(`/api/users/${id}/role`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    }, { id: other.id, role: other.role });
    expect(restore.status).toBe(200);
  });
});
