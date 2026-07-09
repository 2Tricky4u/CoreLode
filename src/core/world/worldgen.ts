import { BLUEPRINTS, BLUEPRINT_EFFECTS, type BlueprintId } from '../data/blueprints';
import {
  BARRIER_ROW,
  ENTRANCE_COLS,
  HELL_FLOOR_ROW,
  SKY_ROWS,
  SURFACE_ROW,
  WORLD_H,
  WORLD_W,
} from '../data/constants';
import { depthFtToRow } from '../data/constants';
import { WORLDGEN } from '../data/worldgen';
/**
 * Exact port of the original `generateEarth()` (decompiled — docs/calibration.md),
 * driven by a seeded RNG instead of Flash's unseeded random(). Same distributions,
 * same order of rolls, so the terrain statistics match the original faithfully.
 */
import { Rng, hash32 } from '../lib/rng';
import { Tile } from './tiles';

export interface GeneratedWorld {
  tiles: Uint16Array; // WORLD_W × WORLD_H, index = y * WORLD_W + x
  /** Buried relic schematic (Goldium mode), if any. */
  slate: { x: number; y: number; blueprint: BlueprintId } | null;
}

export const idx = (x: number, y: number): number => y * WORLD_W + x;

export function generateWorld(seed: number, goldiumMode: boolean): GeneratedWorld {
  const rng = new Rng(hash32(seed, 0xea87, 0x0));
  const t = new Uint16Array(WORLD_W * WORLD_H);
  const H = WORLD_H;

  for (let x = 0; x < WORLD_W; x++) {
    for (let y = 0; y < H; y++) {
      let cell: number = rng.int(4) + 1; // default dirt variant

      if (y < SKY_ROWS) {
        cell = Tile.Air;
      } else if (y === SURFACE_ROW) {
        cell = rng.int(2) === 0 ? Tile.TurfA : Tile.TurfB;
      } else if (y === BARRIER_ROW) {
        cell = rng.int(2) === 0 ? Tile.BarrierA : Tile.BarrierB;
      } else if (y > H - 11 && y < HELL_FLOOR_ROW) {
        cell = Tile.Air; // arena interior
      } else if (y >= HELL_FLOOR_ROW) {
        cell = Tile.Bedrock; // arena floor band
      } else {
        // Normal underground cell — original roll order preserved.
        if (rng.int(WORLDGEN.seedChance) === 0) {
          if (rng.int(WORLDGEN.seedChance) === 0) {
            if (rng.int(WORLDGEN.seedChance) === 0) {
              if (rng.int(WORLDGEN.artifactChance) === 0 && y > WORLDGEN.artifactMinRow) {
                cell = Tile.ArtifactFirst + rng.int(4);
              } else {
                cell = Math.min(
                  8 + rng.int(Math.floor(y / WORLDGEN.mineralRate) + 2),
                  Tile.MineralLast,
                );
              }
            } else {
              cell = Math.min(
                7 + rng.int(Math.floor(y / WORLDGEN.mineralRate) + 2),
                Tile.MineralLast,
              );
            }
          } else {
            cell = Math.min(
              6 + rng.int(Math.floor(y / WORLDGEN.mineralRate) + 2),
              Tile.MineralLast,
            );
          }
        } else {
          cell = rng.int(5) + 1;
          if (y * 1.5 > H / 3) {
            const v = Math.floor(((H - y) / H) * WORLDGEN.hazardDensityScale);
            if (rng.int(v) === 0) {
              if ((y / 2) * 1.5 > H / 3 && rng.int(2) === 0) {
                if ((y / 3) * 1.5 > H / 3 && rng.int(2) === 0) {
                  cell = Tile.Gas;
                } else {
                  cell = Tile.LavaFirst + rng.int(3);
                }
              } else {
                cell = Tile.BoulderFirst + rng.int(3);
              }
            }
          }
        }
        // Cavern pass applies to EVERY underground cell — including mineral
        // seeds — which is what makes exactly ⅓ of all blocks air (verified
        // by the community's "1 in 3" measurement of the original).
        if (rng.int(WORLDGEN.cavernChance) === 0) cell = Tile.Air;
        // Side walls: outermost two columns are impenetrable.
        if (x < 2 || x >= WORLD_W - 2) cell = Tile.Bedrock;
      }

      // Hell/arena outer walls.
      if (y > BARRIER_ROW && (x < 2 || x >= WORLD_W - 2)) cell = Tile.Bedrock;
      t[idx(x, y)] = cell;
    }
  }

  // Barrier band spans full width except the 2-tile entrance hole on the right.
  for (let x = 0; x < WORLD_W; x++) {
    if (!(ENTRANCE_COLS as readonly number[]).includes(x)) {
      if (x < 2 || x >= WORLD_W - 2) t[idx(x, BARRIER_ROW)] = Tile.Bedrock;
    }
  }
  for (const x of ENTRANCE_COLS) t[idx(x, BARRIER_ROW)] = Tile.Air;

  // Goldium mode: bury exactly one relic schematic (never the drill).
  let slate: GeneratedWorld['slate'] = null;
  if (goldiumMode) {
    const buriable = BLUEPRINTS.filter((b) => b.buried);
    const pick = buriable[rng.int(buriable.length)];
    const minRow = depthFtToRow(BLUEPRINT_EFFECTS.minDepthFt);
    const maxRow = depthFtToRow(BLUEPRINT_EFFECTS.maxDepthFt);
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = 2 + rng.int(WORLD_W - 4);
      const y = minRow + rng.int(Math.max(1, maxRow - minRow));
      const cur = t[idx(x, y)];
      if (cur >= 1 && cur <= 5) {
        t[idx(x, y)] = Tile.Slate;
        slate = { x, y, blueprint: pick.id };
        break;
      }
    }
  }

  return { tiles: t, slate };
}
