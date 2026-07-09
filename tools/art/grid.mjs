/** Char-grid → Sprite. Each character is a palette entry via the legend; '.' or ' ' = transparent. */
import { Sprite } from './png.mjs';

/**
 * @param rows string[] — equal-length rows; each char indexes `legend`
 * @param legend Record<char, [r,g,b]> — color per char
 * @param scale integer upscale factor (default 2)
 */
export function grid(rows, legend, scale = 2) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const s = new Sprite(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const c = legend[ch];
      if (!c) throw new Error(`grid: no legend entry for '${ch}' (row ${y})`);
      s.px(x, y, c);
    }
  }
  return scale > 1 ? s.scale(scale) : s;
}

/** Standard hero legend factory from a ramp: o outline, s shadow, b base, l light, w white specular. */
export const rampLegend = (ramp, extra = {}) => ({
  o: ramp.outline,
  s: ramp.shadow,
  b: ramp.base,
  l: ramp.light,
  w: [255, 255, 255],
  ...extra,
});
