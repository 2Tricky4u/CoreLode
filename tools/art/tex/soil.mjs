import { P, SOIL_RAMPS } from '../palette.mjs';
/** Soil & turf tiles — clustered 3-shade clods, light from top-left, sparse dither. */
import { Sprite, texRng } from '../png.mjs';

const T = 50;

/** One soil tile: band ramp + per-variant seed. */
export function soilTile(band, variant) {
  const ramp = SOIL_RAMPS[band];
  const s = new Sprite(T, T);
  const rnd = texRng(0x50a1 + band * 131 + variant * 17);
  s.rect(0, 0, T, T, ramp.base);

  // Clustered clods. Deep bands (3+) read spotty with full rims, so they get
  // fewer, larger, shadow-only clods and less dither (calmer in the dark).
  const deep = band >= 3;
  const clods = deep ? 6 + Math.floor(rnd() * 2) : 9 + Math.floor(rnd() * 4);
  for (let i = 0; i < clods; i++) {
    const cx = 3 + Math.floor(rnd() * (T - 6));
    const cy = 3 + Math.floor(rnd() * (T - 6));
    const rx = (deep ? 3 : 2) + Math.floor(rnd() * 4);
    const ry = (deep ? 3 : 2) + Math.floor(rnd() * 3);
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d > 1) continue;
        if (d > 0.55) {
          const nw = x + y < 0;
          if (nw && !deep) s.px(cx + x, cy + y, ramp.light);
          else if (!nw) s.px(cx + x, cy + y, ramp.shadow);
        } else {
          s.px(cx + x, cy + y, ramp.base);
        }
      }
    }
  }

  // Sparse dither + tiny stones between clods (kept subtle).
  const grains = deep ? 22 : 42;
  for (let i = 0; i < grains; i++) {
    const x = Math.floor(rnd() * T);
    const y = Math.floor(rnd() * T);
    s.px(x, y, rnd() < 0.8 ? ramp.shadow : ramp.light);
  }
  for (let i = 0; i < 3; i++) {
    const x = 2 + Math.floor(rnd() * (T - 5));
    const y = 2 + Math.floor(rnd() * (T - 5));
    if (!deep) s.px(x, y, ramp.light);
    s.px(x + 1, y, ramp.base);
    s.px(x, y + 1, ramp.shadow);
    s.px(x + 1, y + 1, ramp.shadow);
  }
  // Rare accent fleck.
  if (rnd() < 0.5) s.px(Math.floor(rnd() * T), Math.floor(rnd() * T), ramp.accent);

  // NO hard tile edges — the world must read as one continuous soil field.
  // Just a few grounding grains along the bottom so stacked tiles knit together.
  for (let i = 0; i < 8; i++)
    s.px(Math.floor(rnd() * T), T - 1 - Math.floor(rnd() * 2), ramp.shadow);
  return s;
}

/** Turf: dusty regolith crust over band-0 soil (no pink — Mars dust). */
export function turfTile(variant) {
  const s = soilTile(0, 10 + variant);
  const rnd = texRng(0x70f + variant);
  // crust band
  s.rect(0, 0, T, 7, P.twine);
  s.rect(0, 0, T, 3, P.pancho);
  for (let x = 0; x < T; x++) {
    if (rnd() < 0.35) s.px(x, 3 + Math.floor(rnd() * 3), P.pancho);
    if (rnd() < 0.3) s.px(x, 6, P.rope);
    s.px(x, 7, P.rope); // crust underline
  }
  // pebbles on the crust
  for (let i = 0; i < 6; i++) {
    const x = 2 + Math.floor(rnd() * (T - 4));
    s.px(x, 1 + Math.floor(rnd() * 4), P.rope);
  }
  return s;
}
