import type { BlueprintId } from '../data/blueprints';
import { WORLD_H, WORLD_W } from '../data/constants';
import type { ItemId } from '../data/items';
import { COLLECTIBLES } from '../data/minerals';
/**
 * Versioned save format. The whole world grid is stored (RLE-packed, then the
 * platform layer deflates it) because earthquakes shift entire rows — a diff
 * against the generated base would balloon after the first quake.
 * Pure serialization only; storage/IndexedDB lives in the platform layer.
 */
import type { UpgradeCategory } from '../data/upgrades';
import { Rng } from '../lib/rng';
import type { GameState, ModeConfig, RunStats } from '../sim/state';

export const SAVE_VERSION = 1;

export interface SaveFile {
  v: number;
  updatedAt: number; // wall-clock ms, metadata only (host stamps it)
  seed: number;
  level: number;
  mode: ModeConfig;
  tick: number;
  rngState: number;
  worldRle: number[]; // [tile, runLength, tile, runLength, ...]
  slate: { x: number; y: number; blueprint: BlueprintId } | null;
  pod: {
    x: number;
    y: number;
    hp: number;
    fuel: number;
    cash: number;
    points: number;
    facing: -1 | 1;
    upgrades: Record<UpgradeCategory, number>;
    blueprints: BlueprintId[];
    bayContents: number[];
    inventory: Partial<Record<ItemId, number>>;
    guardian: boolean;
  };
  story: { fired: string[]; maxDepthFt: number; maxAltFt: number; nextQuakeTick: number };
  stats: RunStats;
}

export function rleEncode(tiles: Uint16Array): number[] {
  const out: number[] = [];
  let cur = tiles[0];
  let run = 1;
  for (let i = 1; i < tiles.length; i++) {
    if (tiles[i] === cur && run < 0xffff) run++;
    else {
      out.push(cur, run);
      cur = tiles[i];
      run = 1;
    }
  }
  out.push(cur, run);
  return out;
}

export function rleDecode(rle: number[]): Uint16Array {
  const tiles = new Uint16Array(WORLD_W * WORLD_H);
  let i = 0;
  for (let k = 0; k < rle.length; k += 2) {
    const tile = rle[k];
    const run = rle[k + 1];
    tiles.fill(tile, i, i + run);
    i += run;
  }
  return tiles;
}

export function serialize(s: GameState, updatedAt: number): SaveFile {
  return {
    v: SAVE_VERSION,
    updatedAt,
    seed: s.seed,
    level: s.level,
    mode: s.mode,
    tick: s.tick,
    rngState: s.rng.state,
    worldRle: rleEncode(s.world.tiles),
    slate: s.world.slate,
    pod: {
      x: s.pod.x,
      y: s.pod.y,
      hp: s.pod.hp,
      fuel: s.pod.fuel,
      cash: s.pod.cash,
      points: s.pod.points,
      facing: s.pod.facing,
      upgrades: { ...s.pod.upgrades },
      blueprints: [...s.pod.blueprints],
      bayContents: [...s.pod.bayContents],
      inventory: { ...s.pod.inventory },
      guardian: s.pod.guardian,
    },
    story: {
      fired: [...s.story.fired],
      maxDepthFt: s.story.maxDepthFt,
      maxAltFt: s.story.maxAltFt,
      nextQuakeTick: s.story.nextQuakeTick,
    },
    stats: { ...s.stats, soldCount: [...s.stats.soldCount] },
  };
}

/** Rebuild a live GameState from a (already migrated + validated) save. */
export function deserialize(f: SaveFile): GameState {
  const bay = new Array(COLLECTIBLES.length).fill(0);
  for (let i = 0; i < Math.min(bay.length, f.pod.bayContents.length); i++)
    bay[i] = f.pod.bayContents[i];
  return {
    seed: f.seed,
    level: f.level,
    mode: f.mode,
    tick: f.tick,
    rng: new Rng(f.rngState),
    world: { tiles: rleDecode(f.worldRle), slate: f.slate },
    pod: {
      x: f.pod.x,
      y: f.pod.y,
      prevX: f.pod.x,
      prevY: f.pod.y,
      xVel: 0,
      yVel: 0,
      facing: f.pod.facing,
      mode: 'air', // settles to ground on the first tick
      launchCount: 0,
      drilling: null,
      hp: f.pod.hp,
      fuel: f.pod.fuel,
      cash: f.pod.cash,
      points: f.pod.points,
      upgrades: f.pod.upgrades,
      blueprints: f.pod.blueprints,
      bayContents: bay,
      inventory: f.pod.inventory,
      itemCooldown: 0,
      itemLock: 0,
      guardian: f.pod.guardian,
      lavaLatch: 0,
      nearBuilding: null,
    },
    boss: null,
    projectiles: [],
    charges: [],
    story: {
      fired: f.story.fired,
      maxDepthFt: f.story.maxDepthFt,
      maxAltFt: f.story.maxAltFt,
      pendingTransmission: null,
      nextQuakeTick: f.story.nextQuakeTick,
    },
    stats: f.stats,
    outcome: 'active',
    challengeEndTick: 0,
    victoryRewarded: false,
  };
}
