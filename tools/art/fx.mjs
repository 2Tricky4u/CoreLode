import { grid } from './grid.mjs';
import { P } from './palette.mjs';
/** FX sprites: explosion frames, additive glow discs, particles, fireball, guardian, teleport. */
import { Sprite, texRng } from './png.mjs';
import { soilTile } from './tex/soil.mjs';

/** Soft radial glow disc (for ADD blend) — alpha falls off quadratically. */
export function glowDisc(size, color) {
  const s = new Sprite(size, size);
  const r = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - r + 0.5, y - r + 0.5) / r;
      if (d >= 1) continue;
      const a = Math.round(255 * (1 - d) * (1 - d));
      if (a > 4) s.px(x, y, color, a);
    }
  return s;
}

export function explosionFrames() {
  const out = {};
  // 0: white flash core, 1-2: fireball, 3-4: expanding smoky ring
  const specs = [
    { r: 10, core: P.white, rim: P.goldenFizz, ring: false },
    { r: 16, core: P.goldenFizz, rim: P.tahitiGold, ring: false },
    { r: 22, core: P.tahitiGold, rim: P.brown, ring: false },
    { r: 26, core: null, rim: P.brown, ring: true },
    { r: 29, core: null, rim: P.smokeyAsh, ring: true },
  ];
  specs.forEach((sp, i) => {
    const s = new Sprite(60, 60);
    const rnd = texRng(0xb003 + i);
    if (sp.ring) {
      // solid 3px ring band with smoky inner edge
      for (let y = 0; y < 60; y++)
        for (let x = 0; x < 60; x++) {
          const d = Math.hypot(x - 30, y - 30);
          if (d <= sp.r && d >= sp.r - 3) s.px(x, y, sp.rim, 235 - i * 30);
          else if (d < sp.r - 3 && d >= sp.r - 5) s.px(x, y, P.valhalla, 150);
        }
      // ragged outer sparks
      for (let k = 0; k < 16; k++) {
        const a = rnd() * Math.PI * 2;
        s.px(
          Math.round(30 + Math.cos(a) * (sp.r + 1)),
          Math.round(30 + Math.sin(a) * (sp.r + 1)),
          sp.rim,
          200,
        );
      }
    } else {
      s.circle(30, 30, sp.r, sp.rim);
      s.circle(28, 28, Math.max(2, sp.r - 5), sp.core ?? sp.rim);
      // jagged edge sparks
      for (let k = 0; k < 10; k++) {
        const a = rnd() * Math.PI * 2;
        s.px(
          Math.round(30 + Math.cos(a) * (sp.r + 2)),
          Math.round(30 + Math.sin(a) * (sp.r + 2)),
          sp.rim,
        );
      }
    }
    out[`boom${i}`] = s;
  });
  return out;
}

export function particleFrames() {
  const out = {};
  // dust chunks (tinted at runtime)
  for (let i = 0; i < 3; i++) {
    const s = new Sprite(6, 6);
    const rnd = texRng(0xd05 + i);
    s.rect(1, 1, 3 + Math.floor(rnd() * 2), 3, P.white);
    s.px(1, 1, P.white);
    out[`dust${i}`] = s;
  }
  // 2px spark / mote / ember (white — tint at runtime)
  const spark = new Sprite(4, 4);
  spark.rect(1, 1, 2, 2, P.white);
  out.spark = spark;
  const mote = new Sprite(3, 3);
  mote.px(1, 1, P.white, 200);
  mote.px(1, 0, P.white, 90);
  mote.px(0, 1, P.white, 90);
  out.mote = mote;
  // smoke puff (soft grey blob)
  const smoke = new Sprite(14, 14);
  for (let y = 0; y < 14; y++)
    for (let x = 0; x < 14; x++) {
      const d = Math.hypot(x - 7, y - 7) / 7;
      if (d < 1) smoke.px(x, y, P.smokeyAsh, Math.round(160 * (1 - d)));
    }
  out.smoke = smoke;
  // gas puff (sickly green blob)
  const gas = new Sprite(40, 40);
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 40; x++) {
      const d = Math.hypot(x - 20, y - 20) / 20;
      if (d < 1) gas.px(x, y, x % 3 === 0 ? P.christi : P.atlantis, Math.round(150 * (1 - d)));
    }
  out.gasPuff = gas;
  return out;
}

/**
 * Drill-progress overlays: bite_down0..3 / bite_side0..3 — a ragged hole carved
 * out of the tile from the drilled face (top entry leaves the block reading as
 * a U). The notch interior is painted the cave background color, which is
 * indistinguishable from a real dug hole over the tilemap. Crack hairlines
 * radiate from the notch rim. side frames enter from the LEFT face; the scene
 * flips them for right-face (leftward) digs.
 */
export function biteFrames() {
  const BG = [20, 12, 28]; // matches the camera background = "transparent" hole
  const out = {};
  const DEPTHS = [7, 14, 23, 34]; // how far the notch has eaten in, per stage
  for (let stage = 0; stage < 4; stage++) {
    const depth = DEPTHS[stage];
    const half = 9 + stage * 2; // notch half-width, widening as the auger sinks
    for (const face of ['down', 'side']) {
      const s = new Sprite(50, 50);
      const rnd = texRng(0xb17e + (face === 'down' ? 0 : 97)); // stable per face
      const cracks = [];
      for (let i = -half; i <= half; i++) {
        // rounded tip + ragged crumble edge
        const d = Math.max(2, depth - (i * i) / half + Math.floor(rnd() * 4) - 2);
        if (face === 'down') {
          const x = 25 + i;
          for (let y = 0; y < d; y++) s.px(x, y, BG);
          s.px(x, Math.round(d), P.black, 215); // rim
          if (rnd() < 0.35) s.px(x, Math.round(d) + 1, P.black, 110);
        } else {
          const y = 25 + i;
          for (let x = 0; x < d; x++) s.px(x, y, BG);
          s.px(Math.round(d), y, P.black, 215);
          if (rnd() < 0.35) s.px(Math.round(d) + 1, y, P.black, 110);
        }
        if (Math.abs(Math.abs(i) - (half - 2)) < 1) cracks.push(i); // seed cracks near corners
      }
      // Hairline cracks wandering on from the notch rim.
      for (const i of cracks.slice(0, 2 + stage)) {
        let a = face === 'down' ? Math.PI / 2 + (i < 0 ? 0.5 : -0.5) : (i < 0 ? -0.4 : 0.4);
        let x = face === 'down' ? 25 + i : depth;
        let y = face === 'down' ? depth : 25 + i;
        for (let d = 0; d < 6 + stage * 3; d++) {
          x += Math.cos(a);
          y += Math.sin(a);
          a += (rnd() - 0.5) * 0.6;
          const xi = Math.round(x);
          const yi = Math.round(y);
          if (s.a(xi, yi) === 0) s.px(xi, yi, P.black, 190);
        }
      }
      out[`bite_${face}${stage}`] = s;
    }
  }
  return out;
}

/**
 * Corner softeners + wall roughness for dug tunnels — baked PER DEPTH BAND from
 * the real soil textures (so a piece carries the same material as the block it
 * extends; no flat-tint patches). Mirrored into other orientations at runtime.
 *  - cornerRound_p0..5 (14px): the "rounded-rectangle mask" piece — an R×R
 *    wedge hugging a corner point, solid OUTSIDE a quarter circle centered on
 *    the opposite corner; the CONCAVE arc smooths outer void corners.
 *  - cornerCut (7px, cave-colored, band-free): the same wedge mask laid ON a
 *    lone solid corner (pillars, inner turns) — visually rounds the square
 *    tile's own tip by cutting it to the cave background, nothing added around.
 *  - edgeLump{0..2}_p{band} / edgeLumpV{0..2}_p{band}: low irregular mounds
 *    hung on tunnel walls (H hug the top edge bulging down; V hug the left
 *    edge bulging right), pseudo-randomly placed to break the straight lines.
 */
export function cornerFrames() {
  const out = {};
  // Lump silhouettes are shared across bands (same shapes, different material).
  // v0-4: common small asymmetric mounds (~2.4px). v5-6: rare LONG low ridges.
  // v7-8: tiny pebbles. v9: double-hump. v10: ragged plateau. The scene picks
  // with weights so the small ones dominate and the odd ones appear rarely.
  const beta = (a, b) => (t) => t ** a * (1 - t) ** b;
  const LUMP_SPECS = [
    { L: 12, amp: 2.4, prof: beta(1.2, 2.6) },
    { L: 8, amp: 2.4, prof: beta(2.4, 1.2) },
    { L: 14, amp: 2.4, prof: beta(1.4, 3.2) },
    { L: 10, amp: 2.4, prof: beta(3.0, 1.4) },
    { L: 16, amp: 2.4, prof: beta(2.0, 2.2) },
    { L: 26, amp: 1.8, prof: (t) => beta(1.3, 1.6)(t) * (0.7 + 0.3 * Math.sin(t * 9 + 1)) },
    { L: 30, amp: 2.0, prof: (t) => beta(1.2, 2.1)(t) * (0.75 + 0.25 * Math.sin(t * 12)) },
    { L: 5, amp: 2.2, prof: beta(1.5, 1.5) },
    { L: 4, amp: 1.8, prof: beta(1.2, 1.2) },
    { L: 18, amp: 2.2, prof: (t) => beta(2.2, 4)(t) + 0.85 * beta(5, 1.8)(t) },
    { L: 14, amp: 2.6, prof: (t) => Math.min(1, 3.2 * t, 3.2 * (1 - t)) },
  ];
  const lumpDepths = LUMP_SPECS.map(({ L, amp, prof }, v) => {
    const rnd = texRng(0x1a4b + v * 7);
    const raw = [];
    let peak = 0;
    for (let x = 0; x < L; x++) {
      const val = Math.max(0, prof((x + 0.5) / L));
      raw.push(val);
      if (val > peak) peak = val;
    }
    return raw.map((val) => Math.max(0, Math.round((val / peak) * amp + rnd() * 1.2 - 0.6)));
  });

  for (let band = 0; band < 6; band++) {
    const tex = soilTile(band, 2);
    // Sample away from the tile's baked bottom/right edge-darkening.
    const sm = (x, y, a = 255) => {
      const [r, g, b] = tex.get(8 + (x % 34), 8 + (y % 34));
      return [[r, g, b], a];
    };
    const wedge = (R) => {
      const s = new Sprite(R, R);
      for (let y = 0; y < R; y++)
        for (let x = 0; x < R; x++) {
          const jag = ((x * 31 + y * 17) % 3) * 0.3; // deterministic crumble
          const d = Math.hypot(R - x - 0.5, R - y - 0.5) + jag;
          if (d > R + 0.8) s.px(x, y, ...sm(x, y));
          else if (d > R - 0.8) s.px(x, y, ...sm(x, y, 110)); // soft arc edge
        }
      return s;
    };
    out[`cornerRound_p${band}`] = wedge(14);

    for (let v = 0; v < LUMP_SPECS.length; v++) {
      const L = LUMP_SPECS[v].L;
      const depth = lumpDepths[v];
      const h = new Sprite(L, 5);
      const vs = new Sprite(5, L);
      for (let x = 0; x < L; x++) {
        for (let y = 0; y < depth[x]; y++) {
          h.px(x, y, ...sm(x + 13, y));
          vs.px(y, x, ...sm(y, x + 13)); // transposed sampling keeps the grain upright
        }
        if (depth[x] > 0) {
          h.px(x, depth[x], ...sm(x + 13, depth[x], 100)); // soft underside
          vs.px(depth[x], x, ...sm(depth[x], x + 13, 100));
        }
      }
      out[`edgeLump${v}_p${band}`] = h;
      out[`edgeLumpV${v}_p${band}`] = vs;
    }
  }

  // cornerCut: cave-colored wedge that rounds a lone solid corner's own tip.
  const CUT_R = 7;
  const BGC = [20, 12, 28]; // camera background — reads as void
  const cut = new Sprite(CUT_R, CUT_R);
  for (let y = 0; y < CUT_R; y++)
    for (let x = 0; x < CUT_R; x++) {
      const jag = ((x * 31 + y * 17) % 3) * 0.3;
      const d = Math.hypot(CUT_R - x - 0.5, CUT_R - y - 0.5) + jag;
      if (d > CUT_R + 0.8) cut.px(x, y, BGC);
      else if (d > CUT_R - 0.8) cut.px(x, y, BGC, 110);
    }
  out.cornerCut = cut;
  return out;
}

export function miscFx() {
  const out = {};
  // fireball with outline + hot core + trailing edge
  const fb = new Sprite(22, 22);
  fb.circle(11, 11, 9, P.tahitiGold);
  fb.circle(9, 9, 5, P.goldenFizz);
  fb.circle(8, 8, 2, P.white);
  fb.outline(P.brown);
  out.fireball = fb;
  // laser dot
  const beam = new Sprite(8, 8);
  beam.circle(4, 4, 3, P.mandy);
  beam.circle(3, 3, 1, P.white);
  out.laserDot = beam;
  // teleport shimmer column
  const tp = new Sprite(50, 60);
  const rnd = texRng(0x7e1e);
  for (let y = 0; y < 60; y += 2) {
    const w = 10 + Math.floor(rnd() * 22);
    const x = 25 - w / 2;
    tp.hline(x, x + w, y, P.viking, 210 - y * 2);
    tp.hline(x + 2, x + w - 2, y + 1, P.lightSteel, 120 - y);
  }
  out.teleBeam = tp;
  // glow discs
  out.glow32 = glowDisc(32, P.white);
  out.glow64 = glowDisc(64, P.white);
  // guardian seraph 17×22 ×2
  const G = {
    o: P.black,
    w: P.white,
    W: P.lightSteel,
    k: P.pancho,
    y: P.goldenFizz,
    v: P.viking,
  };
  // biome-ignore format: pixel grid
  out.guardian = grid(
    [
      '......yyyyy......',
      '.....y.....y.....',
      '......okko.......',
      '.....okkkko......',
      '......okko.......',
      '.oo...owwo...oo..',
      'oWWo.owwwwo.oWWo.',
      'oWWWowwwwwwoWWWo.',
      'oWWWowwvwwwoWWWo.',
      '.oWWowwwwwwoWWo..',
      '.oWWowwvwwwoWWo..',
      '..oWowwwwwwoWo...',
      '...oowwvwwoo.....',
      '.....owwwo.......',
      '.....owwwo.......',
      '......owo........',
      '......owo........',
      '.......o.........',
      '.................',
      '.................',
      '.................',
      '.................',
    ],
    G,
  );
  return out;
}
