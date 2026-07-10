/**
 * Worldgen parameters — the algorithm itself (an exact port of the original
 * `generateEarth`) lives in core/world/worldgen.ts. See docs/calibration.md.
 */
import { CAL } from './physics';

export const WORLDGEN = {
  /** Depth divisor for the mineral-tier spread: random(int(row/65)+2). */
  mineralRate: 65,
  /** Artifacts only spawn below this row (row 80 = −937.5 ft, "below ~1000 ft"). */
  artifactMinRow: 80,
  /** 1-in-N chance chains for mineral seeding (see algorithm). */
  seedChance: 5,
  artifactChance: 4,
  /** Hazard gates as fractions of world height (exact expressions from code). */
  boulderRowFactor: 1 / 4.5, // y*1.5 > H/3  ⇔  y > H/4.5
  lavaRowFactor: 1 / 2.25, // y/2*1.5 > H/3 ⇔  y > H/2.25
  gasRowFactor: 2 / 3, // y/3*1.5 > H/3 ⇔  y > 2H/3
  /** Hazard density: random(int((H−y)/H×15)) == 0. */
  hazardDensityScale: 15,
  /** Final pass: random(3)==0 → empty cavern (the famous ⅓ air). */
  cavernChance: 3,
} as const;

/** Minimap fog-of-war tuning (remake QoL — the sim only bookkeeps the grid). */
export const DISCOVERY = {
  /** Cells within this Chebyshev radius of the pod are revealed permanently. */
  radiusTiles: 4,
  /** Rows 0..N start revealed (sky + turf are in plain sight from the drop). */
  surfaceRows: 5,
} as const;

export const QUAKE = {
  /** Row-shift chance is 1/(5−intensity); rows 11..H−15 are eligible (original). */
  minRow: 11,
  maxRowFromBottom: 15,
  /** Remake schedule (original trigger cadence not recovered). */
  intensity: CAL(1, 'periodic quakes use the weakest intensity: 25% of rows shift'),
  minIntervalTicks: CAL(42 * 90, 'first quake no sooner than ~90 s below the depth gate'),
  maxIntervalTicks: CAL(42 * 240, 'and no later than ~4 min'),
  /** Quakes only start once the pod has been below this depth. */
  depthGateFt: CAL(-1000, 'the −1000 ft transmission introduces quakes'),
} as const;
