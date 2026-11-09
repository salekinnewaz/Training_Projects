/** Admin dashboard banner, matched to the supplied Admin reference. */
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
      <svg class="landscape" viewBox="0 0 1300 133" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="adminSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#EAF5FF" />
            <stop offset="1" stop-color="#D8EEFF" />
          </linearGradient>
          <linearGradient id="adminFoothills" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#C7E3FA" />
            <stop offset="1" stop-color="#E5F4FF" />
          </linearGradient>
          <radialGradient id="adminSun">
            <stop offset="0" stop-color="#FFF9DE" stop-opacity=".95" />
            <stop offset="1" stop-color="#FFF9DE" stop-opacity="0" />
          </radialGradient>
          <filter id="adminTerrainSoft" x="-4%" y="-16%" width="108%" height="132%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
        </defs>
        <rect width="1300" height="133" fill="url(#adminSky)" />
        <circle cx="1218" cy="43" r="46" fill="url(#adminSun)" />
        <circle cx="1218" cy="43" r="20" fill="#FFF7D8" opacity=".88" />
        <g filter="url(#adminTerrainSoft)">
        <path d="M360 133 478 77 526 99 620 42 683 99 738 63 833 126 910 87 984 133Z" fill="#C6DFF6" opacity=".62" />
        <path d="m575 93 45-51 40 57-17-15-14 11-12-17-13 13-12-7Z" fill="#F8FCFF" opacity=".65" />
        <path d="m713 91 25-28 30 42-13-11-11 8-9-14-10 10-7-5Z" fill="#F8FCFF" opacity=".6" />
        <path d="M490 133 615 79 666 103 761 53 827 108 896 75 1028 133Z" fill="#C9E3F8" opacity=".72" />
        <path d="m728 72 33-19 40 55-16-14-13 8-11-16-12 12-9-10Z" fill="#FFFFFF" opacity=".62" />
        </g>
        <g fill="#71A9D0" opacity=".43">
          <path d="m730 133 9-27 9 27Zm14 0 12-35 12 35Zm25 0 8-25 8 25Zm32 0 13-39 13 39Zm26 0 10-30 10 30Zm27 0 14-42 14 42Zm30 0 9-27 9 27Zm29 0 14-41 14 41Zm30 0 10-30 10 30Zm26 0 15-45 15 45Zm35 0 11-33 11 33Zm30 0 14-42 14 42Zm32 0 10-30 10 30Zm28 0 13-39 13 39Zm30 0 9-27 9 27Z" />
        </g>
        <path d="M300 133c120-27 177-10 263-1 96 10 155-14 239-12 95 2 137 25 226 10 71-12 150-32 272 3v33H300Z" fill="url(#adminFoothills)" opacity=".78" />
        <path d="M760 133c93-26 143-18 217-7 87 14 158-13 323-2v22H760Z" fill="#B8DCF7" opacity=".4" />
      </svg>

      <div class="copy">
        <h1 id="admin-hero-heading">
          {{ greeting() }}, {{ firstName() }}<span class="wave" aria-hidden="true">👋</span>
        </h1>
        <p>Here's what's happening with your support system today.</p>
      </div>

      <div class="hero-controls">
        <div class="today-date">
          <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4.5" width="14" height="13" rx="2"/><path d="M6.5 2.5v4M13.5 2.5v4M3 8.5h14"/></svg>
          <time datetime="2026-10-30">{{ todayLabel() }}</time>
        </div>
        <button class="range-button" type="button" aria-label="Date range: Last 7 days">
          Last 7 days
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
        </button>
      </div>

      <aside class="insight-card" aria-label="Customer success tip">
        <strong>Keep your customers happy</strong>
        <p>Resolve tickets faster with insights<br />and automation.</p>
      </aside>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .hero {
      position: relative;
      height: 133px;
      overflow: hidden;
      color: #0b1d48;
      background: #eaf5ff;
    }
    .landscape { position: absolute; inset: 0; width: 100%; height: 100%; }
    .copy { position: absolute; z-index: 1; left: 29px; top: 31px; }
    .copy h1 {
      margin: 0 0 1px;
      color: #081b45;
      font-size: 33px;
      font-weight: 700;
      letter-spacing: -1.1px;
      line-height: 1.22;
    }
    .wave { display: inline-block; margin-left: 8px; font-size: 29px; letter-spacing: 0; }
    .copy p {
      margin: 0;
      color: #5875a4;
      font-family: var(--font-sans);
      font-size: 15px;
      font-weight: 500;
      line-height: 1.5;
    }
    .hero-controls {
      position: absolute;
      z-index: 2;
      left: 614px;
      top: 27px;
      display: flex;
      align-items: center;
      gap: 12px;
      height: 39px;
      white-space: nowrap;
    }
    .today-date {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #425f8e;
      font-family: var(--font-sans);
      font-size: 12px;
      font-weight: 500;
    }
    .today-date svg {
      width: 19px;
      height: 19px;
      fill: none;
      stroke: #355b91;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .range-button {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      height: 38px;
      min-width: 124px;
      padding: 0 13px;
      border: 1px solid #dce8f7;
      border-radius: 11px;
      background: rgba(255,255,255,.66);
      color: #18345f;
      font: 500 13px/1 var(--font-sans);
      cursor: default;
    }
    .range-button svg {
      width: 13px;
      height: 13px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .insight-card {
      position: absolute;
      z-index: 1;
      top: 41px;
      right: 79px;
      width: 274px;
      min-height: 98px;
      padding: 12px 20px;
      border: 1px solid rgba(255,255,255,.64);
      border-radius: 13px;
      background: linear-gradient(125deg, rgba(55, 169, 220, .84), rgba(19, 143, 194, .77));
      box-shadow: 0 8px 20px rgba(47, 116, 173, .08);
      color: #fff;
      font-family: var(--font-sans);
    }
    .insight-card strong { display: block; margin-bottom: 4px; font-size: 15px; font-weight: 700; }
    .insight-card p { margin: 0; font-size: 13px; font-weight: 500; line-height: 1.55; }
    @media (max-width: 1250px) {
      .hero-controls { left: auto; right: 310px; }
      .insight-card { right: 18px; width: 250px; }
    }
    @media (max-width: 980px) {
      .hero-controls { right: 20px; top: 14px; }
      .today-date { display: none; }
      .insight-card { display: none; }
      .copy { top: 36px; }
    }
    @media (max-width: 600px) {
      .hero { height: 148px; }
      .copy { left: 18px; top: 24px; right: 18px; }
      .copy h1 { font-size: 27px; }
      .copy p { max-width: 340px; font-size: 13px; }
      .hero-controls { top: 92px; left: 18px; right: auto; }
    }
  `],
})
export class AdminHeroComponent {
  readonly displayName = input<string>('');
  readonly greetingOverride = input<string | null>(null);

  readonly greeting = computed(() => {
    const override = this.greetingOverride();
    if (override) return override;
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly firstName = computed(() => {
    const name = this.displayName().trim();
    return name ? (name.split(/\s+/)[0] ?? name) : 'there';
  });

  readonly todayLabel = computed(() => 'Thursday, Oct 30, 2026');
}
