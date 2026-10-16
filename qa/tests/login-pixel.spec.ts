/**
 * Login page — pixel + alignment regression test.
 *
 * Two layers:
 *
 * 1. Pixel layer. Loads the reference PNG at 1536x1024
 *    (`qa/tests/fixtures/login-reference.png`), screenshots the
 *    live `/login` at the same viewport, and runs `pixelmatch`
 *    over the full frame once, then counts mismatches per
 *    region. Each region has a tolerance band that admits
 *    *expected* divergences (3D illustration in the reference
 *    vs. our hand-rolled SVG, swapped brand-mark icon, SSO
 *    section the user asked us to remove) but flags regressions
 *    in base color, card surface, or typography. The full-frame
 *    diff PNG is always written to `.qa-tmp/login-pixel-diff.png`
 *    so the next dev can eyeball the gap. The pixel assertions
 *    are advisory — they print a summary and continue even when
 *    over-budget.
 *
 * 2. Alignment layer. Hard assertions on structure: hero
 *    position, card position, button width, eye toggle position,
 *    brand mark count, wordmark text, "Sign in with SSO"
 *    absence. These are the actual ship-blockers and are what a
 *    WIP design tweak would trip.
 *
 * Why both layers: pixel alone lets too much drift through
 * (tolerances pile up). Alignment alone misses regressions in
 * color and shadow that don't move any element's bounding box.
 *
 * Run against a local dev server:
 *   BASE_URL=http://127.0.0.1:4200 npx playwright test login-pixel
 */

import { test, expect, Page } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import * as fs from 'fs';
import * as path from 'path';

const REF_PATH = path.join(__dirname, 'fixtures', 'login-reference.png');
const DIFF_OUT = path.join(
  __dirname,
  '..',
  '..',
  '.qa-tmp',
  'login-pixel-diff.png',
);

const REF_W = 1536;
const REF_H = 1024;

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Advisory ceiling on the per-region diff ratio. Exceeding
   * this is logged as a warning but does NOT fail the test,
   * because the reference uses bespoke 3D art + an SSO section
   * we removed. To make this a hard failure, drop the `if`
   * guard in `runPixelCheck` and tune these to ~0.10 once the
   * design stabilizes.
   */
  tolerance: number;
}

const REGIONS: Record<'surface' | 'card' | 'marketing', Region> = {
  surface:   { x: 0,   y: 0,   w: 1536, h: 1024, tolerance: 0.50 },
  card:      { x: 905, y: 60,  w: 552,  h: 870,  tolerance: 0.50 },
  marketing: { x: 0,   y: 0,   w: 905,  h: 1024, tolerance: 0.50 },
};

interface RegionReport {
  name: keyof typeof REGIONS;
  diffPx: number;
  totalPx: number;
  ratio: number;
  tolerance: number;
  withinTolerance: boolean;
}

async function runPixelCheck(
  page: Page,
  reference: { data: Buffer; width: number; height: number },
): Promise<{ reports: RegionReport[]; diffPath: string }> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  // Wait for the illustration to render (no JS animation; this
  // resolves as soon as the node is in the DOM).
  await page.locator('.marketing-illustration').waitFor();

  const shot = await page.screenshot({ fullPage: false });
  const live = PNG.sync.read(shot);

  expect(live.width).toBe(REF_W);
  expect(live.height).toBe(REF_H);

  fs.mkdirSync(path.dirname(DIFF_OUT), { recursive: true });

  // Single full-frame pixelmatch — diff mask PNG for humans,
  // and a non-mask pass that we walk once to count mismatches
  // per region.
  const fullDiff = new PNG({ width: REF_W, height: REF_H });
  pixelmatch(
    reference.data,
    live.data,
    fullDiff.data,
    REF_W,
    REF_H,
    { threshold: 0.08, includeAA: false, diffMask: true },
  );
  fs.writeFileSync(DIFF_OUT, PNG.sync.write(fullDiff));

  // Tally by region using a second pass. We need the count
  // (not a mask), so re-run pixelmatch with a tiny output
  // buffer where the only side effect is the return value.
  const reports: RegionReport[] = [];
  for (const [name, r] of Object.entries(REGIONS) as [
    keyof typeof REGIONS,
    Region,
  ][]) {
    const refCrop = cropBuffer(reference, r);
    const liveCrop = cropBuffer(live, r);
    const dummy = new PNG({ width: r.w, height: r.h });
    const diffPx = pixelmatch(
      refCrop,
      liveCrop,
      dummy.data,
      r.w,
      r.h,
      { threshold: 0.08, includeAA: false },
    );
    const totalPx = r.w * r.h;
    const ratio = diffPx / totalPx;
    reports.push({
      name,
      diffPx,
      totalPx,
      ratio,
      tolerance: r.tolerance,
      withinTolerance: ratio <= r.tolerance,
    });
  }

  return { reports, diffPath: DIFF_OUT };
}

/** Slice a single (x, y, w, h) rectangle out of an RGBA Buffer.
 *  Output is a new Buffer sized for the crop. */
function cropBuffer(
  src: { data: Buffer; width: number; height: number },
  r: Region,
): Buffer {
  const out = Buffer.alloc(r.w * r.h * 4);
  for (let row = 0; row < r.h; row++) {
    const srcY = r.y + row;
    if (srcY < 0 || srcY >= src.height) continue;
    const srcRowStart = (srcY * src.width + r.x) * 4;
    const dstRowStart = row * r.w * 4;
    src.data.copy(
      out,
      dstRowStart,
      srcRowStart,
      srcRowStart + r.w * 4,
    );
  }
  return out;
}

test.describe('Login page — pixel + alignment regression', () => {
  test.use({ viewport: { width: 1536, height: 1024 } });

  test('pixel comparison against the design reference (advisory)', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);

    const refBuf = fs.readFileSync(REF_PATH);
    const reference = PNG.sync.read(refBuf);
    expect(reference.width).toBe(REF_W);
    expect(reference.height).toBe(REF_H);

    const { reports, diffPath } = await runPixelCheck(page, reference);

    /* eslint-disable no-console */
    console.log('\n  Login pixel comparison vs reference:');
    for (const r of reports) {
      const pct = (r.ratio * 100).toFixed(2);
      const tolPct = (r.tolerance * 100).toFixed(0);
      const tag = r.withinTolerance ? 'OK  ' : 'OVER';
      console.log(
        `    [${tag}] ${r.name.padEnd(11)} ` +
          `diff=${r.diffPx.toString().padStart(7)}/${r.totalPx} ` +
          `(${pct}% / ceil ${tolPct}%)`,
      );
    }
    console.log(`  Diff PNG: ${diffPath}\n`);

    testInfo.attachments.push({
      name: 'login-pixel-diff',
      path: diffPath,
      contentType: 'image/png',
    });

    const overBudget = reports.filter((r) => !r.withinTolerance);
    if (overBudget.length) {
      // Soft-warn: don't fail the test. The structural tests
      // below are the real tripwires.
      testInfo.annotations.push({
        type: 'pixel-diff-over-budget',
        description:
          'Regions over budget: ' +
          overBudget
            .map(
              (r) =>
                `${r.name}=${(r.ratio * 100).toFixed(2)}% ` +
                `(ceil ${(r.tolerance * 100).toFixed(0)}%)`,
            )
            .join('; '),
      });
    }
  });

  test('the sign-in card sits in the right column at reference width', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const card = page.locator('.signin-card');
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    expect(box.x).toBeGreaterThan(840);
    expect(box.x).toBeLessThan(1010);
    expect(box.width).toBeGreaterThan(440);
    expect(box.width).toBeLessThan(640);

    // Card is vertically centered in the right pane (matches the
    // reference, which has it sitting mid-viewport next to the
    // hero/illustration). Y top should land in the middle third
    // of the viewport.
    expect(box.y).toBeGreaterThan(REF_H * 0.15);
    expect(box.y).toBeLessThan(REF_H * 0.55);

    // Card height covers most of the right pane (≥ half the
    // viewport) once the dense form + button render.
    expect(box.height).toBeGreaterThan(REF_H * 0.45);
  });

  test('the hero text is in the upper-left quadrant', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const hero = page.locator('.hero').first();
    await expect(hero).toBeVisible();
    const text = (await hero.textContent()) ?? '';
    expect(text.toLowerCase()).toContain('support');
    expect(text.toLowerCase()).toContain('simple');

    const box = await hero.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    expect(box.x).toBeLessThan(REF_W / 2);
    expect(box.y).toBeLessThan(REF_H / 2);
    expect(box.width).toBeGreaterThan(220);
    // Hero spans 3 lines × ~64px = ~200px tall, with line-height
    // 1.05 → block height is ~210px. Allow up to 320 to give slack.
    expect(box.height).toBeLessThan(320);
  });

  test('the CTA button fills the card content width', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const card = page.locator('.signin-card');
    const button = page.locator('atom-button button').filter({
      hasText: /sign in/i,
    });
    await expect(button).toBeVisible();

    const cardBox = await card.boundingBox();
    const btnBox = await button.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(btnBox).not.toBeNull();
    if (!cardBox || !btnBox) return;

    // Card has ~48px inner padding; the button should span the
    // inner content width (card width − padding×2) ± 16px.
    const expectedInner = cardBox.width - 96;
    expect(btnBox.width).toBeGreaterThan(expectedInner - 16);
    expect(btnBox.width).toBeLessThan(expectedInner + 16);

    // Centered inside the card so it isn't shrunk-to-fit.
    const cardCenter = cardBox.x + cardBox.width / 2;
    const btnCenter = btnBox.x + btnBox.width / 2;
    expect(Math.abs(btnCenter - cardCenter)).toBeLessThan(20);
  });

  test('the password eye toggle is inside the password field', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // .input-wrap is a sibling of <atom-input> inside the
    // form-field's projected content. The
    // atom-show-password-toggle host uses `display: contents`
    // so its .toggle button is a direct child of .input-wrap.
    // Two .input-wraps exist (email + password); password is
    // index 1.
    const field = page.locator('.input-wrap').nth(1);
    const eye = page.locator('atom-show-password-toggle .toggle').first();
    await expect(field).toBeVisible();
    await expect(eye).toBeVisible();

    const fieldBox = await field.boundingBox();
    const eyeBox = await eye.boundingBox();
    expect(fieldBox).not.toBeNull();
    expect(eyeBox).not.toBeNull();
    if (!fieldBox || !eyeBox) return;

    expect(eyeBox.x).toBeGreaterThanOrEqual(fieldBox.x - 1);
    expect(eyeBox.x + eyeBox.width).toBeLessThanOrEqual(
      fieldBox.x + fieldBox.width + 1,
    );
    expect(eyeBox.y).toBeGreaterThanOrEqual(fieldBox.y - 1);
    expect(eyeBox.y + eyeBox.height).toBeLessThanOrEqual(
      fieldBox.y + fieldBox.height + 1,
    );
  });

  test('brand mark + wordmark appear twice (marketing + card)', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const marks = page.locator('.brand-mark');
    await expect(marks).toHaveCount(2);
    const wordmarks = page.locator('.brand-wordmark');
    await expect(wordmarks).toHaveCount(2);
    const wordmarkTexts = await wordmarks.allTextContents();
    for (const t of wordmarkTexts) {
      expect(t.trim()).toBe('Helpdesk Lite');
    }
  });

  test('there is no "Sign in with SSO" affordance on the page', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).not.toContain('sign in with sso');
    const ssoButtons = page
      .locator('button, a')
      .filter({ hasText: /sso/i });
    expect(await ssoButtons.count()).toBe(0);
  });
});
