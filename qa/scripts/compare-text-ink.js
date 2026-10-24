/**
 * Compare the INK of the reference's stat strip against the local
 * render's, card by card.
 *
 * Both images are scanned independently for their card bands, so
 * the two are compared in their own coordinates — no mapping
 * between the reference's pixel space and the local render's is
 * needed, and neither image's origin has to be known.
 *
 * For each card the label's and the value's glyph ink is measured
 * (its box, its height and its per-digit widths) and compared with
 * the reference's. The comparison is what SOLVED the reference's
 * type sizes:
 *
 *   - the value's ten digit widths ("156" -> 9, 14, 14, etc.) pin
 *     the face at 26px, and
 *   - the label's 11px cap height pins it at 14px.
 *
 * The reference's mockup places each card's text at a DIFFERENT x
 * (card+91, 82, 83, 85, 95 — the same "2" appears at two of
 * those), so the x positions are reported but not asserted; the
 * vertical ink and the ink widths are what carry the design
 * information.
 *
 *   node qa/scripts/compare-text-ink.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { PNG } = require('pngjs');
const M = require('./ref-measurements');

const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'local-view');

/** A pixel is "ink" if it is meaningfully darker than the card. */
const isInk = (p) => p[0] < 200 || p[1] < 200 || p[2] < 200;

/**
 * Find a PNG's card bands: maximal runs of near-white pixels in a
 * row through the cards' middle.
 *
 * The card background is #FEFEFE and the page behind the strip is
 * lavender (#F0F3FD). Near-white is detected as "all channels at
 * least 248", which the lavender fails on its blue channel.
 */
function findBands(png, y) {
  const bands = [];
  let start = null;
  for (let x = 0; x < png.width; x++) {
    const i = (y * png.width + x) * 4;
    const white =
      png.data[i] >= 248 && png.data[i + 1] >= 248 && png.data[i + 2] >= 248;
    if (white && start === null) start = x;
    if (!white && start !== null) {
      if (x - start > 40) bands.push({ x0: start, x1: x - 1 });
      start = null;
    }
  }
  if (start !== null && png.width - start > 40) {
    bands.push({ x0: start, x1: png.width - 1 });
  }
  return bands;
}

/**
 * The ink box of a region, in card-relative CSS pixels, plus the
 * widths of the individual glyph runs along its top row.
 *
 * `xLo`/`xHi` and `yLo`/`yHi` are CARD-RELATIVE. `band.y0` is the
 * image's y origin for the card's top edge, so the scan is offset
 * by it and the result is offset back off.
 */
function inkBox(png, band, scale, xLo, xHi, yLo, yHi) {
  const px0 = band.x0 + Math.round(xLo * scale);
  const px1 = band.x0 + Math.round(xHi * scale);
  const py0 = band.y0 + Math.round(yLo * scale);
  const py1 = band.y0 + Math.round(yHi * scale);

  let x0 = null;
  let x1 = null;
  for (let x = px0; x <= px1; x++) {
    for (let y = py0; y <= py1; y++) {
      const i = (y * png.width + x) * 4;
      if (!isInk([png.data[i], png.data[i + 1], png.data[i + 2]])) continue;
      if (x0 === null) x0 = x;
      x1 = x;
      break;
    }
  }
  let top = null;
  let bottom = null;
  for (let y = py0; y <= py1; y++) {
    let n = 0;
    for (let x = px0; x <= px1; x++) {
      const i = (y * png.width + x) * 4;
      if (isInk([png.data[i], png.data[i + 1], png.data[i + 2]])) n++;
    }
    if (n) {
      if (top === null) top = y;
      bottom = y;
    }
  }

  // The per-column ink profile, split into glyph runs.
  const runs = [];
  let start = null;
  for (let x = px0; x <= px1; x++) {
    let n = 0;
    for (let y = py0; y <= py1; y++) {
      const i = (y * png.width + x) * 4;
      if (isInk([png.data[i], png.data[i + 1], png.data[i + 2]])) n++;
    }
    if (n > 0 && start === null) start = x;
    if (n === 0 && start !== null) {
      runs.push(+((x - start) / scale).toFixed(1));
      start = null;
    }
  }

  return {
    x0: x0 === null ? null : +((x0 - band.x0) / scale).toFixed(1),
    x1: x1 === null ? null : +((x1 - band.x0) / scale).toFixed(1),
    width: x0 === null ? null : +((x1 - x0 + 1) / scale).toFixed(1),
    top: top === null ? null : +((top - band.y0) / scale).toFixed(1),
    bottom: bottom === null ? null : +((bottom - band.y0) / scale).toFixed(1),
    height: top === null ? null : +((bottom - top + 1) / scale).toFixed(1),
    runs,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 1024 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.route('**/api/tickets/stats/mine', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(require('./ref-payload').REF_PAYLOAD),
    }),
  );

  await page.goto('http://localhost:4200', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill('jess@company.com');
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const strip = page.locator('[data-testid="stat-strip"]');
  const localFile = path.join(OUT_DIR, 'ink-local.png');
  await strip.screenshot({ path: localFile });

  const local = PNG.sync.read(fs.readFileSync(localFile));
  const scale = 1; // this screenshot is 1x, like the reference

  // The local screenshot is of the strip ELEMENT, so its y=0 is the
  // strip's top. Scan near the top of the strip (where the cards'
  // rounded corners are widest and there is no text) — the same
  // trick the reference's REF_SCAN_ROW uses.
  const bands = findBands(local, 13);
  console.log(
    `local PNG ${local.width}x${local.height} — card bands at ${bands
      .map((b) => b.x0)
      .join(', ')}`,
  );

  const ref = M.readRef();
  const NAMES = ['total', 'open', 'inProgress', 'resolved', 'closed'];

  let failures = 0;

  for (let i = 0; i < NAMES.length; i++) {
    const name = NAMES[i];
    const lb = bands[i];
    const rb = M.REF_CARD_BANDS[i];
    if (!lb) {
      console.log(`\n══ ${name}: no local band ══`);
      failures++;
      continue;
    }

    // The local band's x0 is the card's INNER edge (the 1px border
    // is outside it), so the card's true left edge is 1px to its
    // left. The reference's bands already include their borders.
    const localBand = { x0: lb.x0 - 1, x1: lb.x1 + 1, y0: 0 };
    const refBand = { x0: rb.x0, x1: rb.x1, y0: M.REF_STRIP_TOP };

    // The label: rows card+18..40, columns card+74..170 (short of
    // the sparkline, which starts at card+176).
    const lLabel = inkBox(local, localBand, scale, 74, 170, 18, 40);
    const rLabel = inkBox(ref, refBand, 1, 74, 170, 18, 40);

    // The value's box: rows card+42..70, columns card+74..135.
    //
    // The box's BOTTOM is the digit baseline and its TOP is the
    // digit cap, so the full row range is needed. The progress bar
    // (card+124..230, rows card+59..67) overlaps this window, so
    // the DIGIT RUNS are read separately from rows card+42..58,
    // where the bar cannot reach.
    const lValue = inkBox(local, localBand, scale, 74, 135, 42, 70);
    const rValue = inkBox(ref, refBand, 1, 74, 135, 42, 70);
    const lDigits = inkBox(local, localBand, scale, 74, 135, 42, 58);
    const rDigits = inkBox(ref, refBand, 1, 74, 135, 42, 58);

    console.log(`\n══ ${name} ══`);
    console.log(
      `  label  local  x ${lLabel.x0}..${lLabel.x1} (w ${lLabel.width})  y ${lLabel.top}..${lLabel.bottom} (h ${lLabel.height})`,
    );
    console.log(
      `         ref    x ${rLabel.x0}..${rLabel.x1} (w ${rLabel.width})  y ${rLabel.top}..${rLabel.bottom} (h ${rLabel.height})`,
    );
    console.log(
      `  value  local  x ${lValue.x0}..${lValue.x1} (w ${lValue.width})  y ${lValue.top}..${lValue.bottom} (h ${lValue.height})  digits [${lDigits.runs.slice(0, 3).join(', ')}]`,
    );
    console.log(
      `         ref    x ${rValue.x0}..${rValue.x1} (w ${rValue.width})  y ${rValue.top}..${rValue.bottom} (h ${rValue.height})  digits [${rDigits.runs.slice(0, 3).join(', ')}]`,
    );

    // The vertical ink and the ink heights must match.
    const refLabelInk = M.REF_LABEL_INK[name];
    const refValueInk = M.REF_VALUE_INK[name];
    for (const [what, got, want] of [
      ['label top', lLabel.top, refLabelInk.y0],
      ['label height', lLabel.height, refLabelInk.height],
      ['value top', lValue.top, refValueInk.y0],
      ['value height', lValue.height, refValueInk.height],
    ]) {
      const ok = Math.abs(got - want) <= 1;
      if (!ok) {
        failures++;
        console.log(`  FAIL  ${name} ${what}: got ${got}, expected ${want}`);
      }
    }
  }

  console.log(
    `\n══ ${failures === 0 ? 'ALL MATCH' : failures + ' MISMATCHES'} ══\n`,
  );
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
