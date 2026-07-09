import type { BlueprintId } from '../data/blueprints';
/**
 * Mutable world state. The whole 36×600 grid is materialized (21,600 cells —
 * trivial), which keeps earthquakes (whole-row shifts) and saves (deflated
 * array) simple and exact.
 */
import { WORLD_H, WORLD_W } from '../data/constants';
import { QUAKE } from '../data/worldgen';
import type { Rng } from '../lib/rng';
import { Tile, isSolid } from './tiles';
import { type GeneratedWorld, generateWorld, idx } from './worldgen';

export interface WorldState {
  tiles: Uint16Array;
  slate: { x: number; y: number; blueprint: BlueprintId } | null;
}

export const createWorld = (seed: number, goldiumMode: boolean): WorldState => {
  const g: GeneratedWorld = generateWorld(seed, goldiumMode);
  return { tiles: g.tiles, slate: g.slate };
};

export const getTile = (w: WorldState, x: number, y: number): number => {
  if (x < 0 || x >= WORLD_W || y >= WORLD_H) return Tile.Bedrock;
  if (y < 0) return Tile.Air; // open sky above the map
  return w.tiles[idx(x, y)];
};

export const setTile = (w: WorldState, x: number, y: number, t: number): void => {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return;
  w.tiles[idx(x, y)] = t;
};

export const solidAt = (w: WorldState, x: number, y: number): boolean => isSolid(getTile(w, x, y));

/**
 * Earthquake — exact original behavior: each eligible row shifts one tile left
 * or right (wraparound) with chance 1/(5 − intensity).
 * Returns the rows that shifted (for the renderer to repaint).
 */
export function earthquake(w: WorldState, rng: Rng, intensity: number): number[] {
  const shifted: number[] = [];
  const chance = Math.max(1, 5 - intensity);
  for (let y = QUAKE.minRow; y < WORLD_H - QUAKE.maxRowFromBottom; y++) {
    if (rng.int(chance) !== 0) continue;
    const row = w.tiles.subarray(y * WORLD_W, (y + 1) * WORLD_W);
    // Keep the two wall columns intact; rotate the interior span.
    const interior = row.subarray(2, WORLD_W - 2);
    if (rng.int(2) === 0) {
      const first = interior[0];
      interior.copyWithin(0, 1);
      interior[interior.length - 1] = first;
    } else {
      const last = interior[interior.length - 1];
      interior.copyWithin(1, 0, interior.length - 1);
      interior[0] = last;
    }
    // Track the slate if its row shifted.
    if (w.slate && w.slate.y === y) {
      // find it again in the row
      for (let x = 2; x < WORLD_W - 2; x++) {
        if (row[x - 0] === Tile.Slate) {
          w.slate.x = x;
          break;
        }
      }
    }
    shifted.push(y);
  }
  return shifted;
}
