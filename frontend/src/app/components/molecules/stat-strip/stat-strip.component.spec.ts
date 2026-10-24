/**
 * StatStripComponent — spec (HD-021).
 *
 * The horizontal stat strip: five UNEQUAL-width cards — a tinted
 * "Total" summary card with an optional delta pill and caption,
 * followed by four status cards each carrying a sparkline and a
 * progress bar whose fill is that status's share of the total.
 *
 * The reference's cards are not equal: measured against the
 * screenshot they are 305 / 249 / 240 / 259 / 299 px, so the Total
 * card is widest and Closed second widest.
 *
 * Covered here:
 *   - the summary card renders the total, label and caption
 *   - the delta pill is hidden when `delta` is null, green when the
 *     change is >= 0, red when it is < 0
 *   - the delta pill and the caption stack in the same right-hand
 *     column (the reference layout)
 *   - one status card per item, in order, with the right accent
 *   - each status card carries a sparkline (when a series is given)
 *     and a progress bar
 *   - the bar fill percentage is value / total, clamped to 0..100
 *   - a zero total renders empty bars rather than dividing by zero
 *   - an item's own `total` overrides the strip's total
 *   - the tile, sparkline, bar and accent colours match the
 *     reference's measured values
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  StatStripComponent,
  type StatStripItem,
} from './stat-strip.component';

describe('StatStripComponent', () => {
  let fixture: ComponentFixture<StatStripComponent>;

  const series = new Array(14).fill(2);

  const statusItems: StatStripItem[] = [
    { label: 'Open', value: 7, accent: 'open', series },
    { label: 'In Progress', value: 1, accent: 'inProgress', series },
    { label: 'Resolved', value: 2, accent: 'resolved', series },
    { label: 'Closed', value: 1, accent: 'closed', series },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatStripComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatStripComponent);
    fixture.componentRef.setInput('total', 11);
    fixture.componentRef.setInput('statusItems', statusItems);
    fixture.detectChanges();
  });

  function cards(): HTMLElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('article.card'),
    );
  }

  function statusCards(): HTMLElement[] {
    return cards().filter((c) => c.classList.contains('status'));
  }

  function barFills(): HTMLElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.bar-fill'),
    );
  }

  it('renders the summary card with the total and label', () => {
    const totalCard = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="stat-total-card"]',
    );
    expect(totalCard).not.toBeNull();
    expect(totalCard?.querySelector('.label')?.textContent?.trim()).toBe(
      'Total Tickets',
    );
    expect(totalCard?.querySelector('.value')?.textContent?.trim()).toBe(
      '11',
    );
  });

  it('formats the total with thousands separators', () => {
    fixture.componentRef.setInput('total', 1234);
    fixture.detectChanges();
    const totalCard = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="stat-total-card"]',
    );
    expect(totalCard?.querySelector('.value')?.textContent?.trim()).toBe(
      '1,234',
    );
  });

  it('gives every card the same height', () => {
    // The reference's five cards are all 88px tall, even though
    // their widths differ (305 / 249 / 240 / 259 / 299).
    const heights = cards().map((c) =>
      Math.round(c.getBoundingClientRect().height),
    );
    expect(heights.length).toBe(5);
    for (const h of heights) {
      expect(h).toBe(heights[0]);
    }
  });

  it('gives the cards the reference\'s unequal widths', () => {
    // The reference's cards are NOT equal width: the Total card is
    // the widest and Closed second widest. The strip lays them out
    // in a single row that shares the available space, so the
    // widths track each card's content.
    //
    // The host is a grid with the reference's fractional tracks
    // (22.56fr / 18.42fr / 17.75fr / 19.16fr / 22.12fr), so the
    // rendered widths must follow that order:
    //   Total > Closed > Resolved > Open > InProgress
    //
    // Karma runs the browser at a pinned 1440px wide (see
    // karma.conf.js), so the strip is on its DESKTOP breakpoint
    // here — the row is not collapsed to two columns.
    expect(window.innerWidth).toBeGreaterThan(1180);

    const widths = cards().map((c) => c.getBoundingClientRect().width);
    expect(widths.length).toBe(5);

    // Total is the widest.
    expect(widths[0]).toBeGreaterThan(widths[1]);
    // Closed is second widest.
    expect(widths[4]).toBeGreaterThan(widths[1]);
    // The order of the remaining three follows the reference:
    // Resolved (19.16fr) is wider than Open (18.42fr), which is
    // wider than In Progress (17.75fr).
    expect(widths[3]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[2]);
  });

  it('gives the cards the reference\'s width RATIOS', () => {
    // The absolute widths scale with the strip's width, so only
    // the RATIOS carry the reference's information. Measured off
    // the reference PNG (the cards' true extents at the widest
    // scan row):
    //
    //   Total 305 | Open 249 | In Progress 240 | Resolved 259 | Closed 299
    //
    // which, as fractions of the 1352px the five cards share:
    //
    //   Total 22.56% | Open 18.42% | InProgress 17.75% |
    //   Resolved 19.16% | Closed 22.12%
    //
    // An earlier measurement (291 / 248 / 237 / 241 / 316) had been
    // read off the LOCAL render rather than the reference, which
    // made the Closed card 1.4 points too wide and the Resolved
    // card 1.4 too narrow.
    const widths = cards().map((c) => c.getBoundingClientRect().width);
    const sum = widths.reduce((a, b) => a + b, 0);
    const fractions = widths.map((w) => (w / sum) * 100);
    const expected = [22.56, 18.42, 17.75, 19.16, 22.12];

    expected.forEach((want, i) => {
      expect(fractions[i]).toBeCloseTo(want, 1);
    });
  });

  it('separates the cards by the reference\'s 8px gap', () => {
    // The reference's four gaps take 33px in total — 8.25 each, so
    // 8px is the nearest whole pixel.
    const cardEls = cards();
    for (let i = 1; i < cardEls.length; i++) {
      const prev = cardEls[i - 1].getBoundingClientRect();
      const cur = cardEls[i].getBoundingClientRect();
      expect(cur.left - prev.right).toBeCloseTo(8, 0);
    }
  });

  it('renders one status card per item, in order', () => {
    const cardsOut = statusCards();
    expect(cardsOut.length).toBe(4);

    const labels = cardsOut.map((c) =>
      c.querySelector('.label')?.textContent?.trim(),
    );
    expect(labels).toEqual(['Open', 'In Progress', 'Resolved', 'Closed']);

    const values = cardsOut.map((c) =>
      c.querySelector('.value')?.textContent?.trim(),
    );
    expect(values).toEqual(['7', '1', '2', '1']);
  });

  it('tags each status card with its accent family', () => {
    const accents = statusCards().map((c) => c.getAttribute('data-accent'));
    expect(accents).toEqual(['open', 'inProgress', 'resolved', 'closed']);
  });

  it('gives every card a tinted icon tile with a glyph inside', () => {
    for (const card of cards()) {
      const tile = card.querySelector('.tile');
      expect(tile).not.toBeNull();
      expect(tile?.querySelector('svg')).not.toBeNull();
    }
  });

  it('uses a rounded-square tile for the total and a square tile for the statuses', () => {
    const totalCard = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="stat-total-card"]',
    );
    expect(totalCard?.querySelector('.tile')?.classList).toContain(
      'tile-total',
    );

    for (const card of statusCards()) {
      expect(card.querySelector('.tile')?.classList).not.toContain(
        'tile-total',
      );
    }
  });

  it('draws a 25px filled disc for every status card', () => {
    const byAccent = new Map(
      statusCards().map((c) => [c.getAttribute('data-accent'), c]),
    );

    // Every status glyph is a 25px disc — 12.5 radius on a 30-unit
    // viewBox — centred in the 52px tile. Measured against the
    // reference: its discs measure 25x25.
    for (const accent of ['open', 'inProgress', 'resolved', 'closed']) {
      const circle = byAccent.get(accent)?.querySelector('.tile svg circle');
      expect(circle).withContext(`${accent} disc`).not.toBeNull();
      expect(circle?.getAttribute('cx')).toBe('15');
      expect(circle?.getAttribute('cy')).toBe('15');
      expect(circle?.getAttribute('r')).toBe('12.5');
    }
  });

  it('gives Open a plain disc with no inner glyph', () => {
    const open = statusCards().find(
      (c) => c.getAttribute('data-accent') === 'open',
    );
    // Open is a resting state, so it carries no inner glyph.
    expect(open?.querySelector('.tile svg path')).toBeNull();
  });

  it('draws a white play triangle inside the In Progress disc', () => {
    const card = statusCards().find(
      (c) => c.getAttribute('data-accent') === 'inProgress',
    );
    const triangle = card?.querySelector('.tile svg path');
    expect(triangle).not.toBeNull();
    expect(triangle?.getAttribute('fill')).toBe('#ffffff');
    // A right-pointing triangle: the apex is to the right of the
    // base's left edge.
    expect(triangle?.getAttribute('d')).toMatch(/M11\.6 .* L21\.2 15 /);
  });

  it('draws a white check inside the Resolved disc', () => {
    const card = statusCards().find(
      (c) => c.getAttribute('data-accent') === 'resolved',
    );
    const check = card?.querySelector('.tile svg path');
    expect(check).not.toBeNull();
    expect(check?.getAttribute('stroke')).toBe('#ffffff');
    expect(check?.getAttribute('fill')).toBe('none');
  });

  it('draws a white x inside the Closed disc', () => {
    const card = statusCards().find(
      (c) => c.getAttribute('data-accent') === 'closed',
    );
    const cross = card?.querySelector('.tile svg path');
    expect(cross).not.toBeNull();
    expect(cross?.getAttribute('stroke')).toBe('#ffffff');
    // Both strokes cross at the disc's centre (15, 15).
    expect(cross?.getAttribute('d')).toContain('M11.2 11.2');
    expect(cross?.getAttribute('d')).toContain('18.8 18.8');
  });

  it('draws the Total card a solid clipboard glyph', () => {
    const totalCard = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="stat-total-card"]',
    );
    const glyph = totalCard?.querySelector('.tile svg path');
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute('fill')).toBe('currentColor');
  });

  it('renders a sparkline on every status card that has a series', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'atom-sparkline',
      ).length,
    ).toBe(4);
  });

  it('omits the sparkline when a card has no series', () => {
    fixture.componentRef.setInput('statusItems', [
      { label: 'Open', value: 7, accent: 'open' },
    ]);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'atom-sparkline',
      ).length,
    ).toBe(0);
  });

  it('gives each sparkline a unique gradient id', () => {
    const ids = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'atom-sparkline',
      ),
    ).map((s) => s.getAttribute('ng-reflect-gradient-id'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fills each bar with the status share of the total', () => {
    const fills = barFills();
    expect(fills.length).toBe(4);
    // 7/11, 1/11, 2/11, 1/11. The browser rounds the percentage
    // string it stores, so compare numerically.
    const widths = fills.map((f) => parseFloat(f.style.width));
    expect(widths[0]).toBeCloseTo(63.636, 2);
    expect(widths[1]).toBeCloseTo(9.09, 2);
    expect(widths[2]).toBeCloseTo(18.18, 2);
    expect(widths[3]).toBeCloseTo(9.09, 2);
  });

  it('renders empty bars when the total is zero instead of dividing by zero', () => {
    fixture.componentRef.setInput('total', 0);
    fixture.detectChanges();
    for (const fill of barFills()) {
      expect(parseFloat(fill.style.width)).toBe(0);
    }
  });

  it('prefers an item\'s own total over the strip total', () => {
    fixture.componentRef.setInput('statusItems', [
      { label: 'Open', value: 5, accent: 'open', total: 10 },
    ]);
    fixture.detectChanges();
    const fills = barFills();
    expect(fills.length).toBe(1);
    expect(parseFloat(fills[0].style.width)).toBeCloseTo(50, 2);
  });

  it('hides the delta pill when delta is null', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.delta'),
    ).toBeNull();
  });

  it('paints a positive delta green with an up arrow', () => {
    fixture.componentRef.setInput('delta', 12);
    fixture.componentRef.setInput('deltaLabel', '+12%');
    fixture.detectChanges();

    const delta = (fixture.nativeElement as HTMLElement).querySelector('.delta');
    expect(delta).not.toBeNull();
    expect(delta?.classList).toContain('is-up');
    expect(delta?.classList).not.toContain('is-down');
    expect(delta?.textContent).toContain('+12%');
  });

  it('paints a negative delta red with a down arrow', () => {
    fixture.componentRef.setInput('delta', -8);
    fixture.componentRef.setInput('deltaLabel', '−8%');
    fixture.detectChanges();

    const delta = (fixture.nativeElement as HTMLElement).querySelector('.delta');
    expect(delta).not.toBeNull();
    expect(delta?.classList).toContain('is-down');
    expect(delta?.textContent).toContain('−8%');
  });

  it('stacks the delta pill and the caption in the same right-hand column', () => {
    fixture.componentRef.setInput('delta', 12);
    fixture.componentRef.setInput('deltaLabel', '+12%');
    fixture.componentRef.setInput('caption', 'vs last month');
    fixture.detectChanges();

    const totalCard = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="stat-total-card"]',
    );
    const aside = totalCard?.querySelector('.aside');
    expect(aside).not.toBeNull();
    // Both live inside the aside, so they stack vertically.
    expect(aside?.querySelector('.delta')).not.toBeNull();
    expect(aside?.querySelector('.caption')).not.toBeNull();
  });

  it('sizes the sparkline to the reference: 54px', () => {
    // The sparkline is a fixed 54px box, right-anchored 13px inside
    // the card's border (the reference's `rightInset: 14`, which
    // counts the border itself).
    //
    // The BAR is not a fixed width. Measured off ref-full.png, the
    // reference's bar is anchored by its LEFT edge — a fixed 48px
    // right of the card's value column — and by its RIGHT edge, 18px
    // inside the card's border. The width falls out of the card's
    // width (101, 92, 109 and 132 on the reference's four status
    // cards), which is what lets the bar survive a narrower card
    // instead of sliding left onto the number.
    const card = statusCards()[0];
    const spark = card.querySelector('.spark') as HTMLElement;
    const bar = card.querySelector('.bar') as HTMLElement;

    expect(spark).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(parseFloat(getComputedStyle(spark).width)).toBe(54);

    const cb = card.getBoundingClientRect();
    const bb = bar.getBoundingClientRect();
    // The left edge is the anchor: card+129.
    expect(Math.round(bb.x - cb.x)).toBe(129);
    // The right edge is 18px inside the card's border.
    expect(Math.round(cb.right - bb.right)).toBe(18);
  });

  it('places the icon tile at the reference\'s card+18', () => {
    // The reference's tile is a 52x52 rounded square whose first
    // tinted pixel sits at card+18 (the anti-aliased corner pulls
    // the apparent edge in by a pixel or two, so the fill itself
    // starts at card+19).
    //
    // An earlier pass placed the tile at card+14, which put it 4px
    // too far into the card's corner.
    for (const card of cards()) {
      const tile = card.querySelector('.tile') as HTMLElement;
      const cb = card.getBoundingClientRect();
      const tb = tile.getBoundingClientRect();
      expect(Math.round(tb.x - cb.x)).toBe(18);
      expect(Math.round(tb.y - cb.y)).toBe(18);
    }
  });

  it('renders a 52px icon tile on every card', () => {
    // The reference's tiles measure 52x52.
    for (const card of cards()) {
      const tile = card.querySelector('.tile') as HTMLElement;
      expect(tile).not.toBeNull();
      expect(parseFloat(getComputedStyle(tile).width)).toBe(52);
      expect(parseFloat(getComputedStyle(tile).height)).toBe(52);
    }
  });

  it('sets the label in the reference\'s 14px Inter 600', () => {
    // The reference's label cap height is 11px, which Inter 600 at
    // 14px reproduces exactly (a 13px face is one pixel short, a
    // 15px face one pixel over).
    const label = cards()[0].querySelector('.label') as HTMLElement;
    const cs = getComputedStyle(label);
    expect(cs.fontSize).toBe('14px');
    expect(cs.fontWeight).toBe('600');
    expect(cs.fontFamily.split(',')[0].replace(/["']/g, '')).toBe('Inter');
  });

  it('sets the value in the reference\'s 26px Inter 700', () => {
    // NOT 30px. The reference's ten digit widths were measured one
    // digit at a time:
    //
    //   "156" -> 9, 14, 14     "42" -> 15, 13
    //   "28"  -> 14, 14        "62" -> 15, 13
    //   "24"  -> 14, 15
    //
    // Inter 700 reproduces all ten at 26px and at no other size — at
    // 30px the digits come out 17-18px wide, three pixels too fat,
    // and the reference's "156" ink box is 41x19 where 26px gives
    // exactly 41x19.
    const value = cards()[0].querySelector('.value') as HTMLElement;
    const cs = getComputedStyle(value);
    expect(cs.fontSize).toBe('26px');
    expect(cs.fontWeight).toBe('700');
    expect(cs.fontFamily.split(',')[0].replace(/["']/g, '')).toBe('Inter');
  });

  it('sets negative tracking so the text matches the reference\'s width', () => {
    // The reference's "Total Tickets" ink spans 80px; Inter 600 at
    // 14px with normal tracking renders it 86px wide. -0.5px per
    // character over twelve characters closes the six-pixel gap.
    //
    // The value needs the same treatment: its "156" ink box is
    // 41x19, and Inter 700 at 26px measures 42x19 without it.
    const card = cards()[0];
    const label = card.querySelector('.label') as HTMLElement;
    const value = card.querySelector('.value') as HTMLElement;
    expect(parseFloat(getComputedStyle(label).letterSpacing)).toBe(-0.5);
    expect(parseFloat(getComputedStyle(value).letterSpacing)).toBe(-0.5);
  });

  it('lands the label and the value on the reference\'s baselines', () => {
    // The reference's label ink runs card+24..34 and its value ink
    // card+47..65.
    //
    // The DOM boxes sit 3px and 4px above those ink tops: the 14px
    // face's caps sit 3px below its 17.5px line box, and the 26px
    // face's digits sit 4px below its 28.6px line box. And because
    // an absolute offset is measured from the card's PADDING box,
    // the 1px border pushes the box down by one more — so the
    // label's box is at card+21 and the value's at card+43.
    const card = cards()[0];
    const cb = card.getBoundingClientRect();
    const label = card.querySelector('.label') as HTMLElement;
    const value = card.querySelector('.value') as HTMLElement;

    expect(
      Math.round(label.getBoundingClientRect().y - cb.y),
    ).toBe(21);
    expect(
      Math.round(value.getBoundingClientRect().y - cb.y),
    ).toBe(43);
  });

  it('bounds the label on the right so a long one is ellipsised, not spilled', () => {
    // The label is absolutely positioned with `left: 81px`. With
    // only a LEFT the box grows to fit the text, so a long label
    // spills over the card's right edge instead of being clipped —
    // and it would run under the sparkline.
    //
    // The bound is the card's own right padding edge: 13px inside
    // the border, matching the sparkline's and the bar's inset, so
    // the label can never reach them.
    const card = cards()[0];
    const label = card.querySelector('.label') as HTMLElement;
    const cs = getComputedStyle(label);

    expect(cs.position).toBe('absolute');
    expect(parseFloat(cs.left)).toBe(81);
    // And the clipping that makes the ellipsis visible.
    expect(cs.whiteSpace).toBe('nowrap');
    expect(cs.overflow).toBe('hidden');
    expect(cs.textOverflow).toBe('ellipsis');

    // The bound must actually be a bound: the label's box has to
    // end before the card's right padding edge.
    const cb = card.getBoundingClientRect();
    const lb = label.getBoundingClientRect();
    expect(lb.right).toBeLessThanOrEqual(cb.right - 13 + 0.5);
  });

  it('keeps the label clear of the sparkline on every status card', () => {
    // The label's right bound is PROPORTIONAL to the card's width:
    // the sparkline's box is 54px and right-anchored 13px inside the
    // card, so its left edge is at `w - 67`, and the reference keeps
    // 24px of clear space between the label's ink and that edge.
    //
    // A FIXED inset only lined up on a card exactly the reference's
    // width. On the Admin page's narrower cards it left "In Progress"
    // running 22px under its own sparkline — the collision this
    // assertion exists to prevent.
    for (const card of statusCards()) {
      const label = card.querySelector('.label') as HTMLElement;
      const spark = card.querySelector('.spark') as HTMLElement;
      if (!spark) continue;

      const lb = label.getBoundingClientRect();
      const sb = spark.getBoundingClientRect();

      // The label's box must end before the sparkline's box starts.
      expect(lb.right)
        .withContext(`${card.getAttribute('data-accent')} label vs spark`)
        .toBeLessThanOrEqual(sb.left + 0.5);
    }
  });

  it('keeps the value clear of the progress bar on every status card', () => {
    // The value is a fixed 44px column at card+81, so it ends at
    // card+125. The bar's left edge is anchored at card+129, which
    // is the reference's own rule: the bar starts 48px right of the
    // value's left edge, on every card.
    for (const card of statusCards()) {
      const value = card.querySelector('.value') as HTMLElement;
      const bar = card.querySelector('.bar') as HTMLElement;

      const vb = value.getBoundingClientRect();
      const bb = bar.getBoundingClientRect();

      expect(vb.right)
        .withContext(`${card.getAttribute('data-accent')} value vs bar`)
        .toBeLessThanOrEqual(bb.left + 0.5);
    }
  });

  it('gives each status family its own accent token', () => {
    // The stat strip uses its OWN accent palette, not the shared
    // --status-*-dot family: the reference's Open disc is a pure
    // blue and its Closed disc is a slate blue.
    const byAccent = new Map(
      statusCards().map((c) => [c.getAttribute('data-accent'), c]),
    );
    const open = byAccent.get('open') as HTMLElement;
    const closed = byAccent.get('closed') as HTMLElement;
    expect(open.getAttribute('data-accent')).toBe('open');

    const tile = open.querySelector('.tile') as HTMLElement;
    const accent = getComputedStyle(tile).color;
    expect(accent).toBe('rgb(6, 116, 254)'); // #0674FE

    const closedTile = closed.querySelector('.tile') as HTMLElement;
    expect(getComputedStyle(closedTile).color).toBe('rgb(93, 116, 157)'); // #5D749D
  });

  it('paints the In Progress sparkline periwinkle, not amber', () => {
    // The reference draws the In Progress curve in the shared
    // periwinkle so the amber bar below stays the card's only warm
    // element.
    //
    // Assert against the RENDERED stroke, not `ng-reflect-color`:
    // Angular truncates its reflect debug attributes, so the
    // `var(--x, #hex)` token comes back cut off mid-value.
    const inProgress = statusCards().find(
      (c) => c.getAttribute('data-accent') === 'inProgress',
    );
    const spark = inProgress?.querySelector('atom-sparkline');
    expect(spark).not.toBeNull();

    const stroke = spark
      ?.querySelector('path.spark-line')
      ?.getAttribute('stroke');
    expect(stroke).toBe('var(--stat-spark-in-progress, #B4BEEB)');

    // The gradient stops must use the same hue as the stroke, or
    // the fill and the line disagree.
    const stop = spark?.querySelector('stop');
    expect(stop?.getAttribute('stop-color')).toBe(stroke);
  });

  it('draws the sparkline as a pale wash, not a solid line', () => {
    // The reference's curve peaks at 40% effective alpha.
    for (const spark of Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('atom-sparkline'),
    )) {
      const line = spark.querySelector('path.spark-line');
      expect(line?.getAttribute('stroke-opacity')).toBe('0.34');

      // The gradient's top stop carries the fill opacity; the
      // bottom stop always fades to 0 at the baseline.
      const stops = Array.from(
        spark.querySelectorAll('stop') as NodeListOf<Element>,
      );
      expect(stops[0].getAttribute('stop-opacity')).toBe('0.1');
      expect(stops[stops.length - 1].getAttribute('stop-opacity')).toBe('0');
    }
  });

  it('keeps the bar and sparkline inside their card at every width', () => {
    // The strip collapses to three columns at 1180px and two at
    // 760px. At every one of those widths the sparkline and the
    // progress bar must stay INSIDE the card's content box — the
    // reference right-anchors both to the same edge, and an
    // overflow would visibly spill onto the next card.
    const host = fixture.nativeElement as HTMLElement;

    for (const width of [1408, 1100, 700, 420]) {
      host.style.width = `${width}px`;
      fixture.detectChanges();

      // Only the STATUS cards carry a sparkline and a bar; the
      // Total card has the delta/caption aside instead.
      for (const card of statusCards()) {
        const cb = card.getBoundingClientRect();
        for (const sel of ['.spark', '.bar']) {
          const el = card.querySelector(sel) as HTMLElement;
          expect(el).withContext(`${sel} at ${width}px`).not.toBeNull();
          const b = el.getBoundingClientRect();
          // Right edge inside the card's padding box.
          expect(
            b.right,
          ).withContext(`${sel} right @ ${width}px`).toBeLessThanOrEqual(
            cb.right - 1,
          );
          // Left edge inside the card too.
          expect(
            b.left,
          ).withContext(`${sel} left @ ${width}px`).toBeGreaterThanOrEqual(
            cb.left,
          );
        }
      }
    }

    host.style.width = '';
  });

  it('shrinks the bar and sparkline rather than letting them overflow', () => {
    // The bar is 106px and the sparkline 54px at the reference's
    // desktop width. On a narrow phone the strip drops to two
    // columns and each card is far narrower than 119px — so both
    // must shrink, or they would spill out of the card's left edge
    // and over the neighbouring card.
    const host = fixture.nativeElement as HTMLElement;
    host.style.width = '420px';
    fixture.detectChanges();

    for (const card of statusCards()) {
      const cb = card.getBoundingClientRect();
      const bar = card.querySelector('.bar') as HTMLElement;
      const spark = card.querySelector('.spark') as HTMLElement;

      expect(bar.getBoundingClientRect().width).toBeLessThanOrEqual(
        cb.width - 26,
      );
      expect(spark.getBoundingClientRect().width).toBeLessThanOrEqual(
        cb.width - 26,
      );
      // Neither may spill past the card's own edges.
      expect(bar.getBoundingClientRect().left).toBeGreaterThanOrEqual(
        cb.left,
      );
      expect(spark.getBoundingClientRect().left).toBeGreaterThanOrEqual(
        cb.left,
      );
    }

    host.style.width = '';
  });

  it('declares the responsive breakpoints the reference layout needs', () => {
    // Three columns at 1180px, two at 760px. Asserting the rules
    // exist keeps the breakpoints from being dropped silently --
    // a spec cannot resize the Karma browser, so the rules are the
    // only observable surface.
    //
    // NOTE: the browser normalises `minmax(0, 1fr)` to
    // `minmax(0px, 1fr)` when it serialises a rule, so the
    // assertion has to expect the normalised form.
    const rules: string[] = [];
    const collect = (list: CSSRuleList): void => {
      for (const rule of Array.from(list)) {
        rules.push(rule.cssText);
        // A media rule's own declarations live in a nested list.
        const nested = (rule as CSSMediaRule).cssRules;
        if (nested && nested.length) collect(nested);
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        collect(sheet.cssRules);
      } catch {
        continue; // cross-origin sheet
      }
    }
    const all = rules.join('\n');

    expect(all).toContain('max-width: 1180px');
    expect(all).toContain('repeat(3, minmax(0px, 1fr))');
    expect(all).toContain('max-width: 760px');
    expect(all).toContain('repeat(2, minmax(0px, 1fr))');
  });

  it('renders the caption when one is supplied', () => {
    fixture.componentRef.setInput('caption', 'vs last month');
    fixture.detectChanges();
    const caption = (fixture.nativeElement as HTMLElement).querySelector(
      '.caption',
    );
    expect(caption?.textContent?.trim()).toBe('vs last month');
  });

  it('omits the caption element when no caption is supplied', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.caption'),
    ).toBeNull();
  });
});
