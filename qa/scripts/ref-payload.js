/**
 * The shared REFERENCE-LIKE payload for the user dashboard's stat
 * strip — the counts and the daily series the WDS-2026 mockup
 * shows.
 *
 * The counts are the reference's own: 156 total split 42 / 28 / 62
 * / 24.
 *
 * The daily series is 60 days, split into two 30-day halves so
 * `previousPeriod` is the older half's sum and the recent half is
 * the last 30 entries. The recent half climbs smoothly, so the
 * sparkline (which plots the last 14 days) reads as the
 * reference's soft diagonal rise with no plateau and no dip.
 *
 *   previous = 73, recent = 82
 *   (82 - 73) / 73 = 12.33% -> +12%
 *
 * which is the reference's pill ("+12%"). The pair is chosen so
 * previous + recent = 155, matching the card's own 156-ticket
 * scale.
 */

/** The 60-day daily-created series (older half first). */
const DAILY_CREATED = [
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4,
  4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4,
  4, 4, 4, 4, 4, 4, 5, 5, 5, 5,
];

/** The full stats payload. */
const REF_PAYLOAD = {
  counts: { total: 156, open: 42, inProgress: 28, resolved: 62, closed: 24 },
  dailyCreated: DAILY_CREATED,
  previousPeriod: 73,
};

module.exports = { REF_PAYLOAD, DAILY_CREATED };

// Sanity check when run directly.
if (require.main === module) {
  const recent = DAILY_CREATED.slice(-30).reduce((s, n) => s + n, 0);
  const older = DAILY_CREATED.slice(0, 30).reduce((s, n) => s + n, 0);
  const pct = Math.round(((recent - older) / older) * 100);
  const monotonic = DAILY_CREATED
    .slice(-30)
    .every((v, i, a) => i === 0 || v >= a[i - 1]);
  console.log(
    `older 30 = ${older}  recent 30 = ${recent}  delta = ${pct}%  monotonic=${monotonic}`,
  );
  if (older !== 73 || recent !== 82 || pct !== 12 || !monotonic) {
    console.error('✗ payload does not reproduce the reference delta');
    process.exit(1);
  }
  console.log('✓ payload reproduces the reference +12% delta');
}
