import { P, ROCK_RAMP } from '../palette.mjs';
/** Boulders, barrier plates, bedrock — angular, faceted, grounded. (v2 after round-1 critique) */
import { Sprite, texRng } from '../png.mjs';

const T = 50;

/** Chunky angular rock: flat top slab, straight facet seams, wide contact base. */
export function boulderTile(variant) {
  const s = new Sprite(T, T);
  const rnd = texRng(0xb0d + variant * 7);
  const r = ROCK_RAMP;
  const j = () => Math.floor(rnd() * 4) - 1;

  // Silhouette: trapezoid-ish slab with a notch.
  const top = 12 + j();
  const pts = [
    [8 + j(), top + 4],
    [20 + j(), top],
    [40 + j(), top + 2],
    [46, 30 + j()],
    [42 + j(), 46],
    [7 + j(), 46],
    [3, 32 + j()],
  ];
  s.poly(pts, r.base);
  // Flat lit top slab.
  s.poly([pts[0], pts[1], pts[2], [40, top + 9], [12, top + 11]], r.light);
  // SE shadow wedge.
  s.poly([[44, 32], pts[4], pts[5], [24, 40]], r.shadow);
  // Straight facet seams.
  for (let y = top + 10; y < 45; y++) {
    const x = 26 + Math.floor((y - top) / 4) + (variant % 2);
    s.px(x, y, r.shadow);
  }
  s.hline(10, 22, top + 11, r.shadow);
  s.hline(30, 42, top + 14, r.shadow);
  // Crack from the notch.
  let cx = 16 + variant * 3;
  for (let y = top + 14; y < 44; y += 2) {
    s.px(cx, y, r.outline);
    cx += rnd() < 0.5 ? 1 : 0;
  }
  s.outline(r.outline);
  // Contact shadow.
  s.hline(6, 44, 47, P.black, 140);
  s.hline(8, 42, 48, P.black, 80);
  return s;
}

/** Barrier: dark plate, bold diagonal hazard band across the middle, rivets, bevel. */
export function barrierTile(variant) {
  const s = new Sprite(T, T);
  s.rect(0, 0, T, T, P.opal);
  // Bevel.
  s.rect(0, 0, T, 2, P.smokeyAsh);
  s.rect(0, 0, 2, T, P.smokeyAsh);
  s.rect(0, T - 2, T, 2, P.valhalla);
  s.rect(T - 2, 0, 2, T, P.valhalla);
  // Hazard band (rows 18-32): bold 45° stripes, alternating gold/black, 6px pitch.
  const off = variant ? 6 : 0;
  for (let y = 18; y <= 32; y++) {
    for (let x = 0; x < T; x++) {
      const k = (x + y + off) % 12;
      s.px(x, y, k < 6 ? P.goldenFizz : P.black);
    }
  }
  s.hline(0, T - 1, 17, P.black);
  s.hline(0, T - 1, 33, P.black);
  // Rivets in the corners.
  for (const [rx, ry] of [
    [5, 6],
    [T - 8, 6],
    [5, T - 10],
    [T - 8, T - 10],
  ]) {
    s.rect(rx, ry, 3, 3, P.smokeyAsh);
    s.px(rx, ry, P.heather);
    s.px(rx + 2, ry + 2, P.valhalla);
  }
  // Plate scratches.
  s.hline(10, 20, 10, P.valhalla);
  s.hline(28, 40, 40, P.valhalla);
  return s;
}

/** Bedrock: big diagonal slabs with clear seams — unbreakable-looking. */
export function bedrockTile() {
  const s = new Sprite(T, T);
  s.rect(0, 0, T, T, P.valhalla);
  // Diagonal slab bands.
  for (let band = -2; band < 4; band++) {
    for (let y = 0; y < T; y++) {
      const x0 = band * 22 + Math.floor(y * 0.6);
      // slab body
      for (let x = x0; x < x0 + 16; x++) {
        if (x >= 0 && x < T) s.px(x, y, P.opal);
      }
      // lit top edge of each slab + black seam
      if (x0 >= 0 && x0 < T) s.px(x0, y, P.smokeyAsh);
      if (x0 - 1 >= 0 && x0 - 1 < T) s.px(x0 - 1, y, P.black);
    }
  }
  // Cross seams.
  s.hline(0, T - 1, 16, P.black);
  s.hline(0, T - 1, 34, P.black);
  for (let x = 0; x < T; x += 2) {
    s.px(x, 17, P.smokeyAsh);
    s.px(x, 35, P.smokeyAsh);
  }
  return s;
}
