/**
 * Compare the LOCAL render's stat-strip tile geometry with the
 * REFERENCE's measured geometry, card-relative.
 *
 * The reference's tiles are 52x52 rounded squares. Their position
 * inside the card is what this checks.
 *
 *   node qa/scripts/compare-tile-geometry.js
 */

const { chromium } = require('playwright');
const path = require('path');
const M = require('./ref-measurements');

const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'local-view');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 1024 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.route('**/api/tickets/stats/mine', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        counts: {
          total: 156,
          open: 42,
          inProgress: 28,
          resolved: 62,
          closed: 24,
        },
        dailyCreated: new Array(60).fill(1),
        previousPeriod: 73,
      }),
    }),
  );

  await page.goto('http://localhost:4200', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill('jess@company.com');
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const strip = page.locator('[data-testid="stat-strip"]');
  await strip.screenshot({ path: path.join(OUT_DIR, 'tile-geometry.png') });

  const m = await strip.evaluate((host) => {
    const rel = (el, card) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const cb = card.getBoundingClientRect();
      return {
        x: +(b.x - cb.x).toFixed(1),
        y: +(b.y - cb.y).toFixed(1),
        w: +b.width.toFixed(1),
        h: +b.height.toFixed(1),
      };
    };
    const cards = Array.from(host.querySelectorAll('article.card'));
    const total = host.querySelector('[data-testid="stat-total-card"]');
    const statuses = cards.filter((c) => c.classList.contains('status'));
    return {
      total: {
        card: rel(total, host),
        tile: rel(total?.querySelector('.tile'), total),
        label: rel(total?.querySelector('.label'), total),
        value: rel(total?.querySelector('.value'), total),
      },
      statuses: statuses.map((c) => ({
        accent: c.getAttribute('data-accent'),
        card: rel(c, host),
        tile: rel(c.querySelector('.tile'), c),
        label: rel(c.querySelector('.label'), c),
        value: rel(c.querySelector('.value'), c),
        spark: rel(c.querySelector('.spark'), c),
        bar: rel(c.querySelector('.bar'), c),
      })),
    };
  });

  console.log('── LOCAL (card-relative) ──');
  console.log('total card', JSON.stringify(m.total.card));
  console.log('  tile ', JSON.stringify(m.total.tile));
  console.log('  label', JSON.stringify(m.total.label));
  console.log('  value', JSON.stringify(m.total.value));
  for (const s of m.statuses) {
    console.log(`${s.accent} card w ${s.card.w}`);
    console.log('  tile ', JSON.stringify(s.tile));
    console.log('  label', JSON.stringify(s.label));
    console.log('  value', JSON.stringify(s.value));
    console.log('  spark', JSON.stringify(s.spark));
    console.log('  bar  ', JSON.stringify(s.bar));
  }

  console.log('\n── REFERENCE (card-relative) ──');
  console.log(`  tile   x ${M.REF_GEOMETRY.tile.x}  y ${M.REF_GEOMETRY.tile.y}  ${M.REF_GEOMETRY.tile.width}x${M.REF_GEOMETRY.tile.height}`);
  console.log(`  label  x ${M.REF_GEOMETRY.label.x}`);
  console.log(`  value  x ${M.REF_GEOMETRY.value.x}`);
  console.log(`  spark  ${M.REF_GEOMETRY.spark.width}x${M.REF_GEOMETRY.spark.height}`);
  console.log(`  bar    ${M.REF_GEOMETRY.bar.width}x${M.REF_GEOMETRY.bar.height}`);

  await browser.close();
})();
