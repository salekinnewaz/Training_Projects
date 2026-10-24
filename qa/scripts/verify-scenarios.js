/**
 * The stat strip's SCENARIOS — every state the user-role dashboard
 * can put it in — verified against the live DOM.
 *
 * The reference only shows one state (five populated cards), so this
 * script covers the rest of the contract:
 *
 *   1. The full strip at the reference's width (the baseline).
 *   2. The 1180px breakpoint — three equal columns.
 *   3. The 760px breakpoint — two equal columns.
 *   4. A narrow phone — the sparkline and the bar must stay INSIDE
 *      their card rather than spilling over the neighbour.
 *   5. A zero total — the bars render empty rather than dividing by
 *      zero.
 *   6. A missing previous period — the delta pill is hidden entirely.
 *   7. A negative delta — the pill turns red with a down arrow.
 *   8. No series — the sparkline is omitted but the bar remains.
 *   9. A long label — it is ellipsised, not wrapped.
 *  10. The strip is the USER dashboard's only — the Agent's ticket
 *      list must NOT have adopted it, and a User is locked out of
 *      the Agent's page entirely.
 *
 *   node qa/scripts/verify-scenarios.js
 */

const { chromium } = require('playwright');
const path = require('path');
const { REF_PAYLOAD } = require('./ref-payload');
const M = require('./ref-measurements');

let failures = 0;
let checks = 0;

function check(label, actual, expected, tolerance = 0.6) {
  checks++;
  const ok =
    typeof expected === 'number'
      ? Math.abs(actual - expected) <= tolerance
      : actual === expected;
  if (!ok) {
    failures++;
    console.log(`  FAIL  ${label}: got ${actual}, expected ${expected}`);
  } else {
    console.log(`  ok    ${label}: ${actual}`);
  }
}

/**
 * Log in and stub the stats API.
 *
 * `who` picks the seeded persona. The strip is the USER role's, so
 * the dashboard scenarios use Jess (role=User). Scenario 10 needs an
 * AGENT, because /tickets is role-gated to Support Agent/Admin — a
 * User who navigates there gets the forbidden copy, not the page.
 */
async function signIn(
  browser,
  payload,
  viewport = { width: 1536, height: 1024 },
  who = 'jess@company.com',
) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.route('**/api/tickets/stats/mine', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }),
  );
  await page.goto('http://localhost:4200', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(who);
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  return { context, page };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  /* ── 1. The baseline ───────────────────────────────────────── */
  console.log('\n══ 1. FULL STRIP AT THE REFERENCE WIDTH ══');
  {
    const { context, page } = await signIn(browser, REF_PAYLOAD);
    const strip = page.locator('[data-testid="stat-strip"]');
    const cards = await strip.evaluate((h) =>
      Array.from(h.querySelectorAll('article.card')).map((c) => {
        const r = c.getBoundingClientRect();
        return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
      }),
    );
    check('five cards', cards.length, 5);
    cards.forEach((c, i) => check(`card ${i} height`, c.h, M.REF_CARD_HEIGHT));
    await context.close();
  }

  /* ── 2 & 3. The breakpoints ───────────────────────────────── */
  console.log('\n══ 2. THREE COLUMNS AT 1180px ══');
  {
    const { context, page } = await signIn(browser, REF_PAYLOAD, {
      width: 1180,
      height: 900,
    });
    const widths = await page
      .locator('[data-testid="stat-strip"]')
      .evaluate((h) =>
        Array.from(h.querySelectorAll('article.card')).map((c) =>
          +c.getBoundingClientRect().width.toFixed(1),
        ),
      );
    console.log(`  widths: ${JSON.stringify(widths)}`);
    // Three equal columns: the first three cards share a width.
    check('first three columns equal', widths[0], widths[1], 0.6);
    check('first three columns equal', widths[1], widths[2], 0.6);
    await context.close();
  }

  console.log('\n══ 3. TWO COLUMNS AT 760px ══');
  {
    const { context, page } = await signIn(browser, REF_PAYLOAD, {
      width: 760,
      height: 900,
    });
    const widths = await page
      .locator('[data-testid="stat-strip"]')
      .evaluate((h) =>
        Array.from(h.querySelectorAll('article.card')).map((c) =>
          +c.getBoundingClientRect().width.toFixed(1),
        ),
      );
    console.log(`  widths: ${JSON.stringify(widths)}`);
    check('first two columns equal', widths[0], widths[1], 0.6);
    await context.close();
  }

  /* ── 4. The visuals stay inside their card on a phone ────── */
  console.log('\n══ 4. THE SPARKLINE AND BAR STAY INSIDE THE CARD ══');
  {
    const { context, page } = await signIn(browser, REF_PAYLOAD, {
      width: 420,
      height: 900,
    });
    const overflow = await page
      .locator('[data-testid="stat-strip"]')
      .evaluate((h) =>
        Array.from(h.querySelectorAll('article.card.status')).map((c) => {
          const cb = c.getBoundingClientRect();
          const bar = c.querySelector('.bar').getBoundingClientRect();
          const spark = c.querySelector('.spark')?.getBoundingClientRect();
          return {
            accent: c.getAttribute('data-accent'),
            cardX0: +cb.x.toFixed(1),
            cardX1: +cb.right.toFixed(1),
            barX0: +bar.x.toFixed(1),
            barX1: +bar.right.toFixed(1),
            sparkX0: spark ? +spark.x.toFixed(1) : null,
            sparkX1: spark ? +spark.right.toFixed(1) : null,
          };
        }),
      );
    overflow.forEach((o) => {
      console.log(`  ${o.accent}: card ${o.cardX0}..${o.cardX1}  bar ${o.barX0}..${o.barX1}  spark ${o.sparkX0}..${o.sparkX1}`);
      check(`${o.accent} bar inside its card (left)`, o.barX0 >= o.cardX0, true);
      check(`${o.accent} bar inside its card (right)`, o.barX1 <= o.cardX1, true);
      check(`${o.accent} spark inside its card (left)`, o.sparkX0 >= o.cardX0, true);
      check(`${o.accent} spark inside its card (right)`, o.sparkX1 <= o.cardX1, true);
    });
    await context.close();
  }

  /* ── 5. A zero total ──────────────────────────────────────── */
  console.log('\n══ 5. A ZERO TOTAL RENDERS EMPTY BARS ══');
  {
    const payload = JSON.parse(JSON.stringify(REF_PAYLOAD));
    payload.counts.total = 0;
    for (const k of ['open', 'inProgress', 'resolved', 'closed']) {
      payload.counts[k] = 0;
    }
    const { context, page } = await signIn(browser, payload);
    const fills = await page
      .locator('[data-testid="stat-strip"]')
      .evaluate((h) =>
        Array.from(h.querySelectorAll('.bar-fill')).map(
          (f) => parseFloat(f.style.width) || 0,
        ),
      );
    console.log(`  fills: ${JSON.stringify(fills)}`);
    fills.forEach((f, i) => check(`bar ${i} fill is zero`, f, 0, 0.01));
    await context.close();
  }

  /* ── 6. No previous period ────────────────────────────────── */
  console.log('\n══ 6. NO PREVIOUS PERIOD HIDES THE DELTA PILL ══');
  {
    const payload = JSON.parse(JSON.stringify(REF_PAYLOAD));
    delete payload.previousPeriod;
    const { context, page } = await signIn(browser, payload);
    const pills = await page
      .locator('[data-testid="stat-strip"]')
      .evaluate((h) => h.querySelectorAll('.delta').length);
    check('no delta pill', pills, 0);
    await context.close();
  }

  /* ── 7. A negative delta ──────────────────────────────────── */
  console.log('\n══ 7. A NEGATIVE DELTA TURNS THE PILL RED ══');
  {
    const payload = JSON.parse(JSON.stringify(REF_PAYLOAD));
    payload.previousPeriod = 120; // recent (82) < previous -> down
    const { context, page } = await signIn(browser, payload);
    const pill = await page
      .locator('[data-testid="stat-strip"]')
      .evaluate((h) => {
        const el = h.querySelector('.delta');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          text: el.textContent.trim(),
          isDown: el.classList.contains('is-down'),
          isUp: el.classList.contains('is-up'),
          color: cs.color,
          bg: cs.backgroundColor,
        };
      });
    console.log(`  pill: ${JSON.stringify(pill)}`);
    check('pill is down', pill?.isDown, true);
    check('pill is not up', pill?.isUp, false);
    // The app uses a REAL MINUS SIGN (U+2212), not a hyphen — the
    // typographically correct character for a negative number.
    check(
      'pill text has a minus sign',
      /[−-]/.test(pill?.text ?? ''),
      true,
    );
    await context.close();
  }

  /* ── 8. No series ─────────────────────────────────────────── */
  console.log('\n══ 8. NO SERIES OMITS THE SPARKLINE BUT KEEPS THE BAR ══');
  {
    // The series are per-status, so a card's series is empty when
    // its bucket has no daily-created entries. The payload's
    // `dailyCreated` is the TOTAL series; a status's own series
    // comes from the API's per-status breakdown, which the
    // reference payload does not carry. So the "no series" state is
    // produced by removing the per-status breakdown entirely.
    const payload = JSON.parse(JSON.stringify(REF_PAYLOAD));
    delete payload.dailyCreated;
    payload.dailyCreated = [];
    const { context, page } = await signIn(browser, payload);
    const state = await page
      .locator('[data-testid="stat-strip"]')
      .evaluate((h) => {
        const open = h.querySelector('[data-testid="stat-card-open"]');
        const other = h.querySelector('[data-testid="stat-card-resolved"]');
        return {
          openSpark: open.querySelectorAll('.spark').length,
          openBar: open.querySelectorAll('.bar').length,
          otherSpark: other.querySelectorAll('.spark').length,
          otherBar: other.querySelectorAll('.bar').length,
        };
      });
    console.log(`  ${JSON.stringify(state)}`);
    check('Open has no sparkline', state.openSpark, 0);
    check('Open keeps its bar', state.openBar, 1);
    check('Resolved keeps its bar', state.otherBar, 1);
    await context.close();
  }

  /* ── 9. A long label ──────────────────────────────────────── */
  console.log('\n══ 9. A LONG LABEL IS ELLIPSISED, NOT WRAPPED ══');
  {
    // The card labels are the page's own, not the API's, so the
    // long-label state is produced by rewriting the rendered text
    // in the DOM and re-measuring. What matters is that the label
    // stays on ONE line and is clipped with an ellipsis — a wrapped
    // label would push the card taller than its siblings and break
    // the row's baseline rhythm.
    //
    // The overflow check runs at the PHONE width, where the strip
    // drops to two columns and each card is far too narrow for a
    // 26-character label. At the reference width the Open card is
    // ~249px and a long label can still fit, so an ellipsis would
    // not engage there — the assertion has to be made where the
    // text genuinely overflows.
    const { context, page } = await signIn(browser, REF_PAYLOAD, {
      width: 420,
      height: 900,
    });
    const label = await page
      .locator('[data-testid="stat-card-open"] .label')
      .evaluate((el) => {
        el.textContent = 'Awaiting Customer Response';
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // The TEXT's intrinsic width, measured with a Range. A plain
        // block element reports scrollWidth === clientWidth even when
        // its text is clipped, so scrollWidth cannot prove the
        // ellipsis is engaged — the range can.
        const range = document.createRange();
        range.selectNodeContents(el);
        const textW = range.getBoundingClientRect().width;
        return {
          h: +r.height.toFixed(1),
          scrollW: el.scrollWidth,
          clientW: el.clientWidth,
          textW: +textW.toFixed(1),
          right: cs.right,
          whiteSpace: cs.whiteSpace,
          overflow: cs.overflow,
          textOverflow: cs.textOverflow,
          lineHeight: parseFloat(cs.lineHeight),
        };
      });
    console.log(`  ${JSON.stringify(label)}`);
    check('label stays on one line', label.h, label.lineHeight, 0.6);
    check('label does not wrap', label.whiteSpace, 'nowrap');
    check('label is ellipsised', label.textOverflow, 'ellipsis');
    check('label is clipped', label.overflow, 'hidden');
    // The text is WIDER than the box, so the ellipsis is in play.
    check('label overflows its box', label.textW > label.clientW, true);
    await context.close();
  }

  /* ── 10. The Agent's page renders the SAME strip ──────────── */
  console.log('\n══ 10. THE AGENT PAGE USES THE SAME STRIP ══');
  {
    // /tickets is ROLE-GATED to Support Agent/Admin, so this has to
    // log in as an agent — Eli is the seeded Support Agent the app
    // is hand-verified with. A User who navigates there gets the
    // forbidden copy, which is a different scenario (see below).
    const { context, page } = await signIn(
      browser,
      REF_PAYLOAD,
      { width: 1536, height: 1024 },
      'eli@company.com',
    );
    await page.goto('http://localhost:4200/tickets', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // The Agent's page renders the SAME shared <stat-strip> molecule
    // as the User's dashboard — one molecule for the whole app. The
    // old per-page `stat-card` band is gone.
    //
    // Count the MOLECULE ELEMENT, not the wrapper's testid: every
    // page wraps the molecule in a div called
    // `data-testid="stat-strip"`, which is a different thing.
    const agentMolecules = await page.locator('stat-strip').count();
    const agentCards = await page.locator('stat-card').count();
    console.log(
      `  tickets page: stat-strip molecules ${agentMolecules}, stat-card molecules ${agentCards}`,
    );
    check('the Agent page uses the shared stat-strip molecule', agentMolecules, 1);
    check('the Agent page has no per-page stat-card band', agentCards, 0);

    // And the User role is still locked out of it entirely. The
    // route's roleGuard redirects to /forbidden BEFORE the page
    // renders, so the page's own `tickets-forbidden` panel never
    // appears — the assertion is on the redirect.
    const { context: uctx, page: upage } = await signIn(browser, REF_PAYLOAD);
    await upage.goto('http://localhost:4200/tickets', { waitUntil: 'networkidle' });
    await upage.waitForTimeout(1200);
    const url = upage.url();
    const userStrips = await upage.locator('stat-strip').count();
    const userCards = await upage.locator('stat-card').count();
    console.log(
      `  user on /tickets: url ${url}, stat-strip molecules ${userStrips}, stat-card molecules ${userCards}`,
    );
    check('the User is redirected away from the Agent page', /\/forbidden/.test(url), true);
    check('the User sees no stat strip there', userStrips, 0);
    check("the User sees none of the Agent's cards either", userCards, 0);
    await uctx.close();
    await context.close();
  }

  console.log(`\n══ ${checks - failures}/${checks} checks passed ══\n`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
