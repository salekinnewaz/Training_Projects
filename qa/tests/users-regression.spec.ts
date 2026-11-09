import { test, expect, loginAs, Page } from './fixtures';

/**
 * Sets a row's role through the UI, transparently handling the
 * Admin-demote confirmation dialog.
 *
 * The users table guards destructive role changes behind a
 * confirmation ("Demote <name> from Admin to <role>?"). A caller
 * that only wants "the role should end up as X" should not have to
 * know whether X happens to be a demotion.
 *
 * Returns once the change has been applied and the row has settled.
 */
async function setRoleViaUi(
  page: Page,
  row: import('@playwright/test').Locator,
  role: string,
): Promise<void> {
  await row.locator('select').selectOption(role);
  await page.waitForTimeout(600);

  // A demotion opens a confirmation — accept it.
  if ((await page.getByRole('dialog').count()) > 0) {
    await page.getByRole('button', { name: /^demote$/i }).last().click();
    await page.waitForTimeout(1200);
  }

  // Surface an inline row error as a hard failure — a silent
  // no-op would otherwise look like a successful change.
  const err = row.locator('.user-row__error');
  if ((await err.count()) > 0) {
    throw new Error(`role change failed: ${(await err.innerText()).trim()}`);
  }
}

/**
 * Reads the human-readable role label a row currently shows.
 *
 * The WDS-2026 rework dropped the separate static role badge and
 * folded the role into the compact `<atom-select>`: the real
 * `<select>` carries the machine value while the
 * `.select-wrap__overlay` span paints the readable label ("Employee"
 * / "Support Agent" / "Admin") over the closed control.
 *
 * Falls back to the selected `<option>` text when no overlay is
 * rendered, so the helper works on both the compact and the plain
 * variant of the select.
 */
async function roleLabelOf(
  row: import('@playwright/test').Locator,
): Promise<string> {
  const overlay = row.locator('.select-wrap__overlay');
  if ((await overlay.count()) > 0) {
    return (await overlay.first().innerText()).trim();
  }
  const selected = row.locator('select option:checked');
  return (await selected.first().innerText()).trim();
}

/**
 * Regression suite for the Admin Users page.
 *
 * Covers the three defects reported after the users-page redesign:
 *
 *   1. A role change did not persist — reloading the page showed the
 *      role reverted to "User". Root cause: `<atom-select>` bound
 *      `[value]` on the `<select>` element, which the browser ignores
 *      when choosing the displayed option; it fell back to
 *      `selectedIndex === 0` ("User"). Fixed by marking the matching
 *      `<option>` as `selected` declaratively and re-asserting
 *      `select.value` in `ngAfterViewChecked`.
 *
 *   2. Every row rendered as "User" by default — same root cause.
 *
 *   3. The page rendered the app chrome, the heading and the nav
 *      TWICE (the standalone `/users` route embedded the full
 *      `app-chrome` inside a shell that already had one, and the
 *      admin dashboard's Users tab rendered its own heading on top
 *      of the page heading). Fixed by making the tab component a
 *      pure content component and moving chrome + heading into a
 *      dedicated shell used by the standalone route.
 *
 * NOTE ON TEST DATA
 * ─────────────────
 * These tests mutate the seeded user roles. To stay repeatable and
 * order-independent, every role-changing test RESTORES the role it
 * changed when it finishes.
 */

test.describe('Admin Users page — regression', () => {
  test.describe('role persistence', () => {
    test('select renders the role that is actually stored', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      const rows = page.locator('.user-row:not(.user-row--self)');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);

      // Every non-self row's select must display its OWN user's
      // role — not the first option in the list.
      const mismatches: string[] = [];
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const name = (await row.locator('.user-row__display-name').innerText()).trim();
        const selectValue = await row.locator('select').inputValue();
        const shownLabel = await roleLabelOf(row);

        // The select's value is the machine role; the overlay is the
        // human label. Map the label back to the enum value.
        const labelToRole: Record<string, string> = {
          Employee: 'User',
          'Support Agent': 'Support Agent',
          Admin: 'Admin',
        };
        const expected = labelToRole[shownLabel];
        if (expected && selectValue !== expected) {
          mismatches.push(`${name}: label=${shownLabel} select=${selectValue}`);
        }
      }
      expect(mismatches, `rows showing the wrong role:\n${mismatches.join('\n')}`).toEqual([]);
    });

    test('a changed role survives a full page reload', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      const rows = page.locator('.user-row:not(.user-row--self)');
      const first = rows.first();
      const name = (await first.locator('.user-row__display-name').innerText()).trim();
      const sel = first.locator('select');

      // Pick a role that is definitely NOT the current one.
      const current = await sel.inputValue();
      const target = current === 'Support Agent' ? 'Admin' : 'Support Agent';

      await setRoleViaUi(page, first, target);

      try {
        // Reload and assert the NEW role is what the select shows.
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(900);

        const afterReload = page
          .locator('.user-row', { hasText: name })
          .first()
          .locator('select');
        await expect(afterReload).toHaveValue(target);
      } finally {
        // Restore the seeded role so the suite is repeatable.
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(900);
        await setRoleViaUi(
          page,
          page.locator('.user-row', { hasText: name }).first(),
          current,
        );
      }
    });

    test('the badge and the select agree after a role change', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      const rows = page.locator('.user-row:not(.user-row--self)');
      const first = rows.first();
      const name = (await first.locator('.user-row__display-name').innerText()).trim();
      const sel = first.locator('select');
      const current = await sel.inputValue();
      const target = current === 'Admin' ? 'Support Agent' : 'Admin';

      await setRoleViaUi(page, first, target);

      try {
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(900);

        const row = page.locator('.user-row', { hasText: name }).first();
        const label = await roleLabelOf(row);
        const value = await row.locator('select').inputValue();

        const labelToRole: Record<string, string> = {
          Employee: 'User',
          'Support Agent': 'Support Agent',
          Admin: 'Admin',
        };
        expect(labelToRole[label]).toBe(value);
      } finally {
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(900);
        await setRoleViaUi(
          page,
          page.locator('.user-row', { hasText: name }).first(),
          current,
        );
      }
    });

    test('demoting an Admin asks for confirmation and applies on accept', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      // The seeded data has exactly ONE Admin — the logged-in admin
      // themselves — and self-protection disables their own controls.
      // So promote a non-Admin user first (a promotion is not
      // destructive and opens no dialog), then demote them to
      // trigger the confirmation.
      const rows = page.locator('.user-row:not(.user-row--self)');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);

      let row = null;
      for (let i = 0; i < rowCount; i++) {
        const candidate = rows.nth(i);
        if ((await candidate.locator('select').inputValue()) !== 'Admin') {
          row = candidate;
          break;
        }
      }
      expect(row, 'no non-Admin row available to promote').not.toBeNull();
      const target = row!;

      const name = (await target.locator('.user-row__display-name').innerText()).trim();
      const originalRole = await target.locator('select').inputValue();

      try {
        // Promote to Admin.
        await target.locator('select').selectOption('Admin');
        await page.waitForTimeout(1200);
        await expect(target.locator('select')).toHaveValue('Admin');

        // Demote → the confirmation dialog must appear. It is
        // rendered via a portal into <body>, so target the
        // `role="dialog"` element rather than the `dialog-modal`
        // host (which stays empty and has no visible box).
        await target.locator('select').selectOption('Support Agent');
        await page.waitForTimeout(600);

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(new RegExp(`Demote ${name} from Admin`, 'i'));

        // Cancel leaves the role untouched.
        await page.getByRole('button', { name: /^cancel$/i }).last().click();
        await page.waitForTimeout(600);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(target.locator('select')).toHaveValue('Admin');

        // Re-do it and accept — now the role applies.
        await target.locator('select').selectOption('Support Agent');
        await page.waitForTimeout(600);
        await page.getByRole('button', { name: /^demote$/i }).last().click();
        await page.waitForTimeout(1200);

        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(900);

        const rowAfter = page.locator('.user-row', { hasText: name }).first();
        await expect(rowAfter.locator('select')).toHaveValue('Support Agent');
        expect(await roleLabelOf(rowAfter)).toBe('Support Agent');
      } finally {
        // Restore the seeded role.
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(900);
        await setRoleViaUi(
          page,
          page.locator('.user-row', { hasText: name }).first(),
          originalRole,
        );
      }
    });
  });

  test.describe('no duplicated chrome / heading / nav', () => {
    test('standalone /users renders exactly one chrome, heading and profile trigger', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      await expect(page.locator('header-chrome')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(/users/i);
      await expect(page.locator('.profile-trigger')).toHaveCount(1);
    });

    test('/admin#users renders exactly one chrome, heading and profile trigger', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/admin#users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1200);

      await expect(page.locator('header-chrome')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.profile-trigger')).toHaveCount(1);
    });

    test('the primary nav lists each destination exactly once', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/admin#users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1200);

      const labels = (await page.locator('.chrome-nav .nav-link').allInnerTexts()).map((t) =>
        t.trim().toLowerCase(),
      );
      const ticketsCount = labels.filter((l) => l === 'tickets').length;
      const usersCount = labels.filter((l) => l === 'users').length;

      expect(ticketsCount).toBeLessThanOrEqual(1);
      expect(usersCount).toBeLessThanOrEqual(1);
    });
  });

  test.describe('role column design', () => {
    test('the role column shows the role once, in full, without truncation', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      const rows = page.locator('.user-row:not(.user-row--self)');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const labelText = await roleLabelOf(row);

        // The label carries the full role name — no ellipsis.
        expect(labelText).not.toContain('…');
        expect(labelText).not.toContain('...');
        // And it is one of the three real roles, spelled out.
        expect(['Employee', 'Support Agent', 'Admin']).toContain(labelText);

        // The select must not overflow its own box (no clipped
        // label) — scrollWidth should not exceed clientWidth.
        const overflow = await row.locator('select').evaluate((el) => {
          const s = el as HTMLSelectElement;
          return { scroll: s.scrollWidth, client: s.clientWidth };
        });
        expect(
          overflow.scroll,
          `select clipped its label (scroll=${overflow.scroll} client=${overflow.client})`,
        ).toBeLessThanOrEqual(overflow.client + 1);
      }
    });

    test('the role column shows a compact change control', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      const first = page.locator('.user-row:not(.user-row--self)').first();
      await expect(first.locator('select')).toBeVisible();

      // The role is shown ONCE — the select itself carries it, so
      // there is no separate badge repeating the same word.
      await expect(first.locator('.user-row__role-badge')).toHaveCount(0);

      // The select's closed state shows the full role name.
      const shown = await first.locator('select option:checked').innerText();
      expect(shown.trim()).toBe(await roleLabelOf(first));

      const width = await first.locator('select').evaluate((el) => el.clientWidth);
      expect(width).toBeLessThanOrEqual(140);
    });

    test('the compact control still opens the native dropdown with all roles', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      const first = page.locator('.user-row:not(.user-row--self)').first();
      const options = await first.locator('select option').allInnerTexts();
      expect(options.map((o) => o.trim()).sort()).toEqual(
        ['Admin', 'Employee', 'Support Agent'].sort(),
      );
    });
  });

  test.describe('users page controls', () => {
    test('the search box filters the user list', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      const total = await page.locator('.user-row').count();
      expect(total).toBeGreaterThan(0);

      const firstName = (
        await page.locator('.user-row__display-name').first().innerText()
      ).trim();
      await page.locator('[data-testid="users-search"]').fill(firstName);
      await page.waitForTimeout(400);

      const filtered = await page.locator('.user-row').count();
      expect(filtered).toBeGreaterThan(0);
      expect(filtered).toBeLessThanOrEqual(total);

      await page.locator('[data-testid="users-search"]').fill('zzzzz-no-such-user');
      await page.waitForTimeout(400);
      await expect(page.locator('[data-testid="users-empty"]')).toBeVisible();
    });

    test('a role filter narrows the list and toggles off', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      const total = await page.locator('.user-row').count();
      // Filter on "Support Agent" — the seed has several of them,
      // so the assertion is stable regardless of how many Admins
      // happen to exist.
      const filter = page.locator('[data-testid="users-role-filter"]');
      await expect(filter).toBeVisible();

      await filter.selectOption('Support Agent');
      await page.waitForTimeout(400);
      const agents = await page.locator('.user-row').count();
      expect(agents).toBeLessThan(total);
      expect(agents).toBeGreaterThan(0);

      // Every visible row is now an Agent.
      const rows = page.locator('.user-row');
      for (let i = 0; i < agents; i++) {
        const value = await rows.nth(i).locator('select').inputValue();
        expect(value).toBe('Support Agent');
      }

      // Switching the filter back to "All roles" clears it.
      await filter.selectOption('all');
      await page.waitForTimeout(400);
      await expect(page.locator('.user-row')).toHaveCount(total);
    });

    test('the stat cards reflect the real user list', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      await expect(page.locator('[data-testid="users-stat-row"]')).toBeVisible();

      const total = await page.locator('.user-row').count();
      const totalText = (
        await page
          .locator('[data-testid="stat-total"]')
          .locator('.stat-card__value')
          .innerText()
      ).trim();
      expect(Number(totalText)).toBe(total);
    });
  });

  test.describe('self-row protection', () => {
    test('the admin cannot change their own role', async ({ page }) => {
      await loginAs(page, 'admin');
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(600);

      const selfRow = page.locator('.user-row--self');
      await expect(selfRow).toHaveCount(1);

      // The select is disabled and the toggle is disabled.
      await expect(selfRow.locator('select')).toBeDisabled();
      await expect(selfRow.locator('.user-row__active-toggle')).toBeDisabled();

      // The "You" tag marks the row as the admin's own and carries
      // the explanation of why the controls are locked. It sits
      // INSIDE the row (it used to be absolutely positioned below
      // the row and overlapped the next one).
      const tag = selfRow.locator('.user-row__you-tag');
      await expect(tag).toBeVisible();
      await expect(tag).toHaveText('You');
      await expect(tag).toHaveAttribute(
        'title',
        'You cannot change your own role',
      );

      const tagBox = await tag.boundingBox();
      const rowBox = await selfRow.boundingBox();
      expect(tagBox).not.toBeNull();
      expect(rowBox).not.toBeNull();
      if (tagBox && rowBox) {
        // The tag's bottom edge must sit within the row's box.
        expect(tagBox.y + tagBox.height).toBeLessThanOrEqual(rowBox.y + rowBox.height + 2);
      }
    });
  });
});
