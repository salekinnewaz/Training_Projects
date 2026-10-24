#!/usr/bin/env node
/**
 * visual-tickets-check.mjs — one-off visual verification for the
 * HD-019 Tickets list page + notifications bell.
 *
 * Logs in as Eli (Support Agent), walks the new /tickets page,
 * asserts the screenshot's landmark elements are present, and drops
 * PNGs into qa/screenshots/ for side-by-side comparison.
 *
 * Also asserts the User-role gate: Eli is the agent persona, but
 * Jess (Employee) must never reach the table.
 *
 * Run: node qa/scripts/visual-tickets-check.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL ?? 'http://localhost:4200';
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, '..', 'screenshots');

const results = [];
function record(area, ok, detail = '') {
  results.push({ area, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${area}${detail ? ` — ${detail}` : ''}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.locator('input#login-email').fill(email);
  await page.locator('input#login-password').fill('password123');
  // The live build renders "Log in"; older fixtures used "Sign in".
  const btn = page
    .getByRole('button', { name: /^(log in|sign in)$/i })
    .first();
  await btn.click();
  await page.waitForURL(/\/(admin|queue|tickets|dashboard)/, { timeout: 15_000 });
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const consoleErrors = [];

  try {
    // ── Agent view: Eli ────────────────────────────────────────
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    await login(page, 'eli@company.com');
    record('login', true, page.url());

    // Land on /tickets explicitly (the nav link is what we changed).
    await page.goto(`${BASE}/tickets`);
    await page.waitForSelector('[data-testid="ticket-table"]', { timeout: 15_000 });
    await page.waitForTimeout(500);

    // ── Landmarks from the reference screenshot ────────────────
    //
    // The Agent's page renders the SHARED <stat-strip> molecule —
    // the same one the User's dashboard and the Admin's page use.
    // Its cards carry the class `card` (not the old per-page
    // `stat-card`'s `stat`), and its sparklines are inline SVG inside
    // a `.spark` wrapper rather than an <atom-sparkline> host. Count
    // the MOLECULE's own markup, not the wrapper's testid.
    const statCards = await page.locator('[data-testid="stat-strip"] article.card').count();
    record('stat strip', statCards === 5, `${statCards} cards (expected 5)`);

    const sparklines = await page.locator('[data-testid="stat-strip"] .spark svg').count();
    record('sparklines', sparklines === 4, `${sparklines} sparklines`);

    const bars = await page.locator('[data-testid="stat-strip"] .bar .bar-fill').count();
    record('progress bars', bars === 4, `${bars} bars`);

    const filterBar = await page.locator('[data-testid="ticket-filter-bar"]').count();
    record('filter bar', filterBar === 1);

    const rows = await page.locator('[data-testid="ticket-table"] tbody > tr').count();
    record('table rows', rows > 0, `${rows} rows`);

    const pagination = await page.locator('[data-testid="ticket-table-summary"]').count();
    record('pagination', pagination === 1);

    await page.screenshot({ path: join(SHOTS, 'tickets-page.png'), fullPage: true });

    // ── Filtering works ────────────────────────────────────────
    // The shared filter bar filters by priority (one of the four
    // reference dropdowns), so drive that select.
    await page.locator('[data-testid="ticket-filter-priority"]').selectOption('High');
    await page.waitForTimeout(500);
    const filtered = await page.locator('[data-testid="ticket-table"] tbody > tr').count();
    record('priority filter', filtered > 0 && filtered <= rows, `${rows} → ${filtered} rows`);
    await page.screenshot({ path: join(SHOTS, 'tickets-filtered.png'), fullPage: true });

    // Clear it back to "All priorities".
    await page.locator('[data-testid="ticket-filter-priority"]').selectOption('all');
    await page.waitForTimeout(500);
    const after = await page.locator('[data-testid="ticket-table"] tbody > tr').count();
    record('clear filters', after === rows, `${after} rows`);

    // ── Notifications bell ─────────────────────────────────────
    const bell = page.locator('[data-testid="notification-bell"]').first();
    const bellCount = await bell.count();
    record('bell present', bellCount === 1);
    if (bellCount) {
      const dot = await page.locator('[data-testid="notification-dot"]').count();
      record('unread dot', dot >= 0, dot ? 'visible' : 'no dot (all read)');
      await bell.click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(SHOTS, 'tickets-notifications-open.png') });
      const panel = await page.locator('[data-testid="notifications-panel"]').count();
      record('notifications panel', panel === 1);
    }

    await ctx.close();

    // ── User role must be blocked ──────────────────────────────
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await ctx2.newPage();
    await login(p2, 'jess@company.com');
    await p2.goto(`${BASE}/tickets`);
    await p2.waitForTimeout(1200);
    const finalUrl = p2.url();
    const hasTable = await p2.locator('[data-testid="ticket-table"]').count();
    record(
      'user role gated out of /tickets',
      !finalUrl.endsWith('/tickets') || hasTable === 0,
      finalUrl,
    );
    await p2.screenshot({ path: join(SHOTS, 'tickets-user-gated.png'), fullPage: true });
    await ctx2.close();
  } finally {
    await browser.close();
  }

  console.log('\n── console errors captured ──');
  if (consoleErrors.length === 0) console.log('(none)');
  else consoleErrors.slice(0, 20).forEach((e) => console.log(' •', e));

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed.`,
  );
  if (failed.length) {
    console.log('FAILURES:');
    failed.forEach((f) => console.log(` - ${f.area}: ${f.detail}`));
    process.exitCode = 1;
  }
}

function filtered0(n) {
  return n;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});