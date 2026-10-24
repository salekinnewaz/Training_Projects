/**
 * verify-header-narrow.js — the chrome's narrow-viewport contract.
 *
 * The header-chrome is rendered above every post-login page, so a
 * horizontal overflow there is a page-wide bug on all three roles.
 * This gate proves two things at every width:
 *
 *   (a) the page does NOT overflow sideways, and
 *   (b) the profile trigger still shows its 28px avatar.
 *
 * (b) matters because the obvious way to stop an overflow is to let
 * the trigger's grid track shrink to zero — which squeezes the
 * avatar out of existence and leaves the user with an unidentifiable
 * button. The chrome instead drops the optional display name (and
 * then the wordmark) so the identity affordance survives.
 *
 * Usage:
 *   node qa/scripts/verify-header-narrow.js
 *
 * Requires: the app on localhost:4200, the backend on localhost:3000,
 * and a real login (jess@company.com / password123).
 */

const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:4200';

const WIDTHS = [1440, 1024, 768, 640, 480, 420, 360, 320];

let checks = 0;
let failures = 0;

function check(label, actual, expected) {
  checks++;
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        expected ${expected}, got ${actual}`);
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20_000 });
  await page.waitForSelector('header-chrome .profile-trigger', { timeout: 20_000 });
  await page.waitForTimeout(300);
}

/**
 * Read the chrome's geometry at the current viewport width.
 *
 * `overflow` is measured on the DOCUMENT (documentElement.scrollWidth
 * vs clientWidth) — that is the thing a user actually sees as a
 * sideways scrollbar, and it is the only measurement that catches an
 * element escaping its scroll container.
 *
 * `avatarVisible` checks the avatar's own painted box, not its
 * parent's: the trigger has overflow:hidden, so a squeezed avatar
 * is clipped to zero while its layout box may still report 28px.
 */
async function readChrome(page) {
  return page.evaluate(() => {
    const hdr = document.querySelector('header-chrome');
    const chrome = hdr?.querySelector('.chrome');
    const trigger = hdr?.querySelector('.profile-trigger');
    const avatar = trigger?.querySelector('chrome-avatar');
    const name = trigger?.querySelector('.profile-name');
    const wordmark = hdr?.querySelector('.brand-wordmark');
    const bell = hdr?.querySelector('.notification-trigger');

    const doc = document.documentElement;
    const overflow = doc.scrollWidth > doc.clientWidth + 1;

    // An avatar is "visible" when it has width AND it is not
    // clipped away by an ancestor's overflow:hidden. Compare the
    // avatar's right edge to the trigger's content box.
    let avatarVisible = false;
    let avatarW = 0;
    if (avatar && trigger) {
      const a = avatar.getBoundingClientRect();
      const t = trigger.getBoundingClientRect();
      const tcs = getComputedStyle(trigger);
      const inner = t.right - parseFloat(tcs.paddingRight);
      avatarW = a.width;
      avatarVisible = a.width >= 24 && a.right <= inner + 0.5;
    }

    return {
      overflow,
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      avatarVisible,
      avatarW,
      nameDisplay: name ? getComputedStyle(name).display : 'absent',
      wordmarkDisplay: wordmark ? getComputedStyle(wordmark).display : 'absent',
      bellVisible: bell ? bell.getBoundingClientRect().width >= 36 : false,
      chromeRight: chrome ? chrome.getBoundingClientRect().right : -1,
      triggerRight: trigger ? trigger.getBoundingClientRect().right : -1,
      gtc: chrome ? getComputedStyle(chrome).gridTemplateColumns : '',
    };
  });
}

(async () => {
  const browser = await chromium.launch();

  // ── Scenario 1: the User's dashboard ──────────────────────────
  console.log('\nScenario 1 — the User dashboard (jess@company.com)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, 'jess@company.com');

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const r = await readChrome(page);
      check(
        `the page does not overflow sideways at ${width}px`,
        r.overflow,
        false,
      );
      check(
        `the profile avatar survives at ${width}px`,
        r.avatarVisible,
        true,
      );
      check(
        `the notification bell survives at ${width}px`,
        r.bellVisible,
        true,
      );
    }
    await ctx.close();
  }

  // ── Scenario 2: the Support Agent's ticket list ──────────────
  console.log('\nScenario 2 — the Support Agent ticket list (eli@company.com)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, 'eli@company.com');
    await page.waitForSelector('header-chrome .profile-trigger', { timeout: 20_000 });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const r = await readChrome(page);
      check(
        `the agent page does not overflow sideways at ${width}px`,
        r.overflow,
        false,
      );
      check(
        `the profile avatar survives at ${width}px`,
        r.avatarVisible,
        true,
      );
    }
    await ctx.close();
  }

  // ── Scenario 3: the Admin's dashboard ─────────────────────────
  console.log('\nScenario 3 — the Admin dashboard (admin@company.com)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, 'admin@company.com');
    await page.waitForSelector('header-chrome .profile-trigger', { timeout: 20_000 });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const r = await readChrome(page);
      check(
        `the admin page does not overflow sideways at ${width}px`,
        r.overflow,
        false,
      );
      check(
        `the profile avatar survives at ${width}px`,
        r.avatarVisible,
        true,
      );
    }
    await ctx.close();
  }

  // ── Scenario 4: the degradation ladder is what we expect ─────
  console.log('\nScenario 4 — the narrow layout degrades in the documented order');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, 'jess@company.com');

    // Wide: the display name and the wordmark are both present.
    let r = await readChrome(page);
    check('the display name is shown at 1440px', r.nameDisplay, 'block');
    check('the wordmark is shown at 1440px', r.wordmarkDisplay, 'block');

    // <= 640px: the name goes, the wordmark stays.
    await page.setViewportSize({ width: 600, height: 900 });
    await page.waitForTimeout(150);
    r = await readChrome(page);
    check('the display name is hidden at 600px', r.nameDisplay, 'none');
    check('the wordmark survives at 600px', r.wordmarkDisplay, 'block');

    // <= 440px: the wordmark goes too, but the brand MARK stays.
    await page.setViewportSize({ width: 420, height: 900 });
    await page.waitForTimeout(150);
    r = await readChrome(page);
    check('the wordmark is hidden at 420px', r.wordmarkDisplay, 'none');
    check(
      'the brand mark survives at 420px',
      await page.evaluate(() => {
        const m = document.querySelector('header-chrome .brand-mark');
        return !!m && m.getBoundingClientRect().width >= 28;
      }),
      true,
    );
    await ctx.close();
  }

  await browser.close();

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
})();
