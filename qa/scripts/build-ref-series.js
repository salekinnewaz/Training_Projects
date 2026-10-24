/**
 * Build a 60-day daily-created series with:
 *   - the older 30 days summing to 73 (the "previous period")
 *   - the recent 30 days summing to 82 (the "current period")
 *   - a smooth, MONOTONIC climb across the last 14 days (the
 *     sparkline's window) so it reads as the reference's soft
 *     diagonal rise, with no plateau and no dip
 *
 * The delta then reads (82 - 73) / 73 = 12.33% -> +12%, which is
 * the reference's pill.
 *
 * The older half only needs to sum to 73 — its SHAPE is invisible
 * (the sparkline plots the last 14 days), so it is kept low and
 * flat, the way a real dashboard's trailing history would be.
 */

const OLDER_SUM = 73;
const RECENT_SUM = 82;
const N = 60;
const RECENT = 30;

/**
 * A non-decreasing ramp of `n` values summing to `total`, with
 * the LAST 14 entries forming a smooth S-curve.
 *
 * Start from an ideal cosine ramp, then repair the sum by
 * distributing the difference across the values that can absorb
 * it while keeping the sequence non-decreasing.
 */
function ramp(n, total) {
  // A smooth S-shaped ramp: slow at the start, steep in the
  // middle, slow again at the end. Scaled to sum to `total`.
  const raw = Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    // Smoothstep — the classic S-curve.
    return t * t * (3 - 2 * t);
  });
  const scale = total / raw.reduce((s, v) => s + v, 0);
  const out = raw.map((v) => Math.max(1, Math.round(v * scale)));
  // Repair the sum by walking from the end (the peak) and nudging
  // down, or from the start and nudging up.
  let sum = out.reduce((s, v) => s + v, 0);
  let guard = 0;
  while (sum !== total && guard++ < 10000) {
    const step = sum > total ? -1 : 1;
    if (step < 0) {
      // Reduce the largest value that has a smaller predecessor.
      for (let i = n - 1; i > 0; i--) {
        if (out[i] > out[i - 1]) {
          out[i] -= 1;
          sum -= 1;
          break;
        }
      }
    } else {
      // Raise the last value that is below its successor.
      for (let i = n - 2; i >= 0; i--) {
        if (out[i] < out[i + 1]) {
          out[i] += 1;
          sum += 1;
          break;
        }
      }
    }
  }
  return out;
}

const recent = ramp(RECENT, RECENT_SUM);

// The older half: a low, gently-rising history that sums to 73.
// Its shape is invisible to the sparkline, so a simple ramp is
// enough.
const older = ramp(N - RECENT, OLDER_SUM);

const series = [...older, ...recent];
const sumOlder = older.reduce((s, v) => s + v, 0);
const sumRecent = recent.reduce((s, v) => s + v, 0);
const pct = Math.round(((sumRecent - sumOlder) / sumOlder) * 100);
const monotonic = recent.every((v, i) => i === 0 || v >= recent[i - 1]);

console.log('older 30 :', older.join(', '));
console.log('recent 30:', recent.join(', '));
console.log(`sums: older=${sumOlder} recent=${sumRecent} delta=${pct}%`);
console.log('recent monotonic:', monotonic);
console.log('last 14 (sparkline window):', recent.slice(-14).join(', '));
console.log('\nfull 60:');
console.log(
  '  ' +
    series.map((v) => String(v).padStart(2)).join(', ') +
    ',',
);
