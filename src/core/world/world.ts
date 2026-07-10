import type { BlueprintId } from '../data/blueprints';
/**
 * Mutable world state. The whole 36×600 grid is materialized (21,600 cells —
 * trivial), which keeps earthquakes (whole-row shifts) and saves (deflated
 * array) simple and exact.
 */
import { WORLD_H, WORLD_W } from '../data/constants';
import { DISCOVERY, QUAKE } from '../data/worldgen';
import type { Rng } from '../lib/rng';
import { Tile, isSolid } from './tiles';
import { type GeneratedWorld, generateWorld, idx } from './worldgen';

export interface WorldState {
  tiles: Uint16Array;
  slate: { x: number; y: number; blueprint: BlueprintId } | null;
  /** Minimap fog of war: 1 = the pod has been near this cell (never re-fogs). */
  discovered: Uint8Array;
}

export const createWorld = (seed: number, goldiumMode: boolean): WorldState => {
  const g: GeneratedWorld = generateWorld(seed, goldiumMode);
  const discovered = new Uint8Array(WORLD_W * WORLD_H);
  // The sky and surface are in plain sight from the drop — start them revealed.
  discovered.fill(1, 0, (DISCOVERY.surfaceRows + 1) * WORLD_W);
  return { tiles: g.tiles, slate: g.slate, discovered };
};

/** Reveal the square around a pod tile on the minimap (idempotent). */
export function markDiscovered(w: WorldState, tx: number, ty: number): void {
  const r = DISCOVERY.radiusTiles;
  const x0 = Math.max(0, tx - r);
  const x1 = Math.min(WORLD_W - 1, tx + r);
  const y0 = Math.max(0, ty - r);
  const y1 = Math.min(WORLD_H - 1, ty + r);
  for (let y = y0; y <= y1; y++) w.discovered.fill(1, y * WORLD_W + x0, y * WORLD_W + x1 + 1);
}

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
    // Keep the two wall columns intact; rotate the interior span. The fog-of-war
    // map rotates in lockstep so discovered cells keep tracking their tiles.
    const interior = row.subarray(2, WORLD_W - 2);
    const seen = w.discovered.subarray(y * WORLD_W + 2, (y + 1) * WORLD_W - 2);
    if (rng.int(2) === 0) {
      const first = interior[0];
      interior.copyWithin(0, 1);
      interior[interior.length - 1] = first;
      const s0 = seen[0];
      seen.copyWithin(0, 1);
      seen[seen.length - 1] = s0;
    } else {
      const last = interior[interior.length - 1];
      interior.copyWithin(1, 0, interior.length - 1);
      interior[0] = last;
      const sl = seen[seen.length - 1];
      seen.copyWithin(1, 0, seen.length - 1);
      seen[0] = sl;
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
