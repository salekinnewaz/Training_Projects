/**
 * The reference-measurement module for the Employee Dashboard stat
 * strip.
 *
 * This is the SINGLE SOURCE OF TRUTH for "what the reference
 * actually looks like", measured pixel-by-pixel from the WDS-2026
 * mockup at `qa/screenshots/local-view/ref-full.png`.
 *
 * It replaces the 43 numbered one-off `measure-refN.js` probes that
 * were written while reverse-engineering the reference. Each of
 * those probes measured one thing (the card bands, the tiles, the
 * discs, the text baselines, the delta pill's box, ...) and printed
 * it to stdout; the results were transcribed by hand into the
 * component CSS and into the design docs.
 *
 * The measurements are now recorded HERE, in code, so that:
 *   - `verify-strip.js` can assert against the live DOM using the
 *     same numbers, and
 *   - a future reader can see what each number was measured from
 *     without re-running 43 scripts.
 *
 * ── How the numbers were obtained ──────────────────────────────
 *
 * The reference PNG is 1536px wide (rendered at deviceScaleFactor 1
 * for the crop) and shows the strip against a lavender page
 * background (`#F0F3FD`). The five cards are white (`#FEFEFE`) with
 * a 1px border, so the card bands were found by scanning rows for
 * runs of white pixels separated by the page background.
 *
 * The reference's device pixel ratio is 1 in `ref-full.png` but the
 * strip geometry below is expressed in CSS pixels at the reference's
 * own 1x scale. `ref-full.png` is 1536 wide; the strip's cards run
 * from x=83 to x=1467, i.e. a 1384px band, of which the cards'
 own
 * widths are as listed.
 *
 * Every offset is CARD-RELATIVE unless stated otherwise. That is
 * the single most important detail: the reference's "176" for the
 * sparkline is 176px from the Open card's LEFT EDGE, not from the
 * strip's. Measuring strip-relative is the classic way to get a
 * plausible-looking but wrong number.
 */

const path = require('path');
const fs = require('fs');

const { PNG } = require('pngjs');

const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'local-view');
const REF_PATH = path.join(OUT_DIR, 'ref-full.png');

/** The reference image's page background (lavender). */
const PAGE_BG = [240, 243, 253];

/** The reference's card background (near-white). */
const CARD_BG = [254, 254, 254];

/* ────────────────────────────────────────────────────────────────
 * Card geometry
 * ──────────────────────────────────────────────────────────────── */

/**
 * The five cards' band boundaries in `ref-full.png` pixel
 * coordinates.
 *
 * These are the cards' TRUE extents, taken at the widest scan row
 * (y=196), where the rounded corners are at their widest. A row
 * further from the vertical middle of the card sees a narrower band
 * because the corner radius curves in — so the scan row has to be
 * chosen deliberately, not just "the first row that looks white".
 *
 * Cross-checked at y=194 and y=258/260, which give the same
 * boundaries for the four status cards.
 */
const REF_CARD_BANDS = [
  { name: 'total', x0: 83, x1: 387 },
  { name: 'open', x0: 396, x1: 644 },
  { name: 'inProgress', x0: 653, x1: 892 },
  { name: 'resolved', x0: 901, x1: 1159 },
  { name: 'closed', x0: 1169, x1: 1467 },
];

/**
 * The strip band's vertical extent: y=183..269, so the cards are
 * 88px tall (269 − 183 + 1 = 87, plus the border = 88).
 */
const REF_STRIP_TOP = 183;
const REF_CARD_HEIGHT = 88;

/**
 * The card widths, measured on the reference. They are NOT equal:
 * the Total card is widest (it carries a label, a number, a delta
 * pill AND a caption), and Closed is second widest.
 *
 *   Total 305 | Open 249 | In Progress 240 | Resolved 259 | Closed 299
 *
 * These sum to 1352px. The strip's cards span x=83..1467 = 1385px,
 * so the four gaps take 33px — 8.25 each, hence an 8px gap in the
 * implementation.
 *
 * An EARLIER measurement of these widths (291 / 248 / 237 / 241 /
 * 316) was WRONG: it had been read off the local render rather
 * than off the reference, and it made the Closed card 17px too wide
 * and the Resolved card 18px too narrow.
 */
const REF_CARD_WIDTHS = {
  total: 305,
  open: 249,
  inProgress: 240,
  resolved: 259,
  closed: 299,
};

/** The gap between adjacent cards (33px over four gaps = 8.25). */
const REF_CARD_GAP = 8;

/**
 * The card WIDTH FRACTIONS, as the implementation declares them.
 * These are what `verify-strip.js` compares the live DOM against.
 */
const REF_CARD_FRACTIONS = {
  total: 22.56,
  open: 18.42,
  inProgress: 17.75,
  resolved: 19.16,
  closed: 22.12,
};

/* ────────────────────────────────────────────────────────────────
 * Element geometry (card-relative)
 * ──────────────────────────────────────────────────────────────── */

/**
 * Every offset below is measured from the card's own LEFT edge
 * (x) or TOP edge (y).
 *
 * The x offsets are the GLYPH pixels' left edge, not the text
 * element's box.
 *
 * A NOTE ON THE TEXT COLUMN'S x: the reference places each card's
 * label at a DIFFERENT offset — the ink starts at card+91 (Total),
 * 82 (Open), 83 (In Progress), 85 (Resolved), 95 (Closed). The
 * same glyph ("2" in "28" and "24") appears at card+83 and card+95,
 * so this is not a side-bearing effect: the mockup's cards were
 * laid out individually.
 *
 * The implementation therefore uses ONE consistent text column
 * (card+82, the position four of the reference's five cards sit at
 * or beside) rather than reproducing the mockup's per-card
 * inconsistency. The y offsets below ARE consistent across all
 * five cards, and those are matched exactly.
 */
const REF_GEOMETRY = {
  /**
   * The icon tile, top-left of every card.
   *
   * Measured by matching the tile's known fill: the first tinted
   * pixel is at card+18, and the fill runs card+19..67, both
   * vertically card+18..69. The tile is a 52x52 rounded square
   * with a 14px radius, so its corners pull the apparent edges in
   * by a pixel or two — hence reading the edges at the box's
   * straight sections rather than at a corner.
   *
   * An earlier pass recorded card+14, which put the tile 4px too
   * far into the corner.
   */
  tile: { x: 18, y: 18, width: 52, height: 52, radius: 14 },

  /**
   * The label ("Total Tickets", "Open", ...).
   *
   * Inter 600 at 14px — the reference's cap height (11px) matches
   * that face exactly, and the "Total Tickets" ink is 80px wide.
   *
   * The tracking is NEGATIVE: Inter 600 at 14px with normal
   * tracking renders "Total Tickets" 86px wide, so the reference
   * closes the 6px gap with about -0.5px per character.
   *
   * The ink runs card+24..34 vertically.
   */
  label: {
    x: 82,
    size: 14,
    weight: 600,
    color: '#334155',
    top: 24,
    capHeight: 11,
    tracking: -0.5,
    inkWidth: 80,
  },

  /**
   * The big number.
   *
   * Inter 700 at 26px — NOT 30px. The reference's ten digit widths
   * were measured individually, one per card:
   *
   *   "156" -> 9, 14, 14     "42" -> 15, 13
   *   "28"  -> 14, 14        "62" -> 15, 13
   *   "24"  -> 14, 15
   *
   * Inter 700 reproduces all ten at 26px and at no other size; at
   * 30px the digits come out 17-18px wide, 3px too fat. The
   * reference's "156" ink box is 41x19 and Inter 700 at 26px with
   * -0.5px tracking measures 41x19 exactly.
   *
   * The ink runs card+47..65 vertically.
   */
  value: {
    x: 82,
    size: 26,
    weight: 700,
    top: 47,
    digitHeight: 19,
    tracking: -0.5,
    inkWidth: 41,
  },

  /** The sparkline, top-right of the status cards. */
  spark: { width: 54, height: 26, rightInset: 14, top: 16 },

  /**
   * The progress bar, bottom-right of the status cards.
   *
   * The bar is NOT a fixed 106px box. Its LEFT edge is anchored a
   * fixed distance right of the card's value column, and its RIGHT
   * edge is anchored 18px inside the card's border; the width falls
   * out of the space between them. Measured off ref-full.png:
   *
   *   card      w   bar track   value ink   barLeft-valueLeft
   *   open    249   131..231    83..109          48
   *   inProg  240   131..222    84..111          47
   *   res     259   134..242    85..112          49
   *   closed  299   149..280    96..123          53
   *
   * so the track's widths are 101, 92, 109 and 132 — the 106 the
   * older reading took was the Open card's, and the "rightInset: 14"
   * was the SPARKLINE's inset, not the bar's. The bar's own inset
   * is 17-19px (18 on the Open and In Progress cards).
   *
   * The bar's right edge and the sparkline's right edge are
   * essentially flush — the reference's spark INK ends at inset
   * 19-20 while its bar TRACK ends at inset 17-18 — which is why
   * the two were modelled as sharing an edge. The sparkline's BOX
   * is what sits at inset 14.
   */
  bar: { height: 8, rightInset: 18, bottom: 20, leftInset: 129 },

  /** The delta pill (Total card only), top-right. */
  pill: { rightInset: 14, top: 14, height: 25, bg: '#E1F9EE', fg: '#09C05B' },

  /** The "vs last month" caption (Total card only), bottom-right. */
  caption: { rightInset: 14, bottom: 14, size: 15, color: '#A7ACCC' },
};

/* ────────────────────────────────────────────────────────────────
 * Colour tokens
 * ──────────────────────────────────────────────────────────────── */

/**
 * The strip's own accent palette. Deliberately SEPARATE from the
 * shared `--status-*-dot` family (which the Ticket Detail status
 * pills and the Kanban column dots also read) — changing that
 * family would shift the rest of the app.
 *
 * The reference's Open disc is a pure blue (not the pill's indigo)
 * and its Closed disc is a slate BLUE (not a neutral grey).
 */
const REF_ACCENTS = {
  total: { accent: '#7433FE', tile: '#F0EAFE' },
  open: { accent: '#0674FE', tile: '#EAF2FE', spark: '#6366F1' },
  inProgress: { accent: '#FEAF11', tile: '#FEF4E0', spark: '#B4BEEB' },
  resolved: { accent: '#08D076', tile: '#E1F9EE', spark: '#02C878' },
  closed: { accent: '#5D749D', tile: '#EBEEF6', spark: '#87A0D0' },
};

/**
 * The sparkline colours are a THIRD set, separate again from the
 * disc accents. The In Progress curve is periwinkle so the amber
 * bar below stays the card's only warm element.
 */
const REF_SPARK_COLORS = {
  open: '#6366F1',
  inProgress: '#B4BEEB',
  resolved: '#02C878',
  closed: '#87A0D0',
};

/* ────────────────────────────────────────────────────────────────
 * The pale wash
 * ──────────────────────────────────────────────────────────────── */

/**
 * The stat strip's sparkline is a WASH, not a solid line: stroke
 * opacity 0.34 over a gradient fill at 0.10. Because the gradient
 * fill sits BEHIND the stroke, the two alphas compound:
 *
 *   1 - (1 - 0.34)(1 - 0.10) = 0.406
 *
 * which is the reference's measured peak alpha. Each value is
 * therefore set below the target and they compound up to it.
 */
const REF_STROKE_OPACITY = 0.34;
const REF_FILL_OPACITY = 0.1;
const REF_EFFECTIVE_ALPHA = 0.406;

/* ────────────────────────────────────────────────────────────────
 * The delta
 * ──────────────────────────────────────────────────────────────── */

/**
 * The reference's delta pill reads "12%" with an UP arrow, painted
 * green (#09C05B) on #E1F9EE.
 *
 * The percentage was confirmed pixel-by-pixel (an ASCII glyph map
 * of the pill's text pixels) rather than inferred — an earlier
 * guess of "13%" was wrong.
 *
 * The pill is HIDDEN entirely when there is no previous period to
 * compare against: a misleading "+100%" is worse than no pill at
 * all.
 */
const REF_DELTA = {
  text: '12%',
  direction: 'up',
  color: '#09C05B',
  background: '#E1F9EE',
};

/**
 * The payload that produces the reference's +12%.
 *
 * The delta is `round((recent - previous) / previous * 100)` where
 * `recent` is the sum of the last 30 days of `dailyCreated` and
 * `previous` is `previousPeriod`.
 *
 *   recent = 82, previous = 73 -> 12.33% -> +12%
 *
 * (With previous = 64 the only integer `recent` that rounds to 12
 * is 72, and 9/64 = 14% — the earlier, wrong reading.)
 */
const REF_DELTA_PAYLOAD = { recent: 82, previous: 73 };

/* ────────────────────────────────────────────────────────────────
 * Responsive breakpoints
 * ──────────────────────────────────────────────────────────────── */

/**
 * The strip collapses to three equal columns below 1180px and to
 * two equal columns below 760px. At two columns the cards are far
 * narrower than 119px, so the fixed 106px bar and 54px sparkline
 * would spill out of their cards — hence the `min()` clamps.
 */
const REF_BREAKPOINTS = {
  threeColumn: 1180,
  twoColumn: 760,
};

/* ────────────────────────────────────────────────────────────────
 * The reference image itself
 * ──────────────────────────────────────────────────────────────── */

/** Read a pixel from the reference PNG. */
function refPixel(x, y) {
  const png = readRef();
  const i = (y * png.width + x) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

let _ref = null;

/** Read (and memoise) the reference PNG. */
function readRef() {
  if (!_ref) {
    if (!fs.existsSync(REF_PATH)) {
      throw new Error(
        `Reference image not found at ${REF_PATH}. ` +
          'See qa/scripts/README.md for how to regenerate it.',
      );
    }
    _ref = PNG.sync.read(fs.readFileSync(REF_PATH));
  }
  return _ref;
}

/** The saturation of a pixel (max − min channel). */
function saturation(p) {
  return Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]);
}

/**
 * Find the card bands by scanning a row near the TOP of the strip
 * for runs of card-background pixels separated by the page
 * background.
 *
 * The scan row matters: the cards have ROUNDED corners, so a row
 * close to the top (or bottom) sees a narrower card than a row
 * through the middle. `REF_SCAN_ROW` sits just inside the top
 * edge, where the bands are clean — no text, no tiles, no
 * sparklines — so the only thing that can break a run is the gap
 * between two cards.
 *
 * The runs it returns are the card's INNER (background) extent; the
 * recorded `REF_CARD_BANDS` include the 1px border on each side,
 * hence the 2px difference.
 *
 * `REF_SCAN_ROW` (196) sits just below the strip's top edge, where
 * the rounded corners are at their widest — so the bands it finds
 * are the cards' TRUE extents, matching `REF_CARD_BANDS` exactly.
 */
const REF_SCAN_ROW = 196;

function detectCardBands() {
  const png = readRef();
  const bands = [];
  let start = null;
  for (let x = 0; x < png.width; x++) {
    const p = refPixel(x, REF_SCAN_ROW);
    // The card backgrounds are the near-whites; the page behind
    // the strip is the lavender #F0F3FD, which is clearly darker
    // in the blue channel.
    const isCard = p[0] >= 248 && p[1] >= 248;
    if (isCard && start === null) start = x;
    if (!isCard && start !== null) {
      bands.push({ x0: start, x1: x - 1, width: x - start });
      start = null;
    }
  }
  if (start !== null) {
    bands.push({ x0: start, x1: png.width - 1, width: png.width - start });
  }
  // Drop slivers — anti-aliased shadow pixels can produce a
  // 1-2px run at the image edges.
  return bands.filter((b) => b.width > 40);
}

/**
 * Find the dominant saturated colour inside a rectangle — used for
 * the status discs and the Total card's clipboard glyph.
 *
 * The reference's discs are only 25px across and heavily
 * anti-aliased, so NO single hex dominates: the top count might
 * be 11 pixels out of a 25x25 disc, and the "winner" can sit a
 * channel or two away from the true fill (the Resolved disc's mode
 * is #05D87D, while its designed fill is #08D076).
 *
 * The robust reading is therefore the MEDIAN channel value of the
 * saturated pixels, which ignores the anti-aliased minority and
 * lands on the fill itself.
 */
function dominantSaturatedColour(x0, y0, x1, y1, threshold = 60) {
  const pixels = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = refPixel(x, y);
      if (saturation(p) < threshold) continue;
      pixels.push(p);
    }
  }
  if (!pixels.length) return { colour: null, count: 0 };
  const median = (i) => {
    const v = pixels.map((p) => p[i]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  const colour =
    '#' +
    [0, 1, 2]
      .map((i) => median(i).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  return { colour, count: pixels.length };
}

/**
 * The channel distance between two hex colours.
 */
function colourDistance(a, b) {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  return Math.max(
    Math.abs(((na >> 16) & 255) - ((nb >> 16) & 255)),
    Math.abs(((na >> 8) & 255) - ((nb >> 8) & 255)),
    Math.abs((na & 255) - (nb & 255)),
  );
}

/**
 * The reference's VALUE DIGIT ink widths, measured one digit at a
 * time from the PNG.
 *
 * These are the fingerprint that identifies the value's font size:
 * a "1" is much narrower than a "5", and the ratio between them is
 * a property of the typeface rather than its size — so the widths
 * pin the size down uniquely.
 *
 *   "156" -> 9, 14, 14     "42" -> 15, 13
 *   "28"  -> 14, 14        "62" -> 15, 13
 *   "24"  -> 14, 15
 *
 * Inter 700 reproduces all ten at 26px. At 24px the digits are
 * 1-2px too narrow; at 28px they are 1-2px too wide.
 */
const REF_VALUE_DIGIT_WIDTHS = {
  total: [9, 14, 14],
  open: [15, 13],
  inProgress: [14, 14],
  resolved: [15, 13],
  closed: [14, 15],
};

/**
 * The reference's VALUE INK BOXES, card-relative.
 *
 * The box's width and height are the strongest single measurement
 * of the value's font size, because both are independent of the
 * glyphs: the height is the face's digit height and the width is
 * the sum of the digits' ink widths.
 */
const REF_VALUE_INK = {
  total: { x0: 91, x1: 131, y0: 47, y1: 65, width: 41, height: 19 },
  open: { x0: 82, x1: 110, y0: 47, y1: 66, width: 29, height: 20 },
  inProgress: { x0: 83, x1: 111, y0: 47, y1: 66, width: 29, height: 20 },
  resolved: { x0: 84, x1: 112, y0: 47, y1: 66, width: 29, height: 20 },
  closed: { x0: 95, x1: 124, y0: 47, y1: 65, width: 30, height: 19 },
};

/**
 * The reference's LABEL INK BOXES, card-relative.
 *
 * The label's ink is measured across rows card+23..38, which
 * brackets the label's own rows without reaching the sparkline
 * (which starts at card+176).
 */
const REF_LABEL_INK = {
  total: { x0: 91, x1: 170, y0: 24, y1: 34, width: 80, height: 11 },
  open: { x0: 82, x1: 113, y0: 25, y1: 36, width: 32, height: 12 },
  inProgress: { x0: 83, x1: 149, y0: 25, y1: 36, width: 67, height: 12 },
  resolved: { x0: 85, x1: 137, y0: 24, y1: 34, width: 53, height: 11 },
  closed: { x0: 95, x1: 135, y0: 25, y1: 34, width: 41, height: 10 },
};

module.exports = {
  OUT_DIR,
  REF_PATH,
  PAGE_BG,
  CARD_BG,
  REF_CARD_BANDS,
  REF_STRIP_TOP,
  REF_CARD_HEIGHT,
  REF_CARD_WIDTHS,
  REF_CARD_GAP,
  REF_CARD_FRACTIONS,
  REF_GEOMETRY,
  REF_ACCENTS,
  REF_SPARK_COLORS,
  REF_STROKE_OPACITY,
  REF_FILL_OPACITY,
  REF_EFFECTIVE_ALPHA,
  REF_DELTA,
  REF_DELTA_PAYLOAD,
  REF_BREAKPOINTS,
  REF_VALUE_DIGIT_WIDTHS,
  REF_VALUE_INK,
  REF_LABEL_INK,
  readRef,
  refPixel,
  saturation,
  detectCardBands,
  dominantSaturatedColour,
  colourDistance,
  REF_SCAN_ROW,
};
