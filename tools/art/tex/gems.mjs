import { GEM_RAMPS, P } from '../palette.mjs';
/**
 * Gem overlays — parametric faceted crystals, one DISTINCT silhouette per tier,
 * 3-shade facets, auto 1px outline, specular star. (v2 after round-1 critique:
 * crystals use a vertical half-split so tall prisms don't flatten; ruby cut is
 * deeper; bronzite hexes separated; einsteinium ring is solid.)
 */
import { Sprite } from '../png.mjs';

const place = (pts, cx, cy, rx, ry = rx) => pts.map(([x, y]) => [cx + x * rx, cy + y * ry]);

function facetedPoly(s, unit, cx, cy, rx, ramp, ry = rx) {
  const pts = place(unit, cx, cy, rx, ry);
  s.poly(pts, ramp.base);
  const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
  const nw = pts.filter(([x, y]) => x - c[0] + (y - c[1]) < 0);
  if (nw.length >= 2) s.poly([c, ...nw], ramp.light);
  const se = pts.filter(([x, y]) => x - c[0] + (y - c[1]) > rx * 0.7);
  if (se.length >= 2) s.poly([c, ...se], ramp.shadow);
}

/** Tall prism with a vertical half-split (left lit, right shadowed) + tip light. */
function crystalPoly(s, cx, cy, rx, ry, ramp, lean = 0) {
  const L = [
    [cx + lean, cy - ry], // tip
    [cx - rx, cy - ry * 0.45],
    [cx - rx * 0.8, cy + ry],
    [cx + lean, cy + ry],
  ];
  const R = [
    [cx + lean, cy - ry],
    [cx + rx, cy - ry * 0.45],
    [cx + rx * 0.8, cy + ry],
    [cx + lean, cy + ry],
  ];
  s.poly(R, ramp.shadow);
  s.poly(L, ramp.base);
  // lit sliver along the left edge + tip
  s.poly(
    [
      [cx + lean, cy - ry],
      [cx - rx, cy - ry * 0.45],
      [cx - rx * 0.55, cy - ry * 0.1],
      [cx + lean * 0.5, cy - ry * 0.7],
    ],
    ramp.light,
  );
}

const SHAPES = {
  nugget: [
    [-0.8, -0.3],
    [-0.2, -0.8],
    [0.7, -0.5],
    [0.9, 0.4],
    [0.2, 0.9],
    [-0.7, 0.6],
  ],
  hex: [
    [0, -1],
    [0.87, -0.5],
    [0.87, 0.5],
    [0, 1],
    [-0.87, 0.5],
    [-0.87, -0.5],
  ],
  shard: [
    [-0.2, -1],
    [0.35, -0.4],
    [0.2, 1],
    [-0.35, 0.5],
  ],
  cut: [
    [-1, -0.45],
    [-0.5, -1],
    [0.5, -1],
    [1, -0.45],
    [0, 1],
  ], // crown + deep pavilion
  bar: [
    [-0.9, -0.35],
    [0.9, -0.35],
    [0.9, 0.35],
    [-0.9, 0.35],
  ],
};

function star(s, x, y, big) {
  s.px(x, y, P.white);
  s.px(x - 1, y, P.white);
  s.px(x + 1, y, P.white);
  s.px(x, y - 1, P.white);
  s.px(x, y + 1, P.white);
  if (big) {
    s.px(x - 2, y, P.lightSteel);
    s.px(x + 2, y, P.lightSteel);
    s.px(x, y - 2, P.lightSteel);
  }
}

export function gemSprite(tier, size) {
  const s = new Sprite(size, size);
  const ramp = GEM_RAMPS[tier];
  const u = size / 50;
  const R = (f) => Math.max(3, Math.round(f * u));
  switch (tier) {
    case 0: // ferrite — three rough nuggets
      facetedPoly(s, SHAPES.nugget, 16 * u, 30 * u, R(9), ramp);
      facetedPoly(s, SHAPES.nugget, 33 * u, 33 * u, R(11), ramp);
      facetedPoly(s, SHAPES.nugget, 27 * u, 17 * u, R(7), ramp);
      break;
    case 1: // bronzite — two chunky nuggets (bronze-warm)
      facetedPoly(s, SHAPES.nugget, 17 * u, 30 * u, R(11), ramp);
      facetedPoly(s, SHAPES.nugget, 35 * u, 20 * u, R(8), ramp);
      break;
    case 2: // argentite — three leaning shards
      facetedPoly(s, SHAPES.shard, 16 * u, 27 * u, R(12), ramp);
      facetedPoly(s, SHAPES.shard, 27 * u, 30 * u, R(14), ramp);
      facetedPoly(s, SHAPES.shard, 37 * u, 26 * u, R(10), ramp);
      break;
    case 3: // aurite — nugget cluster (gold)
      facetedPoly(s, SHAPES.nugget, 18 * u, 32 * u, R(9), ramp);
      facetedPoly(s, SHAPES.nugget, 32 * u, 28 * u, R(10), ramp);
      facetedPoly(s, SHAPES.nugget, 25 * u, 18 * u, R(7), ramp);
      star(s, 30 * u, 24 * u, false);
      break;
    case 4: // platinite — twin polished ingots with sheen
      facetedPoly(s, SHAPES.bar, 24 * u, 22 * u, R(12), ramp);
      facetedPoly(s, SHAPES.bar, 27 * u, 33 * u, R(13), ramp);
      s.hline(15 * u, 30 * u, 20 * u, ramp.light);
      s.hline(18 * u, 34 * u, 31 * u, ramp.light);
      star(s, 20 * u, 19 * u, false);
      break;
    case 5: {
      // einsteinium — glowing orb + solid ring
      s.circle(25 * u, 26 * u, R(10), ramp.shadow);
      s.circle(24 * u, 25 * u, R(8), ramp.base);
      s.circle(22 * u, 23 * u, R(4), ramp.light);
      for (let a = 0; a < Math.PI * 2; a += 0.03) {
        const x = Math.round(25 * u + Math.cos(a) * R(14));
        const y = Math.round(26 * u + Math.sin(a) * R(14) * 0.45);
        s.px(x, y, ramp.light);
        s.px(x, y + 1, ramp.base);
      }
      star(s, 21 * u, 22 * u, true);
      break;
    }
    case 6: // emerald — twin tall prisms
      crystalPoly(s, 19 * u, 27 * u, R(7), R(14), ramp, -1);
      crystalPoly(s, 33 * u, 31 * u, R(5), R(10), ramp, 1);
      star(s, 17 * u, 16 * u, false);
      break;
    case 7: // ruby — deep classic cut, point down
      facetedPoly(s, SHAPES.cut, 25 * u, 24 * u, R(13), ramp, R(15));
      s.hline(18 * u, 32 * u, 14 * u, ramp.light); // crown table sheen
      star(s, 20 * u, 18 * u, true);
      break;
    case 8: // diamond — big brilliant + small companion
      facetedPoly(s, SHAPES.cut, 23 * u, 24 * u, R(14), ramp, R(14));
      facetedPoly(s, SHAPES.cut, 39 * u, 34 * u, R(6), ramp, R(6));
      star(s, 18 * u, 19 * u, true);
      star(s, 30 * u, 21 * u, false);
      break;
    default: // 9 amazonite — grand triple crystal, tallest in the set
      crystalPoly(s, 14 * u, 30 * u, R(6), R(13), ramp, -1);
      crystalPoly(s, 25 * u, 25 * u, R(8), R(19), ramp, 0);
      crystalPoly(s, 37 * u, 31 * u, R(6), R(12), ramp, 1);
      star(s, 25 * u, 8 * u, true);
      star(s, 14 * u, 19 * u, false);
      break;
  }
  s.outline(ramp.outline);
  return s;
}
