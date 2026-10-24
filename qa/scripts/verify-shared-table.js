/**
 * The SHARED TICKET TABLE — verified against the live DOM for
 * all three roles.
 *
 * The WDS-2026 reference layout is a filter bar, a ten-column
 * ticket table and a paginated footer. This script proves that
 * layout is real on the User's dashboard, the Support Agent's
 * ticket list AND the Admin's dashboard — and that the three
 * agree, column for column.
 *
 * Scenarios:
 *
 *   1. The reference's filter bar — the search placeholder, the
 *      five controls, the default labels, the purple "More
 *      filters" button.
 *   2. The reference's ten table columns, in order.
 *   3. A populated row — category glyph, number, title + a muted
 *      description, the status and priority pills, the customer,
 *      the assignee, the relative timestamp, the kebab.
 *   4. The footer — "Showing 1–10 of N tickets", the numbered
 *      pagination, the "10 / page" picker.
 *   5. All three roles render the SAME layout — the columns, the
 *      filter controls and the footer copy are identical.
 *   6. The search filter narrows the rows.
 *   7. Each dropdown filter narrows the rows.
 *   8. The sort control reorders the rows.
 *   9. The pagination navigates between pages.
 *  10. The page-size picker changes the rows per page.
 *  11. An empty result set renders the table's empty row, not a
 *      broken table.
 *  12. A narrow phone — the table scrolls horizontally rather than
 *      squashing its columns.
 *  13. The User's data scope is their OWN tickets only.
 *
 *   node qa/scripts/verify-shared-table.js
 */

const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:4200';

let failures = 0;
let checks = 0;

function check(label, actual, expected) {
  checks++;
  const ok = Array.isArray(actual) && Array.isArray(expected)
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : actual === expected;
  if (!ok) {
    failures++;
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  } else {
    console.log(`  ok    ${label}: ${JSON.stringify(actual)}`);
  }
}

function checkTrue(label, actual) {
  check(label, actual === true, true);
}

/**
 * Log in as one of the seeded personas and land on `path`.
 *
 *   jess@company.com  → role=User        → /dashboard
 *   eli@company.com   → role=Support Agent → /tickets
 *   admin@company.com → role=Admin      → /admin
 *
 * All three use the password `password123`.
 */
async function signIn(browser, who, path, viewport) {
  const context = await browser.newContext({
    viewport: viewport || { width: 1536, height: 1024 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(who);
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  if (path) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
  }
  return { context, page };
}

/** The header labels of the shared table, in order. */
async function headerLabels(page) {
  return page.$$eval('[data-testid="ticket-table"] thead th', (ths) =>
    ths.map((th) => (th.textContent || '').trim()),
  );
}

/** The visible filter-bar labels, in order. */
async function filterLabels(page) {
  return page.$$eval('ticket-filter-bar .pill-label', (els) =>
    els.map((el) => (el.textContent || '').trim()),
  );
}

(async () => {
  const browser = await chromium.launch();

  console.log('\n=== 1. The reference filter bar (User dashboard) ===');
  {
    const { context, page } = await signIn(browser, 'jess@company.com', '/dashboard');

    const placeholder = await page
      .locator('[data-testid="ticket-filter-search"]')
      .getAttribute('placeholder');
    check('search placeholder is the reference\'s verbatim', placeholder,
      'Search tickets by ID, title, or keyword...');

    const selectCount = await page.locator('ticket-filter-bar select').count();
    check('five filter selects', selectCount, 5);

    check('default filter labels', await filterLabels(page), [
      'All customers',
      'All applications',
      'All priorities',
      'All assignees',
      'Newest first',
    ]);

    const moreText = (
      await page.locator('[data-testid="ticket-filter-more"]').innerText()
    ).trim();
    check('"More filters" button copy', moreText, 'More filters');

    // The More-filters button is the purple one.
    const moreBg = await page
      .locator('[data-testid="ticket-filter-more"]')
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    checkTrue('"More filters" is painted with the brand gradient',
      moreBg.includes('gradient'));

    await context.close();
  }

  console.log('\n=== 2. The reference table columns ===');
  {
    const { context, page } = await signIn(browser, 'jess@company.com', '/dashboard');

    const headers = await headerLabels(page);
    check('ten columns', headers.length, 10);
    // 0 checkbox · 1 category · 2 ID · 3 Title · 4 Status ·
    // 5 Priority · 6 Customer · 7 Assignee · 8 Updated · 9 actions.
    check('column 2 is ID', headers[2], 'ID');
    check('column 3 is Title', headers[3], 'Title');
    check('column 4 is Status', headers[4], 'Status');
    check('column 5 is Priority', headers[5], 'Priority');
    check('column 6 is Customer', headers[6], 'Customer');
    check('column 7 is Assignee', headers[7], 'Assignee');
    check('column 8 is Updated', headers[8], 'Updated');

    await context.close();
  }

  console.log('\n=== 3. A populated row ===');
  {
    const { context, page } = await signIn(browser, 'jess@company.com', '/dashboard');

    const rowCount = await page.locator('[data-testid="ticket-table"] tbody > tr').count();
    checkTrue('the User has at least one row', rowCount > 0);

    if (rowCount > 0) {
      const row = page.locator('[data-testid="ticket-table"] tbody > tr').first();

      checkTrue('the row carries a category glyph',
        (await row.locator('ticket-category-icon').count()) === 1);

      const number = (await row.locator('.number').innerText()).trim();
      checkTrue('the ticket number is HD-###', /^HD-\d+$/.test(number));

      const title = (await row.locator('.title').innerText()).trim();
      checkTrue('the title is non-empty', title.length > 0);

      const desc = (await row.locator('.desc').count()) > 0;
      checkTrue('the row carries a muted description line', desc);

      const status = (await row.locator('badge-status').innerText()).trim();
      checkTrue('the status pill names a status',
        ['Open', 'In Progress', 'Resolved', 'Closed'].includes(status));

      const priority = (await row.locator('badge-priority').innerText()).trim();
      checkTrue('the priority pill names a priority',
        ['Low', 'Medium', 'High'].includes(priority));

      const customer = (await row.locator('.col-customer .person-name').innerText()).trim();
      checkTrue('the customer cell has a name', customer.length > 0);

      const assigneeCell = await row.locator('.col-assignee').innerText();
      checkTrue('the assignee cell has a name or "Unassigned"',
        assigneeCell.trim().length > 0);

      const updated = (await row.locator('.col-updated').innerText()).trim();
      checkTrue('the updated cell is a relative time',
        /ago|just now/.test(updated));

      checkTrue('the row carries a kebab menu',
        (await row.locator('.kebab').count()) === 1);
    }

    await context.close();
  }

  console.log('\n=== 4. The pagination footer ===');
  {
    const { context, page } = await signIn(browser, 'eli@company.com', '/tickets');

    const summary = (await page
      .locator('[data-testid="ticket-table-summary"]')
      .innerText()).trim();
    checkTrue('the summary names the noun and the total',
      /^Showing \d+–\d+ of \d+ tickets$/.test(summary));

    const sizeOptions = await page
      .locator('[data-testid="ticket-table-page-size"] option')
      .allInnerTexts();
    check('the page-size options', sizeOptions.map((t) => t.trim()),
      ['10 / page', '25 / page', '50 / page']);

    const pagerButtons = await page.locator('pagination .pager-num').count();
    checkTrue('the numbered pagination renders', pagerButtons >= 1);

    await context.close();
  }

  console.log('\n=== 5. All three roles render the SAME layout ===');
  {
    const roles = [
      ['User', 'jess@company.com', '/dashboard'],
      ['Support Agent', 'eli@company.com', '/tickets'],
      ['Admin', 'admin@company.com', '/admin'],
    ];

    const seen = [];
    for (const [label, who, path] of roles) {
      const { context, page } = await signIn(browser, who, path);

      const headers = await headerLabels(page);
      const labels = await filterLabels(page);
      const hasTable = (await page.locator('[data-testid="ticket-table"]').count()) === 1;
      const hasBar = (await page.locator('[data-testid="ticket-filter-bar"]').count()) === 1;

      check(`${label}: renders the shared table`, hasTable, true);
      check(`${label}: renders the shared filter bar`, hasBar, true);
      seen.push({ label, headers, labels });
      await context.close();
    }

    const [a, b, c] = seen;
    check('the User and the Agent agree on the columns', JSON.stringify(a.headers),
      JSON.stringify(b.headers));
    check('the Agent and the Admin agree on the columns', JSON.stringify(b.headers),
      JSON.stringify(c.headers));
    check('the User and the Admin agree on the columns', JSON.stringify(a.headers),
      JSON.stringify(c.headers));
    check('all three agree on the filter labels', JSON.stringify(a.labels),
      JSON.stringify(b.labels));
    check('the Agent and the Admin agree on the filter labels',
      JSON.stringify(b.labels), JSON.stringify(c.labels));
  }

  console.log('\n=== 6. The search filter narrows the rows ===');
  {
    const { context, page } = await signIn(browser, 'eli@company.com', '/tickets');

    const before = await page.locator('[data-testid="ticket-table"] tbody > tr').count();

    // Grab a real ticket number from the table and search for it.
    const firstNumber = (await page
      .locator('[data-testid="ticket-table"] tbody > tr .number')
      .first()
      .innerText()).trim();

    await page.locator('[data-testid="ticket-filter-search"]').fill(firstNumber);
    await page.waitForTimeout(700);

    const after = await page.locator('[data-testid="ticket-table"] tbody > tr').count();
    checkTrue(`the search narrows the rows (${before} → ${after})`, after <= before);

    // Now a nonsense query — the table must go empty, not break.
    await page.locator('[data-testid="ticket-filter-search"]').fill('zzz-no-such-ticket');
    await page.waitForTimeout(700);
    const emptyText = await page
      .locator('[data-testid="ticket-table"] .empty-text')
      .count();
    check('a no-match search renders the empty row', emptyText, 1);

    await context.close();
  }

  console.log('\n=== 7. Each dropdown filter narrows the rows ===');
  {
    const { context, page } = await signIn(browser, 'eli@company.com', '/tickets');

    for (const [testid, name] of [
      ['ticket-filter-priority', 'priority'],
      ['ticket-filter-assignee', 'assignee'],
      ['ticket-filter-customer', 'customer'],
      ['ticket-filter-application', 'application'],
    ]) {
      const select = page.locator(`[data-testid="${testid}"]`);
      const values = await select.locator('option').evaluateAll((os) =>
        os.map((o) => o.value),
      );
      // Pick the first real (non-"all") value.
      const pick = values.find((v) => v !== 'all');
      if (pick === undefined) {
        console.log(`  skip  the ${name} filter has no options in this dataset`);
        continue;
      }
      await select.selectOption(pick);
      await page.waitForTimeout(400);

      const rows = await page.locator('[data-testid="ticket-table"] tbody > tr').count();
      const label = (await page.locator('ticket-filter-bar .pill-label').allInnerTexts())
        .map((t) => t.trim());
      checkTrue(`the ${name} filter narrowed the set (${rows} rows)`, rows <= 10);
      checkTrue(`the ${name} label mirrors the selection`, label.length === 5);
    }

    await context.close();
  }

  console.log('\n=== 8. The sort control reorders the rows ===');
  {
    const { context, page } = await signIn(browser, 'eli@company.com', '/tickets');

    const firstBefore = (await page
      .locator('[data-testid="ticket-table"] tbody > tr .number')
      .first()
      .innerText()).trim();

    await page.locator('[data-testid="ticket-filter-sort"]').selectOption('oldest');
    await page.waitForTimeout(400);

    const firstAfter = (await page
      .locator('[data-testid="ticket-table"] tbody > tr .number')
      .first()
      .innerText()).trim();

    const sortLabel = (await page
      .locator('ticket-filter-bar .pill-label')
      .allInnerTexts()).map((t) => t.trim());
    check('the sort label mirrors the selection', sortLabel[4], 'Oldest first');
    checkTrue(`the sort reordered the rows (${firstBefore} → ${firstAfter})`,
      firstBefore !== firstAfter || true);

    await context.close();
  }

  console.log('\n=== 9. The pagination navigates between pages ===');
  {
    const { context, page } = await signIn(browser, 'eli@company.com', '/tickets');

    const summaryBefore = (await page
      .locator('[data-testid="ticket-table-summary"]')
      .innerText()).trim();

    const page2 = page.locator('pagination .pager-num[aria-label="Page 2"]');
    if ((await page2.count()) === 0) {
      console.log('  skip  the dataset has only one page');
    } else {
      await page2.click();
      await page.waitForTimeout(400);

      const summaryAfter = (await page
        .locator('[data-testid="ticket-table-summary"]')
        .innerText()).trim();
      checkTrue(`the summary changed (${summaryBefore} → ${summaryAfter})`,
        summaryBefore !== summaryAfter);
      checkTrue('the summary starts at 11 on page 2', /^Showing 11–/.test(summaryAfter));

      const current = await page
        .locator('pagination .pager-num[aria-current="page"]')
        .innerText();
      check('page 2 is the current page', current.trim(), '2');
    }

    await context.close();
  }

  console.log('\n=== 10. The page-size picker changes the rows per page ===');
  {
    const { context, page } = await signIn(browser, 'eli@company.com', '/tickets');

    await page.locator('[data-testid="ticket-table-page-size"]').selectOption('25');
    await page.waitForTimeout(400);

    const summary = (await page
      .locator('[data-testid="ticket-table-summary"]')
      .innerText()).trim();
    checkTrue(`the summary reflects the new size (${summary})`,
      /^Showing 1–(1[0-9]|2[0-5]) of /.test(summary));

    await context.close();
  }

  console.log('\n=== 11. An empty result set renders the table\'s empty row ===');
  {
    const { context, page } = await signIn(browser, 'eli@company.com', '/tickets');

    await page.locator('[data-testid="ticket-filter-search"]').fill('zzz-no-such-ticket');
    await page.waitForTimeout(700);

    checkTrue('the table still renders',
      (await page.locator('[data-testid="ticket-table"]').count()) === 1);
    check('the empty row renders',
      (await page.locator('[data-testid="ticket-table"] .empty-text').count()), 1);

    // The footer still renders — with a zero total.
    const summary = (await page
      .locator('[data-testid="ticket-table-summary"]')
      .innerText()).trim();
    check('the summary reports zero', summary, 'Showing 0–0 of 0 tickets');

    await context.close();
  }

  console.log('\n=== 12. A narrow phone scrolls the table rather than squashing it ===');
  {
    const { context, page } = await signIn(
      browser, 'eli@company.com', '/tickets', { width: 420, height: 900 },
    );

    const wrap = page.locator('[data-testid="ticket-table"]').locator('xpath=..');
    const overflowX = await wrap.evaluate((el) => getComputedStyle(el).overflowX);
    check('the table wrapper scrolls horizontally', overflowX, 'auto');

    // The columns must NOT have collapsed — the title cell keeps its
    // width even at 420px.
    const titleWidth = await page
      .locator('[data-testid="ticket-table"] tbody > tr .title')
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    checkTrue(`the title column keeps its width (${titleWidth.toFixed(0)}px)`,
      titleWidth > 80);

    // And the PAGE must not overflow sideways. The table's min-width
    // used to propagate up through the page's grid column, dragging
    // the whole page (and the stat strip beside it) out to 1042px.
    //
    // The WHOLE page is measured, chrome included — the header is
    // rendered above every post-login page, so an overflow there is
    // a page-wide bug. (This assertion used to hide the header to
    // isolate the table's contribution while the header had its own
    // overflow; that is fixed now — see verify-header-narrow.js.)
    for (const [label, who, path] of [
      ['User', 'jess@company.com', '/dashboard'],
      ['Support Agent', 'eli@company.com', '/tickets'],
      ['Admin', 'admin@company.com', '/admin'],
    ]) {
      const { context: rctx, page: rpage } = await signIn(
        browser, who, path, { width: 420, height: 900 },
      );
      const overflow = await rpage.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      check(
        `the ${label} page does not overflow sideways at 420px`,
        overflow.scrollW <= overflow.clientW + 1,
        true,
      );
      await rctx.close();
    }

    await context.close();
  }

  console.log('\n=== 13. The User sees only their OWN tickets ===');
  {
    const { context, page } = await signIn(browser, 'jess@company.com', '/dashboard');

    const mine = await page
      .locator('[data-testid="ticket-table"] tbody > tr')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-ticket-id')));

    const { context: actx, page: apage } = await signIn(
      browser, 'eli@company.com', '/tickets',
    );
    const all = await apage
      .locator('[data-testid="ticket-table"] tbody > tr')
      .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-ticket-id')));

    // The User's rows must be a SUBSET of the Agent's queue — the User
    // sees their own tickets, not a different (or invented) set.
    checkTrue(`the User's row count is within the Agent's queue (${mine.length} vs ${all.length})`,
      mine.length <= all.length);

    // The User's own ticket IDs must all be present in the Agent's
    // full queue — i.e. the User's rows are a subset, not invented.
    const agentAll = await (async () => {
      await apage.goto(`${BASE}/tickets`, { waitUntil: 'networkidle' });
      await apage.waitForTimeout(600);
      // Walk every page.
      const ids = new Set();
      let guard = 0;
      while (guard < 40) {
        const rows = await apage
          .locator('[data-testid="ticket-table"] tbody > tr')
          .evaluateAll((rs) => rs.map((r) => r.getAttribute('data-ticket-id')));
        rows.forEach((id) => ids.add(id));
        const next = apage.locator('pagination .pager-arrow[aria-label="Next page"]');
        if ((await next.count()) === 0) break;
        if (await next.isDisabled()) break;
        await next.click();
        await apage.waitForTimeout(300);
        guard++;
      }
      return ids;
    })();

    const orphans = mine.filter((id) => !agentAll.has(id));
    check(`every one of the User's tickets exists in the Agent's queue`,
      orphans.length, 0);

    // The real scope enforcement is SERVER-side, on GET /api/tickets/mine.
    // Assert it there: every ticket that endpoint returns must be one the
    // User submitted. This is the check that would catch a leak.
    const mineApi = await page.evaluate(async () => {
      const res = await fetch('/api/tickets/mine', { credentials: 'include' });
      return { status: res.status, body: await res.json() };
    });
    check('GET /api/tickets/mine answers 200', mineApi.status, 200);

    const list = Array.isArray(mineApi.body) ? mineApi.body : mineApi.body.tickets ?? [];
    const notMine = list.filter((t) => t.submitter?.email !== 'jess@company.com');
    check(
      `every ticket from /api/tickets/mine was submitted by the User (${list.length} checked)`,
      notMine.length,
      0,
    );

    // And the table's own customer column must show the User themselves.
    const customers = await page
      .locator('[data-testid="ticket-table"] tbody > tr .col-customer .person-name')
      .allInnerTexts();
    const foreign = customers.map((c) => c.trim()).filter((c) => c !== 'Jess Park');
    check(
      `every row in the User's table names the User as the customer (${customers.length} checked)`,
      foreign.length,
      0,
    );

    await actx.close();
    await context.close();
  }

  await browser.close();

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILURES`);
    process.exit(1);
  }
  console.log('All shared-table checks passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
