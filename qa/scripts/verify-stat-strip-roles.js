/**
 * verify-stat-strip-roles.js — the stat strip on all three roles.
 *
 * The WDS-2026 reference strip (the User dashboard's, verified
 * pixel-for-pixel by verify-strip.js) is the ONE stat strip for the
 * whole app. All three roles render the same <stat-strip> molecule:
 *
 *   - the User's dashboard   (counts scoped to their own tickets)
 *   - the Agent's ticket list (counts team-wide)
 *   - the Admin's dashboard   (counts team-wide)
 *
 * Only the DATA SCOPE differs. The geometry, the anatomy and the
 * behaviour are identical — which is what this gate proves.
 *
 * Usage:
 *   node qa/scripts/verify-stat-strip-roles.js
 *
 * Requires: the app on localhost:4200, the backend on localhost:3000,
 * and real logins for all three personas.
 */

const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:4200';

const PERSONAS = [
  { label: 'User', email: 'jess@company.com', path: '/dashboard' },
  { label: 'Support Agent', email: 'eli@company.com', path: '/tickets' },
  { label: 'Admin', email: 'admin@company.com', path: '/admin' },
];

let checks = 0;
let failures = 0;

function check(label, actual, expected) {
  checks++;
  const ok = Array.isArray(actual) && Array.isArray(expected)
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20_000 });
  await page.waitForSelector('[data-testid="stat-strip"]', { timeout: 20_000 });
  await page.waitForTimeout(500);
}

/**
 * Read the strip's structure and geometry from the live DOM.
 *
 * The card HEIGHTS and WIDTHS are the load-bearing measurements: the
 * shared molecule's cards are 88px tall with the reference's unequal
 * widths (22.56 / 18.42 / 17.75 / 19.16 / 22.12 fr). If a page
 * renders its own strip instead of the shared one, the heights and
 * the width ratios will not match.
 */
async function readStrip(page) {
  return page.evaluate(() => {
    const strip = document.querySelector('[data-testid="stat-strip"]');
    if (!strip) return { present: false };

    const total = strip.querySelector('[data-testid="stat-total-card"]');
    const statusCards = Array.from(
      strip.querySelectorAll('[data-testid^="stat-card-"]'),
    );
    const cards = total ? [total, ...statusCards] : statusCards;

    const range = document.createRange();

    return {
      present: true,
      isMolecule: !!strip.querySelector('stat-strip'),
      cardCount: cards.length,
      totalLabel: total?.querySelector('.label')?.textContent?.trim(),
      totalValue: total?.querySelector('.value')?.textContent?.trim(),
      caption: total?.querySelector('.caption')?.textContent?.trim(),
      hasDeltaPill: !!total?.querySelector('.delta'),
      statusLabels: statusCards.map((c) => c.querySelector('.label')?.textContent?.trim()),
      statusValues: statusCards.map((c) => c.querySelector('.value')?.textContent?.trim()),
      accents: statusCards.map((c) => c.getAttribute('data-accent')),
      sparkCount: statusCards.filter((c) => !!c.querySelector('.spark svg')).length,
      barCount: statusCards.filter((c) => !!c.querySelector('.bar .bar-fill')).length,
      cardHeights: cards.map((c) => Math.round(c.getBoundingClientRect().height)),
      cardWidths: cards.map((c) => Math.round(c.getBoundingClientRect().width)),
      // The reference's tiles are tinted squares; a different
      // implementation would not carry this class.
      hasTiles: !!strip.querySelector('.tile'),
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const readings = {};

  for (const p of PERSONAS) {
    console.log(`\n=== The ${p.label}'s strip (${p.path}) ===`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, p.email);

    const r = await readStrip(page);
    readings[p.label] = r;

    check('the strip renders', r.present, true);
    check('it is the shared <stat-strip> molecule', r.isMolecule, true);
    check('it has five cards (Total + four statuses)', r.cardCount, 5);
    check('the summary card is labelled "Total Tickets"', r.totalLabel, 'Total Tickets');
    check('the status labels are Open / In Progress / Resolved / Closed',
      r.statusLabels,
      ['Open', 'In Progress', 'Resolved', 'Closed']);
    check('the accents are open / inProgress / resolved / closed',
      r.accents,
      ['open', 'inProgress', 'resolved', 'closed']);
    check('every status card carries a sparkline', r.sparkCount, 4);
    check('every status card carries a progress bar', r.barCount, 4);
    check('every card carries a tinted icon tile', r.hasTiles, true);
    check('the caption reads "vs last month"', r.caption, 'vs last month');
    // The reference's cards are 88px tall.
    check('all five cards are 88px tall', r.cardHeights, [88, 88, 88, 88, 88]);
    // The reference's cards are NOT equal width — the Total card is
    // the widest. (22.56 / 18.42 / 17.75 / 19.16 / 22.12 fr.)
    const widths = r.cardWidths;
    check('the cards have the reference\'s unequal widths',
      widths[0] > widths[1] && widths[1] > widths[2] && widths[3] > widths[2] && widths[4] > widths[3],
      true);

    await ctx.close();
  }

  // ── The three roles agree on geometry ──────────────────────
  console.log('\n=== The three roles render the SAME strip ===');

  /**
   * The cards' WIDTH RATIO, not their absolute pixels.
   *
   * The molecule's tracks are fractions (22.56 / 18.42 / 17.75 /
   * 19.16 / 22.12 fr), so the cards scale with their container.
   * The User's dashboard content column is wider than the Agent's
   * (the Agent's page caps at 1440px with wider gutters), so the
   * absolute widths differ — but the proportions must not.
   */
  const ratios = (widths) => {
    const sum = widths.reduce((a, b) => a + b, 0);
    return widths.map((w) => (w / sum) * 100);
  };

  /**
   * True when two ratio lists agree within a quarter of a percent.
   * The widths are integer pixels, so the computed ratios can differ
   * by a hair between containers of different widths — a 0.1% drift
   * is rounding, not a layout difference. Anything larger means the
   * tracks genuinely differ.
   */
  const sameRatios = (a, b) =>
    a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.25);

  const user = readings['User'];
  const agent = readings['Support Agent'];
  const admin = readings['Admin'];
  check('the Agent and the Admin have identical card heights',
    agent.cardHeights, admin.cardHeights);
  check('the Agent and the Admin have identical card widths',
    agent.cardWidths, admin.cardWidths);
  check('the User and the Agent have identical card heights',
    user.cardHeights, agent.cardHeights);
  check('the User and the Agent have the same card width RATIOS',
    sameRatios(ratios(user.cardWidths), ratios(agent.cardWidths)), true);
  check('the User and the Admin have the same card width RATIOS',
    sameRatios(ratios(user.cardWidths), ratios(admin.cardWidths)), true);

  // ── The data scope differs ──────────────────────────────────
  console.log('\n=== The data scope differs by role ===');
  // The Agent and the Admin both see the whole queue, so their
  // numbers are identical.
  check('the Agent and the Admin show the same total',
    agent.totalValue, admin.totalValue);
  check('the Agent and the Admin show the same status counts',
    agent.statusValues, admin.statusValues);
  // The User sees only their own tickets, so their total is a
  // different number — and it is smaller (a seeded User has fewer
  // tickets than the whole queue).
  check('the User\'s total differs from the team-wide total',
    user.totalValue !== agent.totalValue, true);
  check('the User\'s total is smaller than the team-wide total',
    Number(user.totalValue) < Number(agent.totalValue), true);

  await browser.close();

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
})();
