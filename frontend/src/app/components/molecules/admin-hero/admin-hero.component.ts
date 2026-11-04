/**
 * admin-hero — molecule (WDS-2026 Admin Workspace).
 *
 * The gradient banner at the top of the Admin dashboard:
 *
 *   ╭──────────────────────────────────────────────────────────╮
 *   │ Good morning, Avery 👋                                    │
 *   │ Here's what's happening with your support system today.   │
 *   │                        ┌──────────┐ ┌──────────────┐     │
 *   │                        │ 156      │ │ 8            │     │
 *   │                        │ Tickets  │ │ Total Users  │     │
 *   │                        │ ↑ 12%    │ │ +2 this week │     │
 *   │                        └──────────┘ └──────────────┘     │
 *   ╰──────────────────────────────────────────────────────────╯
 *
 * The banner is a soft lavender wash with organic wave ribbons
 * curling through it. The decorative illustration on the right is
 * inline SVG so it scales with the banner and needs no asset
 * pipeline.
 *
 * The two floating stat chips overlap the banner's bottom-right
 * corner — the purple one is tilted and the white one tilts the
 * other way, matching the reference's playful tilt.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

@Component({
  selector: 'admin-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero" aria-labelledby="admin-hero-heading">
      <!-- The banner's decorative wave.

           The reference's banner carries a lavender WAVE with a
           clearly visible ridge. Tracing that ridge off the
           screenshot (hero-ridge.mjs, hero-ridge-full.mjs) gives
           the first row at which the violet level jumps:

             x=780   y=127        x=1000  y=84
             x=820   y=112        x=1020  y=80
             x=860   y=105        x=1040  y=78
             x=900   y=96         x=1060  y=78
             x=940   y=91         x=1090  y=66
             x=960   y=88         x=1120  y=66
             x=980   y=91         x=1150  y=66

           So the wave crests at (1045, 77), sweeps down-left to
           (780, 127) and down-right towards the banner's edge. Just
           inside the ridge the violet level is 28-30, and it deepens
           to 45 at (940, 112) — the wave's deepest point is in its
           lower-left shoulder, not at the crest.

           The path below reproduces that ridge as the wave's upper
           boundary; the ribbon then fills the rest of the banner.
           Its fill is a vertical gradient, because the reference's
           violet deepens steadily downwards (violet 28 at the
           crest, 32 at y=108, 45 at y=112 near x=940). -->
      <svg class="waves" viewBox="0 0 1224 156" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="heroWaveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E5E3FD" />
            <stop offset="40%" stop-color="#E2DFFD" />
            <stop offset="100%" stop-color="#DFDCFD" />
          </linearGradient>
          <!-- The ridge itself is softened by a couple of pixels, so
               the jump in violet reads as a curve rather than a
               staircase. -->
          <filter id="heroWaveSoft" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>
        <!-- The wave's upper boundary, traced from the reference.
             The SVG's origin is the banner's top-left corner, so
             page (1040, 78) is svg (756, 13). The traced points are
             svg (496,62), (576,40), (636,25), (676,23), (716,19),
             (756,13), (796,16) and (836,1).

             The wave fills DOWNWARD from that ridge: the reference's
             pale base wash is still visible above the ridge on the
             left (violet 16 at page 900, 70), so the region above
             the ridge must stay unpainted. -->
        <path
          d="M300 68
             C 400 66, 450 64, 496 62
             C 530 58, 552 48, 576 40
             C 600 32, 620 28, 636 25
             C 656 21, 666 22, 676 23
             C 696 20, 706 19, 716 19
             C 736 14, 746 13, 756 13
             C 776 13, 786 16, 796 16
             C 812 10, 824 4, 836 1
             C 900 0, 1100 0, 1224 0
             L1224 156 L300 156 Z"
          fill="url(#heroWaveFill)"
          filter="url(#heroWaveSoft)"
        />
        <!-- The wave's deep shoulder, centred on page (940, 112),
             which is svg (656, 47) in the banner's own coordinates.
             The reference reaches violet 45 there, against 30 just
             inside the ridge at (1040, 83) — but part of that jump
             is the purple chip's shadow, so the deepening is kept
             gentle, and it is clipped to below the ridge so it does
             not lift the wave's left shoulder. -->
        <clipPath id="heroWaveClip">
          <path
            d="M300 68
               C 400 66, 450 64, 496 62
               C 530 58, 552 48, 576 40
               C 600 32, 620 28, 636 25
               C 656 21, 666 22, 676 23
               C 696 20, 706 19, 716 19
               C 736 14, 746 13, 756 13
               C 776 13, 786 16, 796 16
               C 812 10, 824 4, 836 1
               C 900 0, 1100 0, 1224 0
               L1224 156 L300 156 Z"
          />
        </clipPath>
        <g clip-path="url(#heroWaveClip)">
          <ellipse
            cx="620"
            cy="66"
            rx="150"
            ry="44"
            fill="#D8D2FD"
            opacity="0.45"
            filter="url(#heroWaveSoft)"
          />
        </g>
      </svg>

      <div class="copy">
        <h1 id="admin-hero-heading">
          {{ greeting() }}, {{ firstName() }}<span class="wave" aria-hidden="true">👋</span>
        </h1>
        <p>Here's what's happening with your support system today.</p>
      </div>

      <div class="chips">
        <div class="chip chip-purple">
          <span class="chip-icon">
            <!-- The reference's Total glyph is a HAND-DRAWN ticket: a
                 small wobbly closed outline drawn with a thick round
                 pen. Traced from the reference PNG — the ink occupies
                 page x 872..889, y 157..174. It reads as a squarish
                 outline: a diagonal shoulder from the left edge at
                 (872,161) up to a peak at (881,157), a short notch
                 bump at (887,159), a straight right side down to
                 (889,171), the bottom edge running back to (877,172)
                 and a tail dropping to (873,174). The path below is
                 that outline, shifted so page (870,155) is the
                 viewBox origin. -->
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path transform="translate(1.8 -1.4)" d="M2.2 6.4 L4.4 5.6 L8.0 3.6 L11.6 2.2 L14.4 3.4 L16.4 4.4 L17.4 3.2 L18.4 4.6 L18.2 8.0 L18.4 11.6 L18.8 16.2 L16.2 16.8 L12.0 17.2 L8.0 17.2 L4.2 18.8 L2.8 19.4 L2.4 16.0 L2.2 11.0 L2.4 8.4 Z" />
            </svg>
          </span>
          <span class="chip-text">
            <span class="chip-value">{{ format(totalTickets()) }}</span>
            <span class="chip-label">Total Tickets</span>
            @if (ticketDelta() !== null) {
              <!-- The reference's delta carries no arrow — just the
                   signed percentage on a translucent pill. -->
              <span class="chip-delta">{{ formatDelta() }}%</span>
            }
          </span>
        </div>

        <div class="chip chip-white">
          <span class="chip-icon">
            <!-- The reference's Total Users glyph: a LINE-ART person
                 in the chip's blue accent — a hollow ring for
                 the head and an outlined shoulder arc below it. -->
            <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="7.6" r="4.1" />
              <path d="M4.6 19.6 c0 -3.9 3.3 -6.6 7.4 -6.6 s7.4 2.7 7.4 6.6 Z" />
            </svg>
          </span>
          <span class="chip-text">
            <span class="chip-value">{{ format(totalUsers()) }}</span>
            <span class="chip-label">Total Users</span>
            @if (newUsersThisWeek() > 0) {
              <span class="chip-delta is-green">
                +{{ newUsersThisWeek() }} new this week
              </span>
            }
          </span>
        </div>
      </div>

      <!-- The decorative illustration. Its geometry is measured from
           the reference: the browser window's title bar spans page
           x 1155..1377 (y 91..107) with its three dots at 1346,
           1356 and 1365; the chart columns occupy page x 1188..1287;
           the avatar cluster sits at 1303..1327 (purple) and
           1341..1363 (teal); the person x 1391..1432 (y 115..164);
           and the plant x 1440..1503 (y 104..221). -->
      <div class="art" aria-hidden="true">
        <svg viewBox="0 0 380 156" width="380" height="156" fill="none">
          <!-- The browser window: white body with a purple title bar. -->
          <rect x="34" y="26" width="222" height="130" rx="10" fill="#FCFCFE" />
          <path d="M34 36 a10 10 0 0 1 10 -10 h202 a10 10 0 0 1 10 10 v7 H34 Z" fill="#715BFD" />
          <circle cx="225" cy="34" r="2.6" fill="#FFFFFF" />
          <circle cx="235" cy="34" r="2.6" fill="#FFFFFF" opacity="0.9" />
          <circle cx="244" cy="34" r="2.6" fill="#FFFFFF" opacity="0.75" />

          <!-- The bar chart inside the window: four soft columns with
               rounded tops, the last one solid purple and two of the
               pale ones carrying a darker purple foot. Measured from
               the reference PNG:
                 col 1  page x 1180..1210, top y 124
                 col 2  page x 1212..1231, top y 135, foot y 188..196
                 col 3  page x 1239..1259, top y 140, foot y 190..196
                 col 4  page x 1268..1286, top y 157 (solid purple)
                 base  page y 196..203, x 1180..1300
               The SVG's origin sits at page (1121, 66). -->
          <rect x="59" y="58" width="30" height="72" rx="14" fill="#F2F4FD" />
          <rect x="91" y="69" width="19" height="61" rx="9" fill="#F0F2FC" />
          <rect x="118" y="74" width="20" height="56" rx="9" fill="#EFEDF9" />
          <rect x="147" y="91" width="19" height="39" rx="9" fill="#A88EF3" />
          <!-- The darker purple feet. -->
          <rect x="91" y="122" width="19" height="8" rx="4" fill="#B7A0F5" />
          <rect x="119" y="124" width="18" height="6" rx="3" fill="#C4B0F7" />
          <!-- The baseline. -->
          <rect x="57" y="130" width="120" height="7" rx="3.5" fill="#F0F2FC" />

          <!-- The avatar cluster: a purple disc and a teal disc, each
               carrying a small WHITE exclamation mark, with the
               shoulders of two people rising below them. Measured
               from the reference PNG:
                 purple disc  page x 1303..1327, y 125..147
                 teal disc    page x 1341..1363, y 125..147
               The SVG's origin sits at page (1121, 66). -->
          <circle cx="194" cy="70" r="12" fill="#B9A3F5" />
          <rect x="193" y="65" width="2" height="7" rx="1" fill="#FFFFFF" />
          <circle cx="194" cy="75" r="1.3" fill="#FFFFFF" />
          <circle cx="231" cy="70" r="11" fill="#8ED8EA" />
          <rect x="230" y="65" width="2" height="7" rx="1" fill="#FFFFFF" />
          <circle cx="231" cy="75" r="1.3" fill="#FFFFFF" />
          <!-- The teal person's shoulders, rising below the teal disc. -->
          <path d="M231 84 a13 13 0 0 1 11 20 l-5 -6 a7 7 0 0 0 -12 0 l-5 6 a13 13 0 0 1 11 -20 Z" fill="#8ED8EA" />
          <!-- The pale person's head, behind the teal one. -->
          <circle cx="213" cy="87" r="15" fill="#F4F5FC" />

          <!-- The person: a MAN in left-facing profile, seated with his
               back to the viewer and his left arm reaching out. The
               geometry is measured from the reference PNG:
                 hair   page x 1391..1432, y 115..156
                 face   page x 1391..1421, y 132..166
                 shirt  page x 1367..1449, y 166..221
                 plant  page x 1450..1503, y 104..182
               The SVG's origin sits at page (1121, 66). -->
          <!-- The neck, running from the jaw down to the collar. -->
          <path d="M284 92 h9 v10 h-9 Z" fill="#F5A3A8" />
          <!-- The torso: a broad indigo shirt that widens as it falls
               away from the shoulder, clipped by the banner's bottom.
               The reference's shirt spans page x 1367..1449,
               y 166..221 — its collar starts at page x 1414. -->
          <path d="M294 100 c-14 4 -25 11 -34 21 c-10 11 -14 23 -17 35 h82 c0 -22 -6 -39 -17 -49 c-4 -4 -9 -8 -14 -7 Z" fill="#8C8FFC" />
          <!-- The shirt's lit left side. -->
          <path d="M294 100 c-14 4 -25 11 -34 21 c-10 11 -14 23 -17 35 h26 c1 -21 8 -39 25 -56 Z" fill="#9A9CFD" />
          <!-- The arm and open hand, raised at the lower left of the
               illustration. The reference's hand is a slender wedge
               pointing up and to the left, spanning page
               x 1308..1340, y 165..200. The SVG's origin sits at
               page (1121, 66). -->
          <path d="M219 130 c-8 -1 -17 -4 -25 -8 l-8 -5 l-1 8 c-2 -2 -4 -4 -5 -6 c-1 -2 -3 -1 -2 2 c1 4 5 8 10 11 c5 4 11 6 18 7 l4 9 l9 -18 Z" fill="#F5A3A8" />
          <!-- The forearm, tapering back towards the shoulder. -->
          <path d="M210 132 c10 4 21 7 32 8 l-3 -14 c-9 0 -18 -2 -26 -5 l-3 11 Z" fill="#8C8FFC" />
          <path d="M210 132 c8 3 17 6 26 7 l-2 -13 c-8 -1 -15 -2 -21 -4 l-3 10 Z" fill="#9A9CFD" />

          <!-- The head. The reference shows a WOMAN in left-facing
               profile. Her silhouette, traced from the reference PNG,
               is:
                 bun     page x 1396..1406, y 115..117
                 hair    page x 1392..1432, y 116..156
                 bangs   page x 1400..1407, y 131..147
                 face    page x 1391..1420, y 131..156
                 neck    page x 1405..1412, y 157..166
               The SVG's origin sits at page (1121, 66). -->
          <!-- The hair: a rounded bob that sweeps back over the crown
               and down behind the ear, with a small bun sitting on
               top of the head. -->
          <path d="M272 51 c4 -2 10 -3 15 -2 c9 1 20 4 24 11 c4 8 4 16 1 22 c-2 5 -6 8 -11 9 c-4 1 -8 0 -11 -2 c2 -3 3 -5 3 -8 c0 -3 -1 -5 -3 -7 c-2 3 -6 5 -10 5 c-3 0 -5 -1 -6 -3 c1 -4 1 -9 1 -13 c0 -6 1 -12 -2 -16 Z" fill="#1F2A55" />
          <!-- The bun on top of the crown, at page x 1396..1406,
               y 115..117. -->
          <path d="M275 54 c-1 -3 2 -6 6 -6 c5 0 9 2 9 5 c0 2 -2 3 -4 3 c-4 0 -8 -1 -11 -2 Z" fill="#1F2A55" />
          <!-- The bangs: a narrow lock of hair hanging down in front
               of the brow, at page x 1400..1407, y 131..147. -->
          <path d="M279 65 c3 0 5 2 6 5 c1 4 1 8 1 12 c0 3 -1 5 -2 7 c-2 -1 -4 -3 -4 -6 c0 -4 -1 -7 -1 -11 c0 -3 0 -5 0 -7 Z" fill="#1F2A55" />

          <!-- The face: a NARROW wedge in profile — the brow at the
               top, a small pointed nose at the left, the lips below
               it and the chin at the bottom. Measured from the
               reference PNG the skin of the face occupies page
               x 1391..1405, y 131..156. -->
          <path d="M273 65 L279 65 L283 69 L283 78 L284 89 L277 90 L272 87 L272 83 L270 80 L269 77 L272 73 L275 69 Z" fill="#F5A3A8" />
          <!-- The ear, set back against the jaw. -->
          <path d="M288 74 c3 -1 5 1 5 4 c0 4 -2 7 -5 8 c1 -4 1 -8 0 -12 Z" fill="#F5A3A8" />
          <!-- The eye and the mouth. -->
          <circle cx="274" cy="71" r="1.4" fill="#1F2A55" />
          <path d="M272 83 q3 2 6 -1" stroke="#DE8490" stroke-width="1.6" stroke-linecap="round" fill="none" />

          <g transform="translate(2 3) translate(354 96) scale(1.28) translate(-354 -96)">
          <!-- The plant. The reference shows a slim potted plant with
               a single curving stem and SIX long, pointed leaves,
               each carrying a darker centre vein. Measured from the
               reference PNG:
                 stem       page x 1470..1473, y 176..197
                 pot        page x 1456..1492, y 186..221
                 top leaf   page x 1478..1494, y 104..133
                 mid-left   page x 1456..1474, y 126..155
                 mid-right  page x 1483..1503, y 131..156
                 low-left   page x 1450..1471, y 150..184
                 low-right  page x 1484..1503, y 152..180
               The SVG's origin sits at page (1121, 66). -->
          <!-- The stem, curving up from the pot. -->
          <path d="M350 131 c0 -12 1 -25 4 -37 c3 -12 8 -25 14 -35" stroke="#6FB3F3" stroke-width="2.4" stroke-linecap="round" fill="none" />
          <!-- The top leaf: long and pointed, leaning right. -->
          <path d="M360 59 c3 -5 8 -9 13 -11 c2 4 2 9 0 14 c-2 6 -6 11 -10 13 c-4 2 -7 0 -8 -4 c-1 -4 2 -8 5 -12 Z" fill="#6CB0FE" />
          <path d="M362 61 c2 -4 6 -8 10 -10" stroke="#4E9CF0" stroke-width="1.2" stroke-linecap="round" fill="none" />
          <!-- The upper-left leaf. -->
          <path d="M355 74 c-2 -5 -7 -8 -12 -9 c-1 4 0 9 3 13 c3 5 8 8 12 8 c4 0 6 -3 5 -7 c-1 -2 -4 -4 -8 -5 Z" fill="#6CB0FE" />
          <path d="M352 77 c-2 -4 -5 -7 -9 -9" stroke="#4E9CF0" stroke-width="1.2" stroke-linecap="round" fill="none" />
          <!-- The upper-right leaf, reaching to the right. -->
          <path d="M360 80 c4 -4 10 -6 16 -6 c1 4 -1 8 -5 12 c-4 4 -9 6 -13 6 c-4 0 -6 -3 -5 -6 c0 -2 3 -4 7 -6 Z" fill="#6CB0FE" />
          <path d="M363 82 c4 -3 8 -5 12 -6" stroke="#4E9CF0" stroke-width="1.2" stroke-linecap="round" fill="none" />
          <!-- The lower-left leaf. -->
          <path d="M352 94 c-3 -4 -8 -6 -13 -6 c-1 4 1 9 5 13 c4 4 9 6 13 6 c4 0 6 -3 5 -6 c0 -3 -4 -5 -10 -7 Z" fill="#6CB0FE" />
          <path d="M350 97 c-3 -3 -6 -5 -10 -6" stroke="#4E9CF0" stroke-width="1.2" stroke-linecap="round" fill="none" />
          <!-- The lower-right leaf. -->
          <path d="M355 97 c4 -3 10 -4 15 -3 c0 4 -2 8 -6 11 c-4 3 -9 5 -12 4 c-4 -1 -5 -4 -3 -7 c1 -2 3 -3 6 -5 Z" fill="#6CB0FE" />
          <path d="M357 99 c4 -2 8 -3 12 -3" stroke="#4E9CF0" stroke-width="1.2" stroke-linecap="round" fill="none" />
          </g>

          <!-- The pot: a pale bucket, sampled at rgb(222, 226, 253).
               It spans page x 1452..1488, y 190..221, so in the
               SVG's coordinates (whose origin is page 1121, 66) it
               sits at x 331..367, y 124..155. -->
          <path d="M331 124 h36 l-3 31 h-30 Z" fill="#DEE2FD" />
        </svg>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }
    .hero {
      position: relative;
      overflow: hidden;
      height: 156px;
      padding: 0;
      border-radius: 18px;
      box-sizing: border-box;
      /* The reference's banner is a very pale blue-lavender wash with
         a broad violet band over its top-right corner and a lavender
         wave curling through the middle.

         The background is built from two layers, each fitted to the
         reference's measured violet profile (hero-prof.mjs). That
         script reports "violet" as blue-minus-red per pixel, which
         isolates the lavender cast from the pale blue base wash:

           x=300   y=66..218   16 -> 12   (flat, the base wash)
           x=1300  y=66..90    26 -> 24   (the top band)
           x=1000  y=68..104   17 -> 30   (the wave's crest)

         base    a near-flat pale wash, #EEF2FD at the top down to
                 #F2F6FE at the bottom.
         band    a WIDE, SHALLOW ellipse hugging the top edge. It
                 reaches violet 26 at x=1300 and still reads 22 at
                 x=1150, so it is much broader than the wave and must
                 not bleed down the left-hand side.
         The wave itself is drawn as inline SVG, because it has a
         traced ridge that a CSS radial-gradient cannot reproduce. */
      background:
        radial-gradient(
          330px 74px at 88% -6%,
          #e7e5fd 0%,
          rgba(231, 229, 253, 0.7) 46%,
          rgba(231, 229, 253, 0) 100%
        ),
        linear-gradient(180deg, #eef2fd 0%, #f1f5fe 55%, #f2f6fe 100%);
      /* The reference's banner has NO hairline border — its top edge
         fades into the page over two pixels (#FCFBFE at y=63 down to
         #E9EDFA at y=65). A 1px border painted a hard line there
         instead, so the banner is edged with a soft outset shadow
         that reproduces the fade. */
      border: 0;
      box-shadow: 0 0 3px 1px rgba(226, 232, 250, 0.9);
    }
    /* The decorative wave ribbons behind the copy. */
    .waves {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }
    .copy {
      position: absolute;
      z-index: 2;
      left: 13px;
      top: 38px;
    }
    /* The reference's greeting is set in the geometric Figtree face,
       which the admin workspace supplies.

       Its size was measured from the screenshot (hero-capheight.mjs):
       the reference's lowercase letters span rows 117..135 — a 19px
       x-height — and its headline measures 334px of ink across, which
       Figtree reproduces at 34px. */
    .copy h1 {
      margin: 0 0 2px;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 0;
      line-height: 1.18;
      color: var(--color-text-primary);
    }
    .wave {
      display: inline-block;
      margin-left: 8px;
      font-size: 30px;
      line-height: 1;
      transform-origin: 70% 70%;
    }
    /* The reference's subtitle is set in the neutral app face rather
       than the geometric heading face, at 15px and a medium weight.
       Its ink measures 398px wide and 15px tall in the reference; at
       weight 500 and -0.2px tracking this face reproduces both
       (hero-sub-fit.mjs). */
    .copy p {
      margin: 6px 0 0;
      font-family: var(--font-sans);
      font-size: 15px;
      font-weight: 500;
      line-height: 1.5;
      letter-spacing: -0.0133em;
      color: var(--admin-hero-subtitle, #4B5563);
    }

    /* The two floating chips sit to the LEFT of the illustration, each
       tilted a few degrees, and they OVERFLOW the banner's bottom
       edge — the hero clips them at the lower border.

       The reference's purple chip spans x=846..1003 in page
       coordinates — 562..719 relative to the banner's left edge —
       and starts at y=113, which is 48px below the banner's top.
       The white chip starts at x=1005 (721 relative) and its left
       edge sits 22px lower than the purple chip's.

       Each chip's shape is a rounded rectangle with ONE square
       corner — the top-right on the purple chip, the top-left on
       the white one. */
    .chips {
      position: absolute;
      z-index: 3;
      left: 562px;
      top: 58px;
    }
    .chip {
      position: absolute;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px 18px;
      border-radius: 16px;
      box-shadow: 0 10px 26px rgba(79, 61, 245, 0.18);
    }
    .chip-purple {
      /* The reference's purple chip is NOT a rotated rectangle — it is
         a PERSPECTIVE CARD. Traced from the PNG (pchip-shape.mjs),
         its silhouette in page coordinates is:
           top edge      slopes from (1000,114) down-left to (857,134)
           right edge    VERTICAL at x=1004, from y 144 down to y 220
           left edge     VERTICAL at x=846 from y 144 to y 168, then
                         bulging right to x=856 at the bottom
           bottom edge   horizontal at y=220, x 856..1004
         Its internals, measured from the PNG:
           tile   page x 864..899, y 147..184
           glyph  page x 872..889, y 157..174
           value  page x 910..938, y 146..161
           label  page x 914..978, y 167..180
           pill   page x 916..951, y 188..208 */
      left: 0px;
      top: -9px;
      /* The reference's chip body runs from a deep blue-violet at the
         top to a lighter periwinkle blue at the bottom. Sampled from
         the PNG at x=955 (clear of the tile and the type):
           y=124  rgb(97, 92, 252)   = #615CFC
           y=150  rgb(91, 103, 253)  = #5B67FD
           y=210  rgb(113, 140, 251) = #718CFB */
      background: linear-gradient(178deg, #605DFC 0%, #5B65FD 46%, #7690FC 100%);
      color: #ffffff;
      /* The clip path reproduces the perspective outline above. The
         chip's local box is 158 x 107 with its origin at page
         (846, 114) — so the coordinates below are page coordinates
         minus that origin. */
      clip-path: path("M 152 0 Q 160 2 163 12 Q 167 20 167 26 Q 167 30 158 30 L 158 94 Q 158 105 148 106 L 12 106 Q 1 99 0 78 L 0 46 Q 0 33 5 25 Q 11 13 28 10 Z");
      border-radius: 0;
      width: 168px;
      height: 107px;
      padding: 20px 20px 14px 16px;
      gap: 10px;
      overflow: hidden;
    }
    .chip-purple .chip-icon {
      width: 36px;
      height: 36px;
      flex-basis: 36px;
      border-radius: 11px;
      /* The reference's tile on the purple chip is a solid light
         periwinkle block — sampled at rgb(150, 152, 253). */
      background: var(--admin-chip-purple-icon-bg, #9698FD);
    }
    /* The tile sits 4px higher than the type column: the reference's
       tile spans page y 147..184 while its value ink starts at 146
       and its label at 167. */
    /* The reference's icon tile is an AXIS-ALIGNED square, so it is
       NOT rotated with the card. Its face sits at page
       x 866..899, y 147..184 — the card's own origin is page
       (847, 115), so the tile starts 19px in and 32px down. */
    .chip-purple .chip-icon {
      position: absolute;
      left: 19px;
      top: 32px;
      margin: 0;
    }
    /* The hand-drawn ticket glyph inside the tile sits 4px left of
       the tile's centre and 2px below its vertical middle. */
    .chip-purple .chip-icon svg {
      transform: translate(-3px, 2px);
    }
    /* The type inside the perspective card leans with the card's
       sloped top edge, so the text column is counter-rotated by
       the same -8 degrees the old, flat rectangle used. */
    .chip-purple .chip-text {
      position: absolute;
      left: 63px;
      top: 32px;
      transform: rotate(-8deg);
      transform-origin: left top;
    }
    .chip-purple .chip-value {
      font-size: 19px;
    }
    /* The reference's chip label is set smaller than the app's body
       type: its ink measures 14px tall and 67px wide for this
       string. */
    .chip-purple .chip-label {
      font-size: 11px;
      font-weight: 500;
      opacity: 1;
    }
    /* The reference's "+12%" sits on a translucent white pill. */
    .chip-purple .chip-delta {
      font-size: 12px;
      font-weight: 600;
      margin-top: 1px;
      margin-left: -6px;
      padding: 3px 7px;
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.14);
    }
    .chip-white {
      /* The reference's white chip body starts at page x=1005, which
         is 159px to the right of the purple chip's left edge at 846,
         and its flat top edge sits at page y=136. Unlike the purple
         chip, this one is NOT tilted — the reference draws it as a
         plain axis-aligned card, so no transform is applied. */
      left: 159px;
      top: 13px;
      background: #ffffff;
      color: var(--color-text-primary);
      box-shadow: 0 10px 26px rgba(79, 61, 245, 0.14);
      border-radius: 16px;
      /* The reference's two chips OVERLAP: the white chip starts at
         x=1005, behind the purple chip's right edge. */
      margin-left: 0;
      margin-top: 0;
      /* The reference's white chip measures 170x82 in page space.
         Its internals, measured from the PNG:
           tile   page x 1021..1056, y 152..188
           value  page x 1068..1076, y 158..171
           label  page x 1068..1126, y 182..189
           delta  page x 1068..1160, y 202..210
         The three text lines are flush left at x=1068, so the
         tile sits to the left of them and the text column starts
         12px past the tile's right edge. */
      width: 170px;
      height: 82px;
      padding: 14px 10px 10px 16px;
      gap: 12px;
    }
    /* The text column sits a little lower than the tile's top edge:
       the reference's value starts 6px below the tile's top. */
    .chip-white .chip-text {
      margin-top: 2px;
      margin-left: -3px;
    }
    .chip-white .chip-icon {
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      border-radius: 11px;
    }
    .chip-white .chip-value {
      font-size: 18px;
    }
    /* The reference's label is a light gray, set in a regular (not
       bold) weight. */
    .chip-white .chip-label {
      font-size: 12px;
      font-weight: 500;
      letter-spacing: -0.025em;
      color: #6B7280;
      opacity: 1;
    }
    .chip-white .chip-delta {
      font-size: 11px;
      font-weight: 500;
      align-self: flex-start;
      justify-self: start;
      white-space: nowrap;
      margin-top: 4px;
      margin-left: 0;
    }
    .chip-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.22);
      color: #ffffff;
    }
    .chip-white .chip-icon {
      background: var(--admin-chip-icon-bg, #D7E7FD);
      color: var(--admin-chip-icon, #0A6BF9);
    }
    .chip-text {
      display: grid;
      grid-template-columns: auto;
      gap: 4px;
      line-height: 1.15;
    }
    /* The reference's chip type, measured from the PNG:
         value  "156"        page y 146..161, x 910..938
         label  "Total Tickets" page y 167..180, x 914..978
         delta  "+12%"       page y 191..200, x 917..945
       Inter sets each of these ~20% larger than the reference's
       face, so the sizes are trimmed to land on the same extents. */
    .chip-value {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .chip-label {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.9;
      white-space: nowrap;
    }
    .chip-delta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 6px;
      padding: 0;
      align-self: start;
      justify-self: start;
      font-size: 10.5px;
      font-weight: 700;
      color: #ffffff;
      background: none;
    }
    .chip-delta.is-green {
      color: #09C05B;
    }

    /* The illustration is pinned so its browser window lands on the
       reference's x=1155..1377 and its right edge on x=1503. */
    .art {
      position: absolute;
      z-index: 1;
      right: 5px;
      top: 0;
      pointer-events: none;
    }
    @media (max-width: 1280px) {
      .chips {
        left: 46%;
      }
      .art {
        opacity: 0.85;
      }
    }
    @media (max-width: 1080px) {
      .art {
        display: none;
      }
      .chips {
        position: static;
        margin-top: 18px;
        justify-content: flex-start;
      }
    }
  `],
})
export class AdminHeroComponent {
  /** The signed-in admin's display name. */
  readonly displayName = input<string>('');

  /** Total tickets across the workspace. */
  readonly totalTickets = input<number>(0);

  /** Total users across the workspace. */
  readonly totalUsers = input<number>(0);

  /** Users created in the trailing seven days. */
  readonly newUsersThisWeek = input<number>(0);

  /**
   * Period-over-period ticket delta as a percentage. `null`
   * hides the chip's delta (there is no meaningful baseline to
   * compare against).
   */
  readonly ticketDelta = input<number | null>(null);

  /**
   * An explicit greeting that overrides the time-of-day default.
   *
   * The Admin Workspace design this component was drawn from shows
   * "Good morning, Avery", and the workspace renders that fixed
   * greeting so the dashboard matches its design frame; every other
   * caller leaves it unset and gets the hour-derived value below.
   */
  readonly greetingOverride = input<string | null>(null);

  /**
   * The greeting for the current hour. "Good morning" before
   * noon, "Good afternoon" until 18:00, "Good evening" after.
   */
  readonly greeting = computed(() => {
    const override = this.greetingOverride();
    if (override) return override;
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  /** The signed-in user's first name. */
  readonly firstName = computed(() => {
    const name = this.displayName().trim();
    if (!name) return 'there';
    return name.split(/\s+/)[0] ?? name;
  });

  /**
   * The delta chip's label — the signed percentage. The reference
   * shows the sign in front of the number, with no arrow glyph.
   */
  protected formatDelta(): string {
    const pct = this.ticketDelta();
    if (pct === null) return '';
    return pct > 0 ? `+${pct}` : String(pct);
  }

  protected format(n: number): string {
    return n.toLocaleString('en-US');
  }
}
