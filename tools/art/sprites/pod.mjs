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
  '.........oooo............',
  '........oLBBBo...........',
  '........oBDDDo...........',
  '........oDDDdo...........',
  '.........oDddo...........',
  '.........oddo............',
  '..........oo.............',
];

const overlay = (base, over) => {
  const s = base.clone();
  s.blit(over, 0, 0);
  return s;
};

/**
 * The grids draw the hull left-of-centre (columns 2-35 of 50) so the side drill
 * arm has room. PodView renders at origin 0.5, so as authored the hull sits 6px
 * left of the pod's collision box and visibly clips into unmined rock on the
 * left. Re-home every frame on a 60px-wide canvas with the HULL centred; the arm
 * then still fits inside the frame.
 */
const FRAME_W = 60;
const FRAME_H = 50;
const HULL_SHIFT = 11; // hull centre 18.5 → 29.5 = centre of a 60px frame

const recenter = (sprite) => {
  const out = new Sprite(FRAME_W, FRAME_H);
  out.blit(sprite, HULL_SHIFT, 0);
  return out;
};

export function podFrames() {
  const base = grid(BODY, L);
  const side0 = overlay(base, grid(ARM_SIDE, L));
  const side1 = overlay(base, grid(ARM_SIDE, L).shifted(2, 0));
  const down0 = overlay(base, grid(ARM_DOWN, L));
  const down1 = overlay(base, grid(ARM_DOWN, L).shifted(0, 2));
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
  return Object.fromEntries(
    Object.entries({
      pod_idle: base,
      pod_fly0: fly0,
      pod_fly1: fly1,
      pod_drill_down0: down0,
      pod_drill_down1: down1,
      pod_drill_side0: side0,
      pod_drill_side1: side1,
      pod_hurt: hurt,
    }).map(([k, v]) => [k, recenter(v)]),
  );
}
