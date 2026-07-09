import { grid } from './grid.mjs';
import { P } from './palette.mjs';
/** FX sprites: explosion frames, additive glow discs, particles, fireball, guardian, teleport. */
import { Sprite, texRng } from './png.mjs';

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
