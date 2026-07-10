/**
 * The mining pod — 25×25 char grids ×2 → 50px frames.
 * Legend: o outline · s/b/l pod ramp (shadow/base/light) · S/B/L steel ramp ·
 *         g/G canopy base/light · t tread dark · T tread lug · d drill dark · D drill light
 * Light: top-left. Facing right; left frames mirror at compose time.
 */
import { grid } from '../grid.mjs';
import { CANOPY, P, POD_RAMP, POD_STEEL } from '../palette.mjs';
import { Sprite } from '../png.mjs';

const L = {
  o: P.black,
  s: POD_RAMP.shadow,
  b: POD_RAMP.base,
  l: POD_RAMP.light,
  S: POD_STEEL.shadow,
  B: POD_STEEL.base,
  L: POD_STEEL.light,
  g: CANOPY.base,
  G: CANOPY.light,
  w: P.white,
  t: P.valhalla,
  T: P.smokeyAsh,
  d: P.smokeyAsh,
  D: P.heather,
  y: P.goldenFizz,
  r: P.mandy,
};

// biome-ignore format: pixel grids are aligned by hand
const BODY = [
  '.....ooooooooo...........',
  '....olGGGGggggo..........',
  '...olGGwwGggggso.........',
  '...oGGwGGgggggso.........',
  '...oGGGggggggsso.........',
  '...ollllllllbbso.........',
  '..ollllbbbbbbbbso........',
  '..olbbbbbbbbbbbsso.......',
  '..olbbbbbbbbbbbbso.......',
  '..olbbyybbbbbbbsso.......',
  '..olbbyybbbbbbbsso.......',
  '..olbbbbbbbbbbssso.......',
  '..olbbbbbbbbssssso.......',
  '..oLLLLLLLLLLLLBBo.......',
  '..oLBBBBBBBBBBBBBo.......',
  '...oBBBBBBBBBBBSo........',
  '...ooooooooooooo.........',
  '..otTtTtTtTtTtTto........',
  '.ottttttttttttttto.......',
  '.otTtTtTtTtTtTtTto.......',
  '.ottttttttttttttto.......',
  '..oTtTtTtTtTtTtTo........',
  '...oooooooooooo..........',
  '.........................',
  '.........................',
];

// biome-ignore format: pixel grids are aligned by hand
const ARM_SIDE = [
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '...............ooo.......',
  '..............oLLBo......',
  '..............oBBBooo....',
  '...............ooDDDDo...',
  '...............oDDDdddo..',
  '...............oDDddddo..',
  '...............ooDDdddo..',
  '................oooddo...',
  '..................ooo....',
];

// Down drill: full-size auger emerging BELOW the tread band (rows 23+ clear the
// body entirely), matching the side drill's cone length. 28 rows → 56px frame.
// biome-ignore format: pixel grids are aligned by hand
const ARM_DOWN = [
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.........................',
  '.......oooooo............',
  '......oLBBBBBo...........',
  '......oBDDDDDo...........',
  '......oDDDDDdo...........',
  '......oDDDDddo...........',
  '.......oDDDddo...........',
  '.......oDDddo............',
  '........oddo.............',
  '.........oo..............',
];

const overlay = (base, over) => {
  // Tall canvas: the down drill extends below the 50px body (frame is 56px).
  const s = new Sprite(base.w, FRAME_H);
  s.blit(base, 0, 0);
  s.blit(over, 0, 0);
  return s;
};

/**
 * Rotating-auger illusion: rewrite the drill cone's two greys (d/D) into helix
 * thread bands that crawl along the dig axis each phase (4 phases = one cycle).
 * Applied to the ARM sprite only — the body's treads share these colors.
 */
const same = (r, g, b, c) => r === c[0] && g === c[1] && b === c[2];
function threadify(arm, axis, phase) {
  const s = arm.clone();
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const [r, g, b, a] = s.get(x, y);
      if (a === 0) continue;
      if (!same(r, g, b, P.smokeyAsh) && !same(r, g, b, P.heather)) continue;
      // helix slant: the off-axis coordinate shears the band by half its value
      const t = axis === 'y' ? y + (x >> 1) : x + (y >> 1);
      s.px(x, y, (t + phase) % 4 < 2 ? P.heather : P.smokeyAsh);
    }
  return s;
}

/**
 * The grids draw the hull left-of-centre (columns 2-35 of 50) so the side drill
 * arm has room. PodView renders at origin 0.5, so as authored the hull sits 6px
 * left of the pod's collision box and visibly clips into unmined rock on the
 * left. Re-home every frame on a 60px-wide canvas with the HULL centred; the arm
 * then still fits inside the frame.
 */
const FRAME_W = 60;
/** 56 not 50: the down-drill auger hangs below the body. The body still occupies
 *  rows 0-49, so PodView anchors with origin y = 25/56 to keep alignment. */
const FRAME_H = 56;
const HULL_SHIFT = 11; // hull centre 18.5 → 29.5 = centre of a 60px frame

const recenter = (sprite) => {
  const out = new Sprite(FRAME_W, FRAME_H);
  out.blit(sprite, HULL_SHIFT, 0);
  return out;
};

export function podFrames() {
  const base = grid(BODY, L);
  // 4 spin phases per drill direction; odd phases judder 1 px along the dig axis.
  const sideArm = grid(ARM_SIDE, L);
  const downArm = grid(ARM_DOWN, L);
  const sides = [0, 1, 2, 3].map((ph) =>
    overlay(base, threadify(ph % 2 ? sideArm.shifted(1, 0) : sideArm, 'x', ph)),
  );
  const downs = [0, 1, 2, 3].map((ph) =>
    overlay(base, threadify(ph % 2 ? downArm.shifted(0, 1) : downArm, 'y', ph)),
  );
  // fly frames: base nudged (bob) — flame itself is a runtime particle + glow
  const fly0 = base.clone();
  const fly1 = base.shifted(0, -1);
  // hurt: base + scratch decals
  const hurt = base.clone();
  const scratches = grid(
    [
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '....rr...................',
      '.....rr......r...........',
      '......r.....rr...........',
      '.........................',
      '.....r.......r...........',
      '....rr........r..........',
      '.........................',
      '.........rr..............',
    ],
    L,
  );
  hurt.blit(scratches, 0, 0);

  // Battered-hull decal overlays (drawn above the pod at hp thresholds).
  // Kept inside the hull silhouette so the decal never pokes past the outline.
  // biome-ignore format: pixel grids are aligned by hand
  const scuff1 = grid(
    [
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '....ss...................',
      '.....s......s............',
      '.........................',
      '..........ss.............',
      '....s.....s..............',
      '.....ss..................',
      '.........................',
      '......t........t.........',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
    ],
    L,
  );
  // biome-ignore format: pixel grids are aligned by hand
  const scuff2 = grid(
    [
      '.........................',
      '.........................',
      '.....t...................',
      '......tt.....t...........',
      '.........................',
      '.........................',
      '....ss....o..............',
      '...oss...oo....s.........',
      '....so...o....ss.........',
      '.....o.......s...........',
      '....o.....ss.............',
      '...os.....so.............',
      '....ss...oo..............',
      '......t..o.....t.........',
      '.....tt.......tt.........',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
      '.........................',
    ],
    L,
  );

  return Object.fromEntries(
    Object.entries({
      pod_idle: base,
      pod_fly0: fly0,
      pod_fly1: fly1,
      pod_drill_down0: downs[0],
      pod_drill_down1: downs[1],
      pod_drill_down2: downs[2],
      pod_drill_down3: downs[3],
      pod_drill_side0: sides[0],
      pod_drill_side1: sides[1],
      pod_drill_side2: sides[2],
      pod_drill_side3: sides[3],
      pod_hurt: hurt,
      pod_scuff1: scuff1,
      pod_scuff2: scuff2,
    }).map(([k, v]) => [k, recenter(v)]),
  );
}
