/**
 * VERIFY — the WDS-2026 Admin Workspace against the reference.
 *
 * This is the Admin dashboard's own gate. It asserts the four
 * things the redesign actually promised:
 *
 *   1. At the reference's 1536px viewport the workspace lands on
 *      the reference's MEASURED geometry — the five stat-strip
 *      cards, the two row-2 cards and the three row-3 cards, with
 *      their card-relative text/tile offsets.
 *   2. Nothing escapes its card at any breakpoint — no card's
 *      content hangs outside its own border box.
 *   3. The document itself never scrolls sideways.
 *   4. The stat strip's labels are never clipped (the "In Progress"
 *      regression) and the Recent Tickets table scrolls INSIDE its
 *      card rather than being cut off.
 *
 * Every expected number below was MEASURED off the reference PNG
 * (qa/scripts/ref-*.mjs) — see qa/.qa-tmp/ref-strip-GEOMETRY.md
 * and qa/.qa-tmp/ref-admin-workspace.json for the raw captures.
 *
 * Nothing here screenshots into the conversation: the measurements
 * are printed as numbers and written to
 * qa/.qa-tmp/verify-admin-workspace.json.
 *
 *   node qa/scripts/verify-admin-workspace.js
 */

'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { BASE_URL: BASE } = require('./base-url');

const OUT_DIR = path.join(__dirname, '..', '.qa-tmp');

/* ── The reference's measured geometry ──────────────────────────────
 *
 * Card BORDER boxes (the reference's strip band, y=222..311):
 *
 *   Total         285..545  (261)
 *   Open          554..780  (227)
 *   In Progress   792..1023 (232)
 *   Resolved     1036..1264 (229)
 *   Closed       1277..1506 (230)
 *
 * The status cards' text column is at card+79 and the Total card's
 * at card+83; the icon tile is at card+17..card+69.
 *
 * The card WIDTHS are the one measurement the reference does not
 * pin to a single pixel: its borders are hand-drawn and
 * anti-aliased, so a border box read off the PNG is only good to
 * about a pixel (the same card measures 227 or 228 depending on
 * which row of the band is scanned — see
 * qa/scripts/_strip-widths.mjs). The strip's widths are therefore
 * asserted to ±2.5px. Every other number below — the text offsets,
 * the tile, the heights, the row-2 and row-3 card widths — is
 * asserted exactly.
 */
const REF = {
  strip: {
    cardTop: 222,
    cardHeight: 90,
    widths: [261, 227, 232, 229, 230],
    widthTolerance: 2.5,
    textLeft: { total: 83, status: 79 },
    tileLeft: 17,
    tileSize: 52,
    labels: ['Total Tickets', 'Open', 'In Progress', 'Resolved', 'Closed'],
  },
  row2: {
    // Recent Tickets 818px, a 10px gutter, Users Overview 396px.
    widths: [818, 396],
  },
  row3: {
    // Ticket Trends 497px, a 9px gutter, Priority 327px, an 11px
    // gutter, Recent Users 380px.
    widths: [497, 327, 380],
  },
};

const WIDTHS = (process.env.WIDTHS || '1536,1440,1366,1280,1200,1100')
  .split(',')
  .map(Number);

let failures = 0;
let checks = 0;
const lines = [];

function say(line) {
  lines.push(line);
  console.log(line);
}

function check(label, actual, expected, tolerance = 0.6) {
  checks++;
  const ok =
    typeof expected === 'number' && typeof actual === 'number'
      ? Math.abs(actual - expected) <= tolerance
      : actual === expected;
  if (!ok) {
    failures++;
    say(`  FAIL  ${label}: got ${actual}, expected ${expected}`);
  } else {
    say(`  ok    ${label}: ${actual}`);
  }
  return ok;
}

/**
 * The largest amount by which any descendant's box escapes its
 * card's border box. Content inside a scrollable box is NOT an
 * escape — a table that scrolls inside its card is a correct
 * layout, not a broken one.
 */
const OVERFLOW_PROBE = () => {
  const round = (n) => +n.toFixed(1);
  const cards = [...document.querySelectorAll('.workspace .card')].map((card) => {
    const c = card.getBoundingClientRect();
    const name =
      [...card.classList].filter((k) => k !== 'card').join('.') || 'card';
    let worst = 0;
    let worstSel = null;
    card.querySelectorAll('*').forEach((el) => {
      let p = el.parentElement;
      let scrollable = false;
      while (p && p !== card) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') {
          scrollable = true;
          break;
        }
        p = p.parentElement;
      }
      if (scrollable) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const over = Math.max(
        c.left - r.left,
        r.right - c.right,
        c.top - r.top,
        r.bottom - c.bottom,
      );
      if (over > worst) {
        worst = over;
        worstSel =
          el.tagName.toLowerCase() +
          (typeof el.className === 'string' && el.className
            ? '.' + el.className.trim().split(/\s+/).join('.')
            : '');
      }
    });
    return {
      name,
      w: round(c.width),
      h: round(c.height),
      maxOverflow: round(worst),
      worstSel,
    };
  });
  return {
    doc: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    },
    cards,
  };
};

/** The strip's five cards, with their card-relative text/tile boxes. */
const STRIP_PROBE = () => {
  const host = document.querySelector('[data-testid="admin-stat-strip"]');
  if (!host) return null;
  const round = (n) => +n.toFixed(1);
  const inkBox = (el) => {
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    const b = range.getBoundingClientRect();
    return { l: round(b.left), r: round(b.right), w: round(b.width) };
  };
  const cards = [...host.querySelectorAll('article.card')].map((card) => {
    const c = card.getBoundingClientRect();
    const label = card.querySelector('.label');
    const value = card.querySelector('.value');
    const tile = card.querySelector('.tile');
    const rel = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return {
        l: round(b.left - c.left),
        r: round(b.right - c.left),
        w: round(b.width),
        h: round(b.height),
        t: round(b.top - c.top),
      };
    };
    const lBox = label?.getBoundingClientRect();
    return {
      isTotal: card.classList.contains('total'),
      labelText: label?.textContent?.trim() ?? '',
      valueText: value?.textContent?.trim() ?? '',
      w: round(c.width),
      h: round(c.height),
      labelBox: rel(label),
      labelInk: inkBox(label),
      valueBox: rel(value),
      tile: rel(tile),
      // A clipped label is one whose ink is wider than its box.
      labelClipped:
        !!label &&
        !!lBox &&
        label.scrollWidth > Math.ceil(lBox.width) + 0.5,
      labelScrollW: label?.scrollWidth ?? null,
      labelClientW: label?.clientWidth ?? null,
    };
  });
  return { cards };
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 1024 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').first().fill('admin@company.com');
    await page
      .locator('input[type="password"]')
      .first()
      .fill('password123');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), {
      timeout: 30_000,
    });
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="admin-recent-tickets"]', {
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    const strip = await page.evaluate(STRIP_PROBE);
    const overflow = await page.evaluate(OVERFLOW_PROBE);

    results[width] = { strip, overflow };

    say(`\n══ ${width}px ══`);

    /* The document must never scroll sideways. */
    check(
      'document does not scroll sideways',
      overflow.doc.scrollWidth,
      overflow.doc.clientWidth,
      0.5,
    );

    /* No card's content may hang outside its own card. */
    for (const card of overflow.cards) {
      check(
        `${card.name} content stays inside its card`,
        card.maxOverflow,
        0,
        0.5,
      );
    }

    /* The strip's five labels must be present and unclipped. */
    if (strip) {
      check('stat strip card count', strip.cards.length, 5);
      strip.cards.forEach((card, i) => {
        check(
          `strip card ${i} label`,
          card.labelText,
          REF.strip.labels[i],
        );
        check(
          `strip card ${i} label is not clipped`,
          card.labelClipped,
          false,
        );
      });
    }

    /* At the reference's width the geometry must match exactly. */
    if (width === 1536) {
      say('  ── reference geometry ──');
      const stripCards = strip.cards;

      stripCards.forEach((card, i) => {
        check(
          `strip card ${i} width`,
          card.w,
          REF.strip.widths[i],
          REF.strip.widthTolerance,
        );
        check(
          `strip card ${i} height`,
          card.h,
          REF.strip.cardHeight,
          0.6,
        );
        check(
          `strip card ${i} text left`,
          card.labelBox?.l,
          card.isTotal ? REF.strip.textLeft.total : REF.strip.textLeft.status,
          0.6,
        );
        check('strip card ' + i + ' tile left', card.tile?.l, REF.strip.tileLeft, 0.6);
        check('strip card ' + i + ' tile width', card.tile?.w, REF.strip.tileSize, 0.6);
      });

      /* The row-2 and row-3 card widths. */
      const byName = (n) => overflow.cards.find((c) => c.name === n);
      check(
        'Recent Tickets card width',
        byName('recent-tickets')?.w,
        REF.row2.widths[0],
        0.6,
      );
      check(
        'Users Overview card width',
        byName('users-overview')?.w,
        REF.row2.widths[1],
        0.6,
      );
      check('Ticket Trends card width', byName('trends')?.w, REF.row3.widths[0], 0.6);
      check(
        'Priority Distribution card width',
        byName('priority')?.w,
        REF.row3.widths[1],
        0.6,
      );
      check(
        'Recent Users card width',
        byName('recent-users')?.w,
        REF.row3.widths[2],
        0.6,
      );

      /* The Recent Tickets table keeps the reference's column
         geometry and scrolls inside its card rather than clipping. */
      const table = await page.evaluate(() => {
        const wrap = document.querySelector(
          '[data-testid="admin-recent-tickets"] .table-wrap',
        );
        const tbl = document.querySelector(
          '[data-testid="admin-recent-tickets"] .tickets-table',
        );
        if (!wrap || !tbl) return null;
        const cols = [...tbl.querySelectorAll('colgroup col')].map((c) =>
          Math.round(c.getBoundingClientRect().width),
        );
        return {
          clientW: wrap.clientWidth,
          scrollW: wrap.scrollWidth,
          overflowX: getComputedStyle(wrap).overflowX,
          tableW: Math.round(tbl.getBoundingClientRect().width),
          cols,
        };
      });
      if (table) {
        check(
          'Recent Tickets table width',
          table.tableW,
          816,
          0.6,
        );
        check(
          'Recent Tickets column tracks',
          JSON.stringify(table.cols),
          JSON.stringify([107, 228, 108, 100, 160, 113]),
        );
        check(
          'Recent Tickets table scrolls inside its card',
          table.overflowX,
          'auto',
        );
      } else {
        check('Recent Tickets table found', false, true);
      }
    } else {
      /* Below the reference's width the table must scroll inside
         its card rather than being cut off. */
      const table = await page.evaluate(() => {
        const wrap = document.querySelector(
          '[data-testid="admin-recent-tickets"] .table-wrap',
        );
        if (!wrap) return null;
        return {
          clientW: wrap.clientWidth,
          scrollW: wrap.scrollWidth,
          overflowX: getComputedStyle(wrap).overflowX,
        };
      });
      if (table) {
        check(
          'Recent Tickets table scrolls inside its card',
          table.overflowX,
          'auto',
        );
      }
    }

    await context.close();
  }

  await browser.close();

  say(`\n══ ${checks - failures}/${checks} checks passed ══\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'verify-admin-workspace.json'),
    JSON.stringify({ results, checks, failures }, null, 1),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'verify-admin-workspace.txt'),
    lines.join('\n') + '\n',
  );

  process.exit(failures === 0 ? 0 : 1);
})();
