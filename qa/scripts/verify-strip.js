/**
 * FINAL VERIFICATION — the user-role stat strip vs the WDS-2026
 * reference (Image #3).
 *
 * Every expected value below was MEASURED off the reference
 * screenshot (qa/scripts/measure-ref-*.js) or off the reference's
 * own pixel colours. This script re-checks all of them against the
 * LIVE DOM in one pass, so a regression anywhere in the strip shows
 * up as a named FAIL rather than a vague visual drift.
 *
 * Scope: the EMPLOYEE (user) dashboard only. The Support Agent's
 * tickets-list page is untouched.
 *
 *   node qa/scripts/verify-strip.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { REF_PAYLOAD } = require('./ref-payload');
const M = require('./ref-measurements');

const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'local-view');
fs.mkdirSync(OUT_DIR, { recursive: true });

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

/** Convert a #RRGGBB token to the rgb() form the DOM reports. */
function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function checkOrder(label, values, order) {
  checks++;
  const ranks = values.map((v) => order.indexOf(v));
  const sorted = [...ranks].sort((a, b) => a - b);
  const ok = sorted.every((v, i) => v === i);
  if (!ok) {
    failures++;
    console.log(`  FAIL  ${label}: got ${JSON.stringify(values)}`);
  } else {
    console.log(`  ok    ${label}: ${JSON.stringify(values)}`);
  }
}

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
  await strip.screenshot({ path: path.join(OUT_DIR, 'verify-strip.png') });

  const m = await strip.evaluate((host) => {
    // Offsets are measured RELATIVE TO THE CARD, not to the strip —
    // the reference's numbers (tile at card+14, spark at
    // card+176..230) are all card-relative.
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
    const cs = (el, prop) => (el ? getComputedStyle(el)[prop] : null);

    const cards = Array.from(host.querySelectorAll('article.card'));
    const total = host.querySelector('[data-testid="stat-total-card"]');
    const statuses = cards.filter((c) => c.classList.contains('status'));

    return {
      hostW: +host.getBoundingClientRect().width.toFixed(1),
      total: {
        rect: rel(total, host),
        tile: rel(total?.querySelector('.tile'), total),
        label: rel(total?.querySelector('.label'), total),
        value: rel(total?.querySelector('.value'), total),
        delta: rel(total?.querySelector('.delta'), total),
        caption: rel(total?.querySelector('.caption'), total),
        deltaColor: cs(total?.querySelector('.delta'), 'color'),
        deltaBg: cs(total?.querySelector('.delta'), 'backgroundColor'),
        captionColor: cs(total?.querySelector('.caption'), 'color'),
        tileBg: cs(total?.querySelector('.tile'), 'backgroundColor'),
        tileColor: cs(total?.querySelector('.tile'), 'color'),
        tileRadius: cs(total?.querySelector('.tile'), 'borderRadius'),
        glyphFill: total?.querySelector('.tile svg path')?.getAttribute('fill'),
        labelText: total?.querySelector('.label')?.textContent?.trim(),
        valueText: total?.querySelector('.value')?.textContent?.trim(),
        deltaText: total?.querySelector('.delta')?.textContent?.trim(),
        captionText: total?.querySelector('.caption')?.textContent?.trim(),
        labelSize: cs(total?.querySelector('.label'), 'fontSize'),
        valueSize: cs(total?.querySelector('.value'), 'fontSize'),
        deltaSize: cs(total?.querySelector('.delta'), 'fontSize'),
        captionSize: cs(total?.querySelector('.caption'), 'fontSize'),
      },
      statuses: statuses.map((c) => {
        const spark = c.querySelector('atom-sparkline');
        const bar = c.querySelector('.bar');
        const fill = c.querySelector('.bar-fill');
        const disc = c.querySelector('.tile svg circle');
        return {
          accent: c.getAttribute('data-accent'),
          rect: rel(c, host),
          tile: rel(c.querySelector('.tile'), c),
          tileBg: cs(c.querySelector('.tile'), 'backgroundColor'),
          tileColor: cs(c.querySelector('.tile'), 'color'),
          discR: disc?.getAttribute('r'),
          discCx: disc?.getAttribute('cx'),
          innerPath: c.querySelector('.tile svg path')?.getAttribute('d') ?? null,
          innerFill: c.querySelector('.tile svg path')?.getAttribute('fill'),
          innerStroke: c.querySelector('.tile svg path')?.getAttribute('stroke'),
          spark: rel(c.querySelector('.spark'), c),
          sparkStroke: spark?.querySelector('path.spark-line')?.getAttribute('stroke'),
          sparkStrokeOpacity: spark?.querySelector('path.spark-line')?.getAttribute('stroke-opacity'),
          sparkStopOpacity: spark?.querySelector('stop')?.getAttribute('stop-opacity'),
          bar: rel(bar, c),
          barBg: cs(bar, 'backgroundColor'),
          // The fill's width is a PERCENTAGE of the track, so read
          // the inline style the component wrote rather than the
          // computed pixel width.
          fillPct: fill ? parseFloat(fill.style.width) : null,
          fillBg: cs(fill, 'backgroundColor'),
          label: c.querySelector('.label')?.textContent?.trim(),
          value: c.querySelector('.value')?.textContent?.trim(),
        };
      }),
    };
  });

  console.log('\n══ TOTAL CARD ══');
  const G = M.REF_GEOMETRY;
  check('card height', m.total.rect.h, M.REF_CARD_HEIGHT);
  check('tile size', m.total.tile.w, G.tile.width);
  check('tile height', m.total.tile.h, G.tile.height);
  check('tile x', m.total.tile.x, G.tile.x);
  check('tile y', m.total.tile.y, G.tile.y);
  check('tile radius', m.total.tileRadius, `${G.tile.radius}px`);
  check('tile bg', m.total.tileBg, toRgb(M.REF_ACCENTS.total.tile));
  check('tile colour', m.total.tileColor, toRgb(M.REF_ACCENTS.total.accent));
  check('glyph fill', m.total.glyphFill, 'currentColor');
  check('label text', m.total.labelText, 'Total Tickets');
  check('value text', m.total.valueText, '156');
  check('label size', m.total.labelSize, `${G.label.size}px`);
  check('value size', m.total.valueSize, `${G.value.size}px`);
  check('label x', m.total.label.x, G.label.x);
  check('value x', m.total.value.x, G.value.x);
  check('delta text', m.total.deltaText, M.REF_DELTA.text);
  check('delta colour', m.total.deltaColor, toRgb(M.REF_DELTA.color));
  check('delta bg', m.total.deltaBg, toRgb(M.REF_DELTA.background));
  check('delta size', m.total.deltaSize, '15px');
  check('caption text', m.total.captionText, 'vs last month');
  check('caption size', m.total.captionSize, `${G.caption.size}px`);
  check('caption colour', m.total.captionColor, toRgb(G.caption.color));

  console.log('\n══ STATUS CARDS ══');
  const expectedAccents = ['open', 'inProgress', 'resolved', 'closed'];
  checkOrder(
    'card order',
    m.statuses.map((s) => s.accent),
    expectedAccents,
  );

  // The sparkline's stroke is declared as a CSS custom property with
  // a hex fallback, so the RENDERED attribute carries the token
  // string (not a resolved rgb). The disc/tile colours are plain
  // colours and resolve to rgb().
  const SPARK_TOKEN = {
    open: '--stat-spark-open',
    inProgress: '--stat-spark-in-progress',
    resolved: '--stat-spark-resolved',
    closed: '--stat-spark-closed',
  };
  const sparkStrokes = Object.fromEntries(
    Object.entries(SPARK_TOKEN).map(([k, tok]) => [
      k,
      `var(${tok}, ${M.REF_SPARK_COLORS[k]})`,
    ]),
  );

  for (const s of m.statuses) {
    check(`${s.accent} card height`, s.rect.h, M.REF_CARD_HEIGHT);
    check(`${s.accent} tile size`, s.tile.w, G.tile.width);
    check(`${s.accent} tile x`, s.tile.x, G.tile.x);
    check(`${s.accent} disc radius`, s.discR, '12.5');
    check(`${s.accent} disc cx`, s.discCx, '15');
    check(`${s.accent} tile bg`, s.tileBg, toRgb(M.REF_ACCENTS[s.accent].tile));
    check(
      `${s.accent} accent colour`,
      s.tileColor,
      toRgb(M.REF_ACCENTS[s.accent].accent),
    );
    check(`${s.accent} spark width`, s.spark.w, G.spark.width);
    check(`${s.accent} spark height`, s.spark.h, G.spark.height);
    check(`${s.accent} spark stroke`, s.sparkStroke, sparkStrokes[s.accent]);
    check(
      `${s.accent} stroke opacity`,
      s.sparkStrokeOpacity,
      String(M.REF_STROKE_OPACITY),
    );
    check(
      `${s.accent} fill opacity`,
      s.sparkStopOpacity,
      String(M.REF_FILL_OPACITY),
    );
    // The bar's LEFT edge is anchored, not its width: it starts a
    // fixed distance right of the card's value column (47-53px in
    // the reference) and its RIGHT edge is anchored 18px inside the
    // card's border. The width therefore falls out of the card's
    // width — 101, 92, 109 and 132 on the reference's own cards.
    check(`${s.accent} bar height`, s.bar.h, G.bar.height);
    check(
      `${s.accent} bar left edge`,
      s.bar.x,
      G.bar.leftInset,
      1.2,
    );
    check(
      `${s.accent} bar right edge`,
      s.bar.x + s.bar.w,
      s.rect.w - G.bar.rightInset,
      1.2,
    );
    check(
      `${s.accent} spark right edge`,
      s.spark.x + s.spark.w,
      s.rect.w - G.spark.rightInset,
      1.2,
    );
    // The sparkline's BOX is 4px further right than the bar's track:
    // the reference's bar track ends at inset 17-18 while the
    // sparkline's 54px box is inset 14. Their INK is flush, which is
    // why the two were first modelled as sharing an edge.
    check(
      `${s.accent} spark box sits 4px right of the bar`,
      +(s.spark.x + s.spark.w - (s.bar.x + s.bar.w)).toFixed(1),
      4,
      0.6,
    );
  }

  console.log('\n══ GLYPHS ══');
  const open = m.statuses.find((s) => s.accent === 'open');
  const inProgress = m.statuses.find((s) => s.accent === 'inProgress');
  const resolved = m.statuses.find((s) => s.accent === 'resolved');
  const closed = m.statuses.find((s) => s.accent === 'closed');

  check('Open has no inner glyph', open.innerPath, null);
  check('InProgress play fill', inProgress.innerFill, '#ffffff');
  check('InProgress play points right', /M11\.6 .* L21\.2 15 /.test(inProgress.innerPath ?? ''), true);
  check('Resolved check stroke', resolved.innerStroke, '#ffffff');
  check('Resolved check fill', resolved.innerFill, 'none');
  check('Closed x stroke', closed.innerStroke, '#ffffff');
  check('Closed x crosses centre', (closed.innerPath ?? '').includes('M11.2 11.2'), true);
  check('Closed x second arm', (closed.innerPath ?? '').includes('18.8 18.8'), true);

  console.log('\n══ BAR FILLS (value / total) ══');
  const expectedFills = [42 / 156, 28 / 156, 62 / 156, 24 / 156];
  m.statuses.forEach((s, i) => {
    check(
      `${s.accent} bar fill %`,
      +(s.fillPct ?? -1).toFixed(2),
      +(expectedFills[i] * 100).toFixed(2),
      0.05,
    );
  });

  console.log(
    `\n══ WIDTHS (reference: ${Object.values(M.REF_CARD_WIDTHS).join(' / ')}) ══`,
  );
  const widths = [m.total.rect.w, ...m.statuses.map((s) => s.rect.w)];
  console.log(`  rendered: ${JSON.stringify(widths)}`);
  checkOrder(
    'card width order',
    widths,
    [widths[0], widths[4], widths[1], widths[3], widths[2]],
  );

  // The cards' widths as FRACTIONS of the strip. This is the check
  // that actually catches a wrong `grid-template-columns`: the
  // absolute widths scale with the strip's width, but the ratios
  // do not.
  //
  // The reference's ratios are
  //   Total 22.56 | Open 18.42 | InProgress 17.75 | Resolved 19.16 | Closed 22.12
  // and they are NOT equal — the Total card is widest (it carries
  // a label, a number, a delta pill AND a caption).
  const names = ['total', 'open', 'inProgress', 'resolved', 'closed'];
  const sum = widths.reduce((a, b) => a + b, 0);
  const fractions = widths.map((w) => +((w / sum) * 100).toFixed(2));
  console.log(`  fractions: ${JSON.stringify(fractions)}`);
  names.forEach((n, i) => {
    check(
      `${n} width fraction`,
      fractions[i],
      M.REF_CARD_FRACTIONS[n],
      0.35,
    );
  });

  // The gaps between the cards. Each card's LEFT edge is absolute
  // within the strip, so the gap is the next card's left minus the
  // previous card's right.
  const lefts = [m.total.rect.x, ...m.statuses.map((s) => s.rect.x)];
  const gaps = [];
  for (let i = 1; i < widths.length; i++) {
    gaps.push(+(lefts[i] - (lefts[i - 1] + widths[i - 1])).toFixed(1));
  }
  console.log(`  gaps: ${JSON.stringify(gaps)}`);
  for (const g of gaps) {
    check('card gap', g, M.REF_CARD_GAP, 0.6);
  }

  console.log('\n══ LABEL / VALUE TEXT ══');
  check('Open label', open.label, 'Open');
  check('Open value', open.value, '42');
  check('In Progress label', inProgress.label, 'In Progress');
  check('In Progress value', inProgress.value, '28');
  check('Resolved label', resolved.label, 'Resolved');
  check('Resolved value', resolved.value, '62');
  check('Closed label', closed.label, 'Closed');
  check('Closed value', closed.value, '24');

  console.log('\n══ FONT METRICS ══');
  /**
   * The reference's text is Inter at 14px/600 (the label) and
   * 26px/700 (the value) — both SOLVED from the reference's own
   * pixel measurements and recorded in `ref-measurements.js`.
   *
   * The tracking is negative on both: the reference's "Total
   * Tickets" ink is 80px wide where Inter 600 at 14px with normal
   * tracking gives 86px, and the reference's "156" ink box is
   * 41x19 where Inter 700 at 26px with -0.5px tracking measures
   * 41x19 exactly.
   */
  const type = await strip.evaluate((host) => {
    const read = (el) => {
      const cs = getComputedStyle(el);
      return {
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing,
        lineHeight: cs.lineHeight,
        fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      };
    };
    const card = host.querySelector('[data-testid="stat-total-card"]');
    return {
      label: read(card.querySelector('.label')),
      value: read(card.querySelector('.value')),
    };
  });
  console.log(`  label: ${JSON.stringify(type.label)}`);
  console.log(`  value: ${JSON.stringify(type.value)}`);

  check('label font size', type.label.fontSize, `${G.label.size}px`);
  check('label font weight', type.label.fontWeight, String(G.label.weight));
  check(
    'label letter spacing',
    parseFloat(type.label.letterSpacing),
    G.label.tracking,
    0.05,
  );
  check('value font size', type.value.fontSize, `${G.value.size}px`);
  check('value font weight', type.value.fontWeight, String(G.value.weight));
  check(
    'value letter spacing',
    parseFloat(type.value.letterSpacing),
    G.value.tracking,
    0.05,
  );
  check('label typeface', type.label.fontFamily, 'Inter');
  check('value typeface', type.value.fontFamily, 'Inter');

  console.log('\n══ LIVE INK vs REFERENCE ══');
  /**
   * The strongest check available: render the strip, screenshot it
   * at 1x (so the pixels are directly comparable with the 1x
   * reference PNG), and compare the GLYPH INK of the label and the
   * value against the reference's.
   *
   * The reference's text column sits at a different x per card (the
   * mockup's cards were laid out individually), so only the ink's
   * VERTICAL extent and its WIDTH are compared — the two properties
   * that carry the font-size and baseline information.
   */
  {
    const { PNG } = require('pngjs');
    const stripEl = page.locator('[data-testid="stat-strip"]');
    const inkFile = path.join(OUT_DIR, 'verify-strip-1x.png');
    const ctx1x = await browser.newContext({
      viewport: { width: 1536, height: 1024 },
      deviceScaleFactor: 1,
    });
    const page1x = await ctx1x.newPage();
    await page1x.route('**/api/tickets/stats/mine', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(REF_PAYLOAD),
      }),
    );
    await page1x.goto('http://localhost:4200', { waitUntil: 'networkidle' });
    await page1x.locator('input[type="email"]').first().fill('jess@company.com');
    await page1x
      .locator('input[type="password"]')
      .first()
      .fill('password123');
    await page1x.locator('button[type="submit"]').first().click();
    await page1x.waitForLoadState('networkidle');
    await page1x.waitForTimeout(1200);
    await page1x
      .locator('[data-testid="stat-strip"]')
      .screenshot({ path: inkFile });
    await ctx1x.close();

    const png = PNG.sync.read(fs.readFileSync(inkFile));
    const isInk = (p) => p[0] < 200 || p[1] < 200 || p[2] < 200;

    // The card bands in the local 1x screenshot.
    const bands = [];
    {
      const y = 13;
      let start = null;
      for (let x = 0; x < png.width; x++) {
        const i = (y * png.width + x) * 4;
        const white =
          png.data[i] >= 248 &&
          png.data[i + 1] >= 248 &&
          png.data[i + 2] >= 248;
        if (white && start === null) start = x;
        if (!white && start !== null) {
          if (x - start > 40) bands.push(start - 1);
          start = null;
        }
      }
    }

    /** The ink box of a region, in card-relative pixels. */
    const inkBox = (cardX0, xLo, xHi, yLo, yHi) => {
      let x0 = null;
      let x1 = null;
      for (let x = cardX0 + xLo; x <= cardX0 + xHi; x++) {
        for (let y = yLo; y <= yHi; y++) {
          const i = (y * png.width + x) * 4;
          if (!isInk([png.data[i], png.data[i + 1], png.data[i + 2]])) {
            continue;
          }
          if (x0 === null) x0 = x - cardX0;
          x1 = x - cardX0;
          break;
        }
      }
      let top = null;
      let bottom = null;
      for (let y = yLo; y <= yHi; y++) {
        let n = 0;
        for (let x = cardX0 + xLo; x <= cardX0 + xHi; x++) {
          const i = (y * png.width + x) * 4;
          if (isInk([png.data[i], png.data[i + 1], png.data[i + 2]])) n++;
        }
        if (n) {
          if (top === null) top = y;
          bottom = y;
        }
      }
      return { x0, x1, width: x1 - x0 + 1, top, bottom, height: bottom - top + 1 };
    };

    const names = ['total', 'open', 'inProgress', 'resolved', 'closed'];
    names.forEach((name, i) => {
      const cardX0 = bands[i];
      const refLabel = M.REF_LABEL_INK[name];
      const refValue = M.REF_VALUE_INK[name];

      // The label: rows 20..40, columns 74..170 (short of the
      // sparkline, which starts at card+176).
      const l = inkBox(cardX0, 74, 170, 18, 40);
      console.log(
        `  ${name.padEnd(11)} label  local y ${l.top}..${l.bottom} (h ${l.height})  ref y ${refLabel.y0}..${refLabel.y1} (h ${refLabel.height})`,
      );
      check(`${name} label ink height`, l.height, refLabel.height, 1);
      check(`${name} label ink top`, l.top, refLabel.y0, 1);

      // The value: rows 42..70, columns 74..120 (short of the
      // progress bar, which starts at card+124).
      const v = inkBox(cardX0, 74, 120, 42, 70);
      console.log(
        `  ${name.padEnd(11)} value  local y ${v.top}..${v.bottom} (h ${v.height})  ref y ${refValue.y0}..${refValue.y1} (h ${refValue.height})`,
      );
      check(`${name} value ink height`, v.height, refValue.height, 1);
      check(`${name} value ink top`, v.top, refValue.y0, 1);
    });
  }

  console.log(
    `\n══ ${checks - failures}/${checks} checks passed ══\n`,
  );

  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})();
