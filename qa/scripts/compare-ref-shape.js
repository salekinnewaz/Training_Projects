/**
 * Render the stat strip against a REFERENCE-LIKE payload — the same
 * counts and a smooth rising daily series the WDS-2026 mockup
 * shows — so the rendering can be compared to the reference image
 * shape-for-shape, independent of whatever the dev DB happens to
 * hold.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { REF_PAYLOAD } = require('./ref-payload');

const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'local-view');
fs.mkdirSync(OUT_DIR, { recursive: true });

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
      body: JSON.stringify(REF_PAYLOAD),
    }),
  );

  await page.goto('http://localhost:4200', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill('jess@company.com');
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const strip = page.locator('[data-testid="stat-strip"]');
  await strip.screenshot({ path: path.join(OUT_DIR, 'refshape-mine.png') });
  console.log('📸 refshape-mine.png');

  const geo = await strip.evaluate((host) => {
    const w = (el) => (el ? Math.round(el.getBoundingClientRect().width) : 0);
    return Array.from(host.querySelectorAll('article.card')).map((card) => ({
      label: (card.querySelector('.label')?.textContent || '').trim(),
      cardW: w(card),
      cardH: Math.round(card.getBoundingClientRect().height),
      tileW: w(card.querySelector('.tile')),
      labelW: w(card.querySelector('.label')),
      valueW: w(card.querySelector('.value')),
      sparkW: w(card.querySelector('.spark')),
      barW: w(card.querySelector('.bar')),
      delta: (card.querySelector('.delta')?.textContent || '').trim(),
      caption: (card.querySelector('.caption')?.textContent || '').trim(),
    }));
  });
  console.log('\n  ── geometry ──');
  for (const g of geo) {
    console.log(
      `  ${g.label.padEnd(13)} card=${g.cardW}x${g.cardH} tile=${g.tileW} ` +
        `label=${g.labelW} value=${g.valueW} spark=${g.sparkW} bar=${g.barW} ` +
        `delta=${JSON.stringify(g.delta)} caption=${JSON.stringify(g.caption)}`,
    );
  }

  await browser.close();
})();
