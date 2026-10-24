/**
 * Side-by-side comparison of the reference stat strip and the
 * local render: stack the reference crop above the local crop at
 * the same width so they can be compared directly.
 */

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'local-view');

function read(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

/** Crop to a rectangle, scaling to a target width by nearest
 *  neighbour. */
function cropScale(src, x, y, w, h, outW) {
  const scale = outW / w;
  const outH = Math.round(h * scale);
  const out = new PNG({ width: outW, height: outH });
  for (let row = 0; row < outH; row++) {
    const sy = Math.min(src.height - 1, y + Math.floor(row / scale));
    for (let col = 0; col < outW; col++) {
      const sx = Math.min(src.width - 1, x + Math.floor(col / scale));
      const si = (sy * src.width + sx) * 4;
      const di = (row * outW + col) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return out;
}

const ref = read(path.join(OUT_DIR, 'ref-full.png'));
const mine = read(path.join(OUT_DIR, 'refshape-mine.png'));

const W = 1400;
// Reference strip: x=97..1440, y=183..269.
const refStrip = cropScale(ref, 97, 183, 1343, 86, W);
// The local screenshot is of the strip element alone, at device
// scale 2 — so its card band is 88 CSS px = 176 device px, which
// is the whole image. Crop the card band to the same aspect as
// the reference before scaling.
const mineH = Math.min(mine.height, 176);
const mineStrip = cropScale(mine, 0, 0, mine.width, mineH, W);

const GAP = 14;
const outH = refStrip.height + GAP + mineStrip.height;
const out = new PNG({ width: W, height: outH });

// White background.
out.data.fill(255);

const blit = (src, dy) => {
  for (let row = 0; row < src.height; row++) {
    for (let col = 0; col < W; col++) {
      const si = (row * W + col) * 4;
      const di = ((dy + row) * W + col) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
};

blit(refStrip, 0);
blit(mineStrip, refStrip.height + GAP);

fs.writeFileSync(path.join(OUT_DIR, 'side-by-side.png'), PNG.sync.write(out));
console.log(`✓ side-by-side.png — ${W}x${outH} (reference on top, local below)`);
