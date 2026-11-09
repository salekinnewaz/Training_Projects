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
 * TWO THINGS DIFFER PER ROLE, AND BOTH ARE BY DESIGN:
 *
 *   1. The VARIANT. The User's and the Agent's strips use the
 *      HD-021 "columns" layout (label above the number, a
 *      share-of-total bar under the sparkline); the Admin's
 *      Workspace uses the "stacked" layout the WDS-2026 reference
 *      draws (the number above the label, no bar — the reference's
 *      status cards show a trend curve, not a share-of-total
 *      track). Both are the SAME molecule with a CSS switch on
 *      `data-variant` — the Admin's page never forks it.
 *
 *   2. The DATA SCOPE, which is not just "whose tickets":
 *
 *        User    GET /api/tickets/stats/mine    own tickets
 *        Agent   GET /api/tickets/stats        EVERY ticket, ever
 *        Admin   GET /api/admin/workspace      the TRAILING 30 DAYS
 *
 *      So the Admin's numbers are legitimately SMALLER than the
 *      Agent's: the Workspace reports on the last thirty days (the
 *      window its own "vs last month" badge compares against),
 *      while the Agent's strip counts the whole queue.
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
  {
    label: 'User',
    email: 'jess@company.com',
    path: '/dashboard',
    variant: 'columns',
    cardHeight: 88,
    hasBar: true,
  },
  {
    label: 'Support Agent',
    email: 'eli@company.com',
    path: '/tickets',
    variant: 'columns',
    cardHeight: 88,
    hasBar: true,
  },
  {
    label: 'Admin',
    email: 'admin@company.com',
    path: '/admin',
    variant: 'stacked',
    // The WDS-2026 Admin Workspace reference (the supplied
    // 1536×1024 image — HANDSOFF Iteration 17) draws the strip card
    // at y=198..285 — 87px tall. It replaced the earlier 90px
    // reference when the Admin hero and grid were rebuilt.
    cardHeight: 87,
    hasBar: false,
  },
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
  await page.waitForSelector(STRIP_SELECTOR, { timeout: 20_000 });
  await page.waitForTimeout(500);
}

/**
 * The strip's wrapper.
 *
 * The User's dashboard and the Agent's ticket list wrap the shared
 * molecule in a `data-testid="stat-strip"` div; the Admin's
 * Workspace wraps it in a `data-testid="admin-stat-strip"` div of
 * its own. The MOLECULE is the same in all three cases — only the
 * wrapper's test id differs, so the gate looks for either.
 */
const STRIP_SELECTOR =
  '[data-testid="stat-strip"], [data-testid="admin-stat-strip"]';

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
  return page.evaluate((selector) => {
    const strip = document.querySelector(selector);
    if (!strip) return { present: false };

    const total = strip.querySelector('[data-testid="stat-total-card"]');
    const statusCards = Array.from(
      strip.querySelectorAll('[data-testid^="stat-card-"]'),
    );
    const cards = total ? [total, ...statusCards] : statusCards;

    // The VARIANT is the one thing that legitimately differs between
    // the roles: the Admin's Workspace reference is the "stacked"
    // layout (number above label), the other two are the HD-021
    // "columns" layout. It is a CSS switch inside the SAME
    // molecule, not a fork.
    const molecule = strip.querySelector('stat-strip');
    const variant = molecule?.getAttribute('data-variant') ?? null;

    return {
      present: true,
      isMolecule: !!molecule,
      variant,
      cardCount: cards.length,
      totalLabel: total?.querySelector('.label')?.textContent?.trim(),
      totalValue: total?.querySelector('.value')?.textContent?.trim(),
      caption: total?.querySelector('.caption')?.textContent?.trim(),
      hasDeltaPill: !!total?.querySelector('.delta'),
      statusLabels: statusCards.map((c) => c.querySelector('.label')?.textContent?.trim()),
      statusValues: statusCards.map((c) => c.querySelector('.value')?.textContent?.trim()),
      accents: statusCards.map((c) => c.getAttribute('data-accent')),
      sparkCount: statusCards.filter((c) => !!c.querySelector('.spark svg')).length,
      barCount: statusCards.filter(
        (c) =>
          !!c.querySelector('.bar .bar-fill') &&
          getComputedStyle(c.querySelector('.bar')).display !== 'none',
      ).length,
      cardHeights: cards.map((c) => Math.round(c.getBoundingClientRect().height)),
      cardWidths: cards.map((c) => Math.round(c.getBoundingClientRect().width)),
      // The reference's tiles are tinted squares; a different
      // implementation would not carry this class.
      hasTiles: !!strip.querySelector('.tile'),
      // A clipped label is one whose ink is wider than its box —
      // the "In Progress" regression.
      clippedLabels: cards
        .map((c) => c.querySelector('.label'))
        .filter(
          (l) => l && l.scrollWidth > Math.ceil(l.getBoundingClientRect().width) + 0.5,
        )
        .map((l) => l.textContent?.trim()),
    };
  }, STRIP_SELECTOR);
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
    check('it renders the expected variant', r.variant, p.variant);
    check('it has five cards (Total + four statuses)', r.cardCount, 5);
    check('the summary card is labelled "Total Tickets"', r.totalLabel, 'Total Tickets');
    check('the status labels are Open / In Progress / Resolved / Closed',
      r.statusLabels,
      ['Open', 'In Progress', 'Resolved', 'Closed']);
    check('the accents are open / inProgress / resolved / closed',
      r.accents,
      ['open', 'inProgress', 'resolved', 'closed']);
    check('every status card carries a sparkline', r.sparkCount, 4);
    check(
      p.hasBar
        ? 'every status card carries a progress bar'
        : 'no status card carries a progress bar (the reference has none)',
      r.barCount,
      p.hasBar ? 4 : 0,
    );
    check('every card carries a tinted icon tile', r.hasTiles, true);
    check('the caption reads "vs last month"', r.caption, 'vs last month');
    // The reference's cards are 88px tall in the "columns" variant
    // and 90px in the "stacked" one — each reference draws its own
    // card height.
    check(
      `all five cards are ${p.cardHeight}px tall`,
      r.cardHeights,
      [p.cardHeight, p.cardHeight, p.cardHeight, p.cardHeight, p.cardHeight],
    );
    // No label may be clipped — the "In Progress" regression.
    check('no label is clipped', r.clippedLabels, []);
    // The reference's cards are NOT equal width — the Total card is
    // the widest. The ORDER differs between the two references:
    //   HD-021  Total > Open > Resolved > In Progress ... Closed
    //   Admin   Total > Closed ~ Resolved ~ In Progress > Open
    // so the ordering assertion is per-reference.
    const widths = r.cardWidths;
    if (p.variant === 'columns') {
      check('the cards have the reference\'s unequal widths',
        widths[0] > widths[1] && widths[1] > widths[2] && widths[3] > widths[2] && widths[4] > widths[3],
        true);
    } else {
      check('the cards have the reference\'s unequal widths',
        widths[0] > widths[1] && widths[0] > widths[4] && widths[4] > widths[1],
        true);
    }

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
   *
   * The ADMIN's strip is the exception: the Admin Workspace
   * reference lays its five cards out on its OWN measured widths
   * (247 / 213 / 218 / 217 / 218 fr), not on the HD-021 ones. That
   * is a different REFERENCE, not a different molecule — the Admin
   * page still renders the shared <stat-strip>, and the molecule
   * still lays its cards out on a five-column fractional track.
   * What must not vary is the ANATOMY: five cards, four statuses,
   * a sparkline each, a tile each, the same labels and the same
   * accents.
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

  // The User and the Agent render the SAME variant, so their
  // geometry must agree exactly.
  check('the User and the Agent have identical card heights',
    user.cardHeights, agent.cardHeights);
  check('the User and the Agent have identical card widths',
    user.cardWidths, agent.cardWidths);
  check('the User and the Agent have the same card width RATIOS',
    sameRatios(ratios(user.cardWidths), ratios(agent.cardWidths)), true);

  // The Admin renders the OTHER variant, so its card height follows
  // the Admin reference rather than the HD-021 one (88px). The
  // WDS-2026 Admin Workspace reference (the supplied 1536×1024
  // image — HANDSOFF Iteration 17) draws the card at y=198..285,
  // i.e. 87px tall; it replaced the earlier 90px reference when
  // the Admin hero and grid were rebuilt.
  check('the Admin\'s cards are the Admin reference\'s height',
    admin.cardHeights, [87, 87, 87, 87, 87]);
  check('the Admin and the Agent use different variants',
    admin.variant !== agent.variant, true);
  check('the Admin and the Agent share the same card anatomy',
    admin.statusLabels, agent.statusLabels);
  check('the Admin and the Agent share the same accents',
    admin.accents, agent.accents);
  check('the Admin and the Agent share the same sparkline count',
    admin.sparkCount, agent.sparkCount);
  check('the Admin and the Agent share the same tile anatomy',
    admin.hasTiles, agent.hasTiles);

  // ── The data scope differs ──────────────────────────────────
  console.log('\n=== The data scope differs by role ===');
  // The Agent's strip counts EVERY ticket (GET /api/tickets/stats).
  // The Admin's Workspace counts only the TRAILING THIRTY DAYS
  // (GET /api/admin/workspace), because that is the window its own
  // "vs last month" badge compares against. So the Admin's numbers
  // are a SUBSET of the Agent's, not equal to them.
  check('the Agent and the Admin show different totals',
    agent.totalValue !== admin.totalValue, true);
  check('the Admin\'s total is a subset of the Agent\'s',
    Number(admin.totalValue) <= Number(agent.totalValue), true);
  check('the Admin\'s status counts sum to its own total',
    admin.statusValues.reduce((a, b) => a + Number(b), 0),
    Number(admin.totalValue));
  check('the Agent\'s status counts sum to its own total',
    agent.statusValues.reduce((a, b) => a + Number(b), 0),
    Number(agent.totalValue));
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
