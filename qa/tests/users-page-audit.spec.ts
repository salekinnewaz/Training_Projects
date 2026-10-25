import { test, expect, loginAs } from './fixtures';

/**
 * Users page design/bug audit — captures the current DOM state.
 */
test.describe('Users page audit', () => {
  test('standalone /users — count chrome/heading instances', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    console.log('=== /users ===');
    console.log('header-chrome count:', await page.locator('header-chrome').count());
    console.log('h1 count:', await page.locator('h1').count());
    console.log('h1 texts:', await page.locator('h1').allInnerTexts());
    console.log('profile-trigger count:', await page.locator('.profile-trigger').count());
    console.log('select count:', await page.locator('select').count());
    console.log('select values:', await page.locator('select').evaluateAll((els) => els.map((e) => (e as HTMLSelectElement).value)));
    console.log('nav links:', await page.locator('.chrome-nav .nav-link').allInnerTexts());
  });

  test('/admin#users — count chrome/heading instances', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin#users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);

    console.log('=== /admin#users ===');
    console.log('header-chrome count:', await page.locator('header-chrome').count());
    console.log('h1 count:', await page.locator('h1').count());
    console.log('h1 texts:', await page.locator('h1').allInnerTexts());
    console.log('profile-trigger count:', await page.locator('.profile-trigger').count());
    console.log('select count:', await page.locator('select').count());
    console.log('select values:', await page.locator('select').evaluateAll((els) => els.map((e) => (e as HTMLSelectElement).value)));
    console.log('tabs:', await page.locator('.tabs .tab').allInnerTexts());
    console.log('nav links:', await page.locator('.chrome-nav .nav-link').allInnerTexts());
  });

  test('role change round-trip on /users', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    // Find a non-self row (the self row is disabled).
    const rows = page.locator('.user-row:not(.user-row--self)');
    const n = await rows.count();
    console.log('non-self rows:', n);
    const first = rows.first();
    const name = await first.locator('.user-row__display-name').innerText();
    const sel = first.locator('select');
    console.log('row', name, 'current value:', await sel.inputValue());

    await sel.selectOption('Support Agent');
    await page.waitForTimeout(900);
    console.log('after selectOption value:', await sel.inputValue());
    console.log('row error:', await first.locator('.user-row__error').count()
      ? await first.locator('.user-row__error').innerText()
      : 'none');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    const after = page.locator('.user-row', { hasText: name }).first().locator('select');
    console.log('after reload value:', await after.inputValue());
  });
});
