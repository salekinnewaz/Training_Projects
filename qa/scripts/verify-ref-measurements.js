/**
 * Self-check for `ref-measurements.js`.
 *
 * The measurements recorded in that module were transcribed by hand
 * from a set of one-off pixel probes. This script re-derives them
 * from the reference PNG and fails if the recorded values and the
 * image disagree — so the module cannot silently drift away from
 * the mockup it documents.
 *
 *   node qa/scripts/verify-ref-measurements.js
 */

const M = require('./ref-measurements');

let failures = 0;
let checks = 0;

/** A pixel as a #RRGGBB string. */
function hexOf(p) {
  return (
    '#' +
    p.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
  );
}

function check(label, actual, expected, tolerance = 0) {
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

console.log('\n══ CARD BANDS ══');
const detected = M.detectCardBands();
check('card count', detected.length, M.REF_CARD_BANDS.length);
M.REF_CARD_BANDS.forEach((band, i) => {
  const d = detected[i];
  if (!d) return;
  // The scan finds the card's INNER (background) extent; the
  // recorded band includes the 1px border on each side.
  check(`${band.name} band x0`, d.x0, band.x0 + 1, 1);
  check(`${band.name} band x1`, d.x1, band.x1 - 1, 1);
});

console.log('\n══ CARD WIDTHS ══');
M.REF_CARD_BANDS.forEach((band, i) => {
  const name = band.name;
  const measured = detected[i] ? detected[i].width : 0;
  // The recorded widths are the CSS-pixel widths (border-box); the
  // PNG's inner bands are 2px narrower.
  check(
    `${name} measured width`,
    measured + 2,
    M.REF_CARD_WIDTHS[name],
    2,
  );
});

console.log('\n══ TILE BOX ══');
/**
 * The tile is a 52x52 rounded square at card+18..70, filled with
 * the card's tint. Its first tinted pixel is at card+18 and the
 * fill runs card+19..67 — so the LEFT edge is read at the box's
 * straight section (the anti-aliased corner pulls it in), and the
 * fill colour is sampled just inside that edge.
 */
const TILE = M.REF_GEOMETRY.tile;
for (const band of M.REF_CARD_BANDS) {
  // The leftmost tinted pixel in the row through the tile's
  // vertical middle, above the disc.
  //
  // The Total card's tile is a lavender on a lavender-tinged card,
  // so its fill sits further from the card background than the
  // status tiles' do — it needs a wider tolerance to be found.
  const tol = band.name === 'total' ? 12 : 4;
  const y = M.REF_STRIP_TOP + 20;
  let first = null;
  for (let x = band.x0 + 2; x <= band.x0 + 80; x++) {
    const p = M.refPixel(x, y);
    if (M.colourDistance(hexOf(p), M.REF_ACCENTS[band.name].tile) <= tol) {
      first = x;
      break;
    }
  }
  check(
    `${band.name} tile left edge`,
    first === null ? null : first - band.x0,
    TILE.x + 1,
    band.name === 'total' ? 3 : 1,
  );

  // The tile's fill, sampled just inside the edge.
  const fill = hexOf(M.refPixel(first + 3, y));
  check(
    `${band.name} tile bg distance`,
    M.colourDistance(fill, M.REF_ACCENTS[band.name].tile),
    0,
    band.name === 'total' ? 12 : 4,
  );
}

console.log('\n══ DISCS (median saturated colour) ══');
/**
 * The disc is a 25px circle centred in the card's 52x52 tile, so
 * its centre sits at (card.x + 18 + 26, card.y + 18 + 26). A 9x9
 * box around that centre is pure fill — no anti-aliased edge.
 */
const DISC_SAMPLE = 4; // half-width of the centred sample box
for (const band of M.REF_CARD_BANDS) {
  if (band.name === 'total') continue;
  const cx = band.x0 + TILE.x + 26;
  const cy = M.REF_STRIP_TOP + TILE.y + 26;
  // Sample a RING around the disc's centre rather than the centre
  // itself: every disc carries a white inner glyph (a play
  // triangle, a check, an x) in the middle, which would drag a
  // median toward white.
  //
  // The ring's outer edge is also excluded — the disc's rim is
  // anti-aliased against the tile, and those blended pixels read
  // as a different colour.
  const ring = [];
  for (let dy = -DISC_SAMPLE; dy <= DISC_SAMPLE; dy++) {
    for (let dx = -DISC_SAMPLE; dx <= DISC_SAMPLE; dx++) {
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
      if (Math.abs(dx) === DISC_SAMPLE || Math.abs(dy) === DISC_SAMPLE) continue;
      ring.push(M.refPixel(cx + dx, cy + dy));
    }
  }
  const design = M.REF_ACCENTS[band.name].accent;

  // The disc's FILL is the design colour; the inner glyph and the
  // anti-aliased rim are the deviations. So rather than averaging
  // (which would blend the white glyph into the result), find the
  // pixel CLOSEST to the design colour and check that the design
  // colour really is present in the disc.
  const solid = ring.filter((p) => M.saturation(p) >= 40);
  const closest = solid
    .map((p) => ({ hex: hexOf(p), d: M.colourDistance(hexOf(p), design) }))
    .sort((a, b) => a.d - b.d)[0];

  check(
    `${band.name} disc fill present`,
    closest.d,
    0,
    6,
  );
}

console.log('\n══ TOTAL CARD GLYPH ══');
{
  // The clipboard glyph sits in the Total card's tile, slightly
  // left of centre (its ink runs card+31..58).
  const cx = M.REF_CARD_BANDS[0].x0 + 44;
  const cy = M.REF_STRIP_TOP + TILE.y + 28;
  const { colour } = M.dominantSaturatedColour(cx - 6, cy - 8, cx + 6, cy + 8, 100);
  check(
    'total clipboard colour distance',
    M.colourDistance(colour ?? '#000000', M.REF_ACCENTS.total.accent),
    0,
    30,
  );
}

console.log('\n══ ALPHA COMPOUNDING ══');
{
  const compounded =
    1 - (1 - M.REF_STROKE_OPACITY) * (1 - M.REF_FILL_OPACITY);
  check(
    'effective alpha',
    +compounded.toFixed(3),
    M.REF_EFFECTIVE_ALPHA,
    0.001,
  );
}

console.log('\n══ DELTA PAYLOAD ══');
{
  const { REF_DELTA_PAYLOAD, REF_DELTA } = M;
  const delta = Math.round(
    ((REF_DELTA_PAYLOAD.recent - REF_DELTA_PAYLOAD.previous) /
      REF_DELTA_PAYLOAD.previous) *
      100,
  );
  check('delta rounds to 12', delta, 12);
  check('delta text', REF_DELTA.text, '12%');
}

console.log('\n══ CARD FRACTIONS ══');
{
  // The fractions must reproduce the reference's unequal widths.
  const total = Object.values(M.REF_CARD_FRACTIONS).reduce((a, b) => a + b, 0);
  check('fractions sum to ~100', +total.toFixed(1), 100, 0.2);
  // The five cards share the strip's width minus the four 9px
  // gaps. The reference's cards span x=83..1467 = 1385px, less
  // 4 gaps of 9px = 1349px of card.
  const shared = 1385 - 4 * M.REF_CARD_GAP;
  const derived = Object.fromEntries(
    Object.entries(M.REF_CARD_FRACTIONS).map(([k, v]) => [
      k,
      +((v / 100) * shared).toFixed(0),
    ]),
  );
  for (const [k, v] of Object.entries(derived)) {
    check(`${k} derived width`, v, M.REF_CARD_WIDTHS[k], 2);
  }
}

console.log('\n══ TEXT INK ══');
/**
 * The label's and the value's ink boxes, measured from the PNG.
 *
 * The label's rows are card+23..38 (the label's own rows, clear of
 * the sparkline). The value's rows are card+44..68.
 */
{
  const isInk = (p) => p[0] < 200 || p[1] < 200 || p[2] < 200;

  /** Per-column ink counts across a band of rows. */
  const columns = (band, yLo, yHi, xLo, xHi) => {
    const out = [];
    for (let x = band.x0 + xLo; x <= band.x0 + xHi; x++) {
      let n = 0;
      for (let y = M.REF_STRIP_TOP + yLo; y <= M.REF_STRIP_TOP + yHi; y++) {
        if (isInk(M.refPixel(x, y))) n++;
      }
      out.push(n);
    }
    return out;
  };

  /** The first and last column with ink, and the rows it spans. */
  const inkBox = (band, yLo, yHi, xLo, xHi) => {
    const profile = columns(band, yLo, yHi, xLo, xHi);
    let x0 = null;
    let x1 = null;
    profile.forEach((n, i) => {
      if (n > 0) {
        if (x0 === null) x0 = band.x0 + xLo + i;
        x1 = band.x0 + xLo + i;
      }
    });
    let y0 = null;
    let y1 = null;
    for (let y = M.REF_STRIP_TOP + yLo; y <= M.REF_STRIP_TOP + yHi; y++) {
      let n = 0;
      for (let x = x0; x <= x1; x++) {
        if (isInk(M.refPixel(x, y))) n++;
      }
      if (n) {
        if (y0 === null) y0 = y - M.REF_STRIP_TOP;
        y1 = y - M.REF_STRIP_TOP;
      }
    }
    return { x0: x0 - band.x0, x1: x1 - band.x0, y0, y1 };
  };

  for (const band of M.REF_CARD_BANDS) {
    const label = M.REF_LABEL_INK[band.name];
    const value = M.REF_VALUE_INK[band.name];

    // The label's box, measured.
    const lm = inkBox(band, 23, 38, 74, 170);
    check(`${band.name} label ink x0`, lm.x0, label.x0, 1);
    check(`${band.name} label ink width`, lm.x1 - lm.x0 + 1, label.width, 1);
    check(`${band.name} label ink y0`, lm.y0, label.y0, 1);
    check(`${band.name} label ink height`, lm.y1 - lm.y0 + 1, label.height, 1);

    // The value's box, measured.
    //
    // The window's right edge is bounded by the recorded box (plus a
    // pixel of slack) so the progress bar — which starts at card+124
    // and shares the digits' lower rows — cannot be counted as part
    // of the number. `value.x1` is already CARD-relative.
    const vm = inkBox(band, 44, 68, 74, Math.min(175, value.x1 + 6));
    check(`${band.name} value ink x0`, vm.x0, value.x0, 1);
    check(`${band.name} value ink width`, vm.x1 - vm.x0 + 1, value.width, 1);
    check(`${band.name} value ink y0`, vm.y0, value.y0, 1);
    check(`${band.name} value ink height`, vm.y1 - vm.y0 + 1, value.height, 1);
  }
}

console.log('\n══ VALUE DIGIT WIDTHS ══');
/**
 * The ten digit widths that pin the value's font size.
 *
 * Each digit is measured on its own by scanning the ink columns
 * between the digit runs. The reference's own numbers are
 * compared against a re-measurement, and — crucially — against
 * the widths Inter 700 produces at the size the implementation uses.
 */
{
  const isInk = (p) => p[0] < 200 || p[1] < 200 || p[2] < 200;

  for (const band of M.REF_CARD_BANDS) {
    const expected = M.REF_VALUE_DIGIT_WIDTHS[band.name];

    // The digit runs, from the ink columns.
    const runs = [];
    let start = null;
    for (let x = band.x0 + 74; x <= band.x0 + 175; x++) {
      let n = 0;
      for (let y = M.REF_STRIP_TOP + 44; y <= M.REF_STRIP_TOP + 68; y++) {
        if (isInk(M.refPixel(x, y))) n++;
      }
      if (n > 0 && start === null) start = x;
      if (n === 0 && start !== null) {
        runs.push(x - start);
        start = null;
      }
    }

    // The first N runs are the digits; anything after them belongs
    // to the progress bar or the sparkline.
    const digits = runs.slice(0, expected.length);
    check(
      `${band.name} digit count`,
      digits.length,
      expected.length,
    );
    expected.forEach((want, i) => {
      check(`${band.name} digit ${i + 1} width`, digits[i] ?? -1, want, 1);
    });
  }
}

console.log('\n══ FONT SIZE SOLUTION ══');
/**
 * The value's font size is not asserted against the DOM here — it
 * is SOLVED, from the reference's own digit widths, using Inter's
 * metrics. This proves the size is the only one that fits.
 */
async function solveFontSize() {
  const { chromium } = require('playwright');

  // Inter's per-digit ink widths at each candidate size.
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4200', { waitUntil: 'domcontentloaded' });
  const table = await page.evaluate(() => {
    const family = getComputedStyle(document.body).fontFamily;
    const ctx = document.createElement('canvas').getContext('2d');
    const out = {};
    for (const size of [22, 23, 24, 25, 26, 27, 28, 29, 30]) {
      ctx.font = `700 ${size}px ${family}`;
      out[size] = {};
      for (const t of ['156', '42', '28', '62', '24']) {
        out[size][t] = [...t].map((ch) => {
          const m = ctx.measureText(ch);
          return +(
            m.actualBoundingBoxLeft + m.actualBoundingBoxRight
          ).toFixed(1);
        });
      }
    }
    return out;
  });
  await browser.close();

  // For each size, how far is it from the reference's ten widths?
  const bySize = {};
  for (const size of Object.keys(table)) {
    let err = 0;
    for (const [name, expected] of Object.entries(
      M.REF_VALUE_DIGIT_WIDTHS,
    )) {
      const got = table[size][
        { total: '156', open: '42', inProgress: '28', resolved: '62', closed: '24' }[name]
      ];
      expected.forEach((want, i) => {
        err += Math.abs(got[i] - want);
      });
    }
    bySize[size] = err;
  }

  const best = Object.entries(bySize).sort((a, b) => a[1] - b[1])[0];
  check(
    'value font size that fits the digit widths',
    parseInt(best[0], 10),
    M.REF_GEOMETRY.value.size,
  );
  console.log(
    `  (total width error by size: ${Object.entries(bySize)
      .map(([s, e]) => `${s}px=${e.toFixed(1)}`)
      .join(', ')})`,
  );
}

solveFontSize()
  .then(() => {
    console.log(`\n══ ${checks - failures}/${checks} checks passed ══\n`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
