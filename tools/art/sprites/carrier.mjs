/**
 * The orbital carrier that deposits the pod at the start of a contract —
 * intro cinematic only, never gameplay. ~44×15 char grid ×2 → ~88×30 px:
 * a wide steel dropship, cockpit strip left (top-left light), hazard-striped
 * winch block under the hull centre, twin engine nacelles, red beacon on top.
 * Legend: o outline · S/B/L steel ramp · g/G canopy · w specular · y hazard ·
 *         r beacon · t nozzle interior
 */
import { grid } from '../grid.mjs';
import { CANOPY, P, POD_STEEL } from '../palette.mjs';

const L = {
  o: P.black,
  S: POD_STEEL.shadow,
  B: POD_STEEL.base,
  L: POD_STEEL.light,
  g: CANOPY.base,
  G: CANOPY.light,
  w: P.white,
  y: P.goldenFizz,
  r: P.mandy,
  t: P.valhalla,
};

// biome-ignore format: pixel grids are aligned by hand
const BODY = [
  '....................oro.....................',
  '.....ooooooooooooooooooooooooooooooooo......',
  '....oLLLLLLLLLLLLLLLLLLLBBBBBBBBBBBBBBo.....',
  '...oLLggGGGGggLLLLLLLLLBBBBBBBBBBBBBBBBo....',
  '...oLggGwwGGgggLLLLLLBBBBBBBBBBBBBBBBBBo....',
  '...oLggGGGggggggLLBBBBBBBBBBBBBBBBBByyBo....',
  '...oLLgggggggggBBBBBBBBBBBBBBBBBBBBByyBo....',
  '...oLLLLLLLLBBBBBBBBBBBBBBBBSSSSSSSSSSSo....',
  '...oLLLBBBBBBBBSSSSSSSSSSSSSSSSSSSSSSSSo....',
  '....oBBBSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSo.....',
  '.....ooooooooooooooooooooooooooooooooo......',
  '........oBto........oyyo......oBto..........',
  '.........oto.........oo.......oto...........',
];

export function carrierFrames() {
  return { carrier: grid(BODY, L) };
}
