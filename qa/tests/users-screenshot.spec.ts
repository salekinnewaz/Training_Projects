import { test, loginAs } from './fixtures';

test.describe('Users page screenshots', () => {
  test('capture /users and /admin#users', async ({ page }) => {
    await loginAs(page, 'admin');

    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/users-standalone.png', fullPage: true });

    await page.goto('/admin#users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'screenshots/users-admin-tab.png', fullPage: true });
  });
});
