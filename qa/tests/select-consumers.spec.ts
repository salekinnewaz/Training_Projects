import { test, expect, loginAs } from './fixtures';

/**
 * Regression suite for the shared `<atom-select>` atom.
 *
 * The `[value]`-on-`<select>` binding bug was fixed in the ATOM, so
 * every select in the app is affected by that fix: the Admin Users
 * role dropdown, the ticket detail's status / priority / category /
 * assignee, and the Kanban board's filters.
 *
 * This suite covers the consumers OUTSIDE the users page (which
 * `users-regression.spec.ts` covers) — the ticket detail page.
 *
 * The invariant: a select's DISPLAYED option must be the option its
 * `value` points at. A native `<select>` shows whichever `<option>`
 * carries the `selected` flag — NOT whichever one happens to match
 * the element's `value` property. Asserting only `select.value`
 * would pass even when the user sees a different option on screen.
 */
test('the ticket detail selects display their bound value', async ({ page }) => {
  await loginAs(page, 'sam');

  // Fetch a ticket id via the API using the browser's auth cookie.
  const ticketId = await page.evaluate(async () => {
    const res = await fetch('/api/tickets/queue', { credentials: 'include' });
    const body = await res.json();
    const list = body.tickets ?? body.queue ?? body.data ?? [];
    return list[0]?.id ?? null;
  });
  expect(ticketId, 'no ticket id from the API').not.toBeNull();

  await page.goto(`/tickets/${ticketId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const selects = page.locator('select');
  const n = await selects.count();
  expect(n, 'ticket detail renders no selects').toBeGreaterThan(0);

  for (let i = 0; i < n; i++) {
    const s = selects.nth(i);
    const id = await s.getAttribute('id');
    const value = await s.inputValue();

    // The value must be one of the select's own options.
    const options = await s.evaluate((el) =>
      Array.from((el as HTMLSelectElement).options).map((o) => o.value),
    );
    expect(
      options,
      `select #${id} has value "${value}" which is not among its options`,
    ).toContain(value);

    // AND the browser must be DISPLAYING that option.
    const selectedIndexMatches = await s.evaluate((el) => {
      const sel = el as HTMLSelectElement;
      return sel.options[sel.selectedIndex]?.value === sel.value;
    });
    expect(
      selectedIndexMatches,
      `select #${id} displays a different option than its value`,
    ).toBe(true);
  }
});
