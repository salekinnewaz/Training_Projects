import { test, expect, loginAs } from './fixtures';

/**
 * Regression suite for the `<dialog-modal>` portal lifecycle.
 *
 * The dialog moves its scrim + modal into `document.body` so
 * `position: fixed` escapes the chrome's sticky header. Those nodes
 * then live OUTSIDE Angular's view — destroying the `<dialog-modal>`
 * host does not remove them.
 *
 * The bug: cancelling a dialog left the scrim + modal in `<body>`
 * forever. An inert dialog overlay lingered over the page for the
 * rest of the session, with Cancel / Confirm buttons that no longer
 * had a live component behind them. The user could neither dismiss
 * it nor interact with the page beneath it.
 *
 * This affects every dialog in the app — logout, admin-demote,
 * admin-deactivate — so the check is done here on the users page's
 * demote dialog, which is easy to open and cancel.
 *
 * NOTE ON TEST DATA
 * ─────────────────
 * The demote tests mutate the seeded user roles. Every one of them
 * RESTORES the role it changed, so the suite is repeatable and
 * order-independent.
 */

/** Counts the portalled nodes that are direct children of <body>. */
const countPortals = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.querySelectorAll('[role="dialog"], .scrim').length);

/**
 * Opens the demote-confirmation dialog on a non-self Admin row.
 *
 * The seeded data has exactly ONE Admin — the logged-in admin
 * themselves — and self-protection disables their own controls. So
 * this helper first PROMOTES a non-Admin user (a promotion is not
 * destructive and opens no dialog), then demotes them to trigger the
 * confirmation.
 *
 * Returns a restore function that puts the user's role back.
 */
async function openDemoteDialog(page: import('@playwright/test').Page) {
  const rows = page.locator('.user-row:not(.user-row--self)');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);

  // Find a non-Admin row to promote.
  let target = null;
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const value = await row.locator('select').inputValue();
    if (value !== 'Admin') {
      target = row;
      break;
    }
  }
  expect(target, 'no non-Admin row available to promote').not.toBeNull();
  const row = target!;

  const name = (await row.locator('.user-row__display-name').innerText()).trim();
  const originalRole = await row.locator('select').inputValue();

  // Promote to Admin (no confirmation dialog for a promotion).
  await row.locator('select').selectOption('Admin');
  await page.waitForTimeout(1200);

  // Now demote → the confirmation dialog opens.
  await row.locator('select').selectOption('Support Agent');
  await page.waitForTimeout(600);

  const restore = async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
    const restored = page.locator('.user-row', { hasText: name }).first();
    await restored.locator('select').selectOption(originalRole);
    await page.waitForTimeout(600);
    if ((await page.getByRole('dialog').count()) > 0) {
      await page.getByRole('button', { name: /^demote$/i }).last().click();
      await page.waitForTimeout(1000);
    }
  };

  return { name, restore };
}

test.describe('Dialog portal cleanup', () => {
  test('cancelling a dialog removes it from the DOM', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    expect(await countPortals(page)).toBe(0);

    const { restore } = await openDemoteDialog(page);
    try {
      expect(await countPortals(page)).toBe(2); // the dialog + its scrim

      // Cancel it.
      await page.getByRole('button', { name: /^cancel$/i }).last().click();
      await page.waitForTimeout(900);

      // The portalled nodes MUST be gone.
      expect(await countPortals(page)).toBe(0);
    } finally {
      await restore();
    }
  });

  test('accepting a dialog removes it from the DOM', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    const { restore } = await openDemoteDialog(page);
    try {
      expect(await countPortals(page)).toBe(2);

      await page.getByRole('button', { name: /^demote$/i }).last().click();
      await page.waitForTimeout(1200);

      expect(await countPortals(page)).toBe(0);
    } finally {
      await restore();
    }
  });

  test('the logout confirmation dialog also cleans up', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    expect(await countPortals(page)).toBe(0);

    // The chrome's profile trigger carries the user's DISPLAY
    // NAME, not their role.
    await page.getByRole('button', { name: 'Avery Patel' }).click();
    await page.getByRole('button', { name: /^log out$/i }).first().click();
    await page.waitForTimeout(600);

    expect(await countPortals(page)).toBe(2);

    await page.getByRole('button', { name: /^cancel$/i }).last().click();
    await page.waitForTimeout(900);

    expect(await countPortals(page)).toBe(0);
  });
});
