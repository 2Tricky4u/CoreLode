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
import type { DamageCause } from '../events';
import { Rng } from '../lib/rng';
import type {
  ChainState,
  ContractState,
  GameState,
  ModeConfig,
  PodState,
  RunStats,
} from '../sim/state';

export interface SavedPod {
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
  heat: number;
  relics: string[];
  modules: string[];
  lastDamage: { cause: DamageCause; atTick: number } | null;
  respawnAtTick: number;
}

export const SAVE_VERSION = 4;

export interface SaveFile {
  v: number;
  updatedAt: number; // wall-clock ms, metadata only (host stamps it)
  seed: number;
  level: number;
  mode: ModeConfig;
  tick: number;
  rngState: number;
  worldRle: number[]; // [tile, runLength, tile, runLength, ...]
  /** Minimap fog of war, RLE like worldRle (runs of 0/1 pack tightly). */
  discoveredRle: number[];
  slate: { x: number; y: number; blueprint: BlueprintId } | null;
  /** All pods, index = player (v4+). Solo saves carry one entry. */
  pods: SavedPod[];
  story: { fired: string[]; maxDepthFt: number; maxAltFt: number; nextQuakeTick: number };
  stats: RunStats;
  chain: ChainState | null;
  contracts: ContractState[];
}

export function rleEncode(tiles: Uint16Array | Uint8Array): number[] {
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

export function rleDecodeBytes(rle: number[]): Uint8Array {
  const bytes = new Uint8Array(WORLD_W * WORLD_H);
  let i = 0;
  for (let k = 0; k < rle.length; k += 2) {
    bytes.fill(rle[k], i, i + rle[k + 1]);
    i += rle[k + 1];
  }
  return bytes;
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
    discoveredRle: rleEncode(s.world.discovered),
    slate: s.world.slate,
    pods: s.pods.map((p) => ({
      x: p.x,
      y: p.y,
      hp: p.hp,
      fuel: p.fuel,
      cash: p.cash,
      points: p.points,
      facing: p.facing,
      upgrades: { ...p.upgrades },
      blueprints: [...p.blueprints],
      bayContents: [...p.bayContents],
      inventory: { ...p.inventory },
      guardian: p.guardian,
      heat: p.heat,
      relics: [...p.relics],
      modules: [...p.modules],
      lastDamage: p.lastDamage ? { ...p.lastDamage } : null,
      respawnAtTick: p.respawnAtTick,
    })),
    story: {
      fired: [...s.story.fired],
      maxDepthFt: s.story.maxDepthFt,
      maxAltFt: s.story.maxAltFt,
      nextQuakeTick: s.story.nextQuakeTick,
    },
    stats: { ...s.stats, soldCount: [...s.stats.soldCount] },
    chain: s.chain ? { ...s.chain } : null,
    contracts: s.contracts.map((c) => ({ ...c, objective: { ...c.objective } })),
  };
}

/** Rebuild a live GameState from a (already migrated + validated) save. */
function revivePod(sp: SavedPod): PodState {
  const bay = new Array(COLLECTIBLES.length).fill(0);
  for (let i = 0; i < Math.min(bay.length, sp.bayContents.length); i++) bay[i] = sp.bayContents[i];
  return {
    x: sp.x,
    y: sp.y,
    prevX: sp.x,
    prevY: sp.y,
    xVel: 0,
    yVel: 0,
    facing: sp.facing,
    mode: 'air', // settles to ground on the first tick
    launchCount: 0,
    drilling: null,
    hp: sp.hp,
    fuel: sp.fuel,
    cash: sp.cash,
    points: sp.points,
    upgrades: sp.upgrades,
    blueprints: sp.blueprints,
    bayContents: bay,
    inventory: sp.inventory,
    itemCooldown: 0,
    itemLock: 0,
    guardian: sp.guardian,
    lavaLatch: 0,
    nearBuilding: null,
    heat: sp.heat,
    relics: sp.relics,
    modules: sp.modules,
    lastDamage: sp.lastDamage,
    respawnAtTick: sp.respawnAtTick,
  };
}

export function deserialize(f: SaveFile): GameState {
  const pods = f.pods.map(revivePod);
  return {
    seed: f.seed,
    level: f.level,
    mode: f.mode,
    tick: f.tick,
    rng: new Rng(f.rngState),
    world: {
      tiles: rleDecode(f.worldRle),
      slate: f.slate,
      discovered: rleDecodeBytes(f.discoveredRle),
    },
    pods,
    pod: pods[0],
    boss: null,
    projectiles: [],
    charges: [],
    critters: [], // transient, like projectiles

    story: {
      fired: f.story.fired,
      maxDepthFt: f.story.maxDepthFt,
      maxAltFt: f.story.maxAltFt,
      pendingTransmission: null,
      nextQuakeTick: f.story.nextQuakeTick,
    },
    stats: f.stats,
    chain: f.chain,
    contracts: f.contracts,
    outcome: 'active',
    challengeEndTick: 0,
    heatWarnLevel: 0, // transient latch — a re-warning after load is harmless
    pendingRelicChoices: null, // transient — the milestone latch lives in story.fired
    victoryRewarded: false,
  };
}
