import type { BlueprintId } from '../data/blueprints';
import type { BossAttackKind } from '../data/boss';
import { type BuildingId, SPAWN_COL } from '../data/buildings';
import { CHALLENGES, type ChallengeDef, type Objective } from '../data/challenges';
import { SURFACE_ROW, TILE_PX, WORLD_W } from '../data/constants';
import type { ExpeditionConfig } from '../data/expedition';
import type { ItemId } from '../data/items';
import { COLLECTIBLES } from '../data/minerals';
/** Game state shapes + run construction. Pure data — serializable as-is. */
import { DRILL_SPEED_TUNE, PHYSICS } from '../data/physics';
import { UPGRADES, type UpgradeCategory } from '../data/upgrades';
import type { DamageCause } from '../events';
import { Rng, hash32 } from '../lib/rng';
import { applyMaze } from '../world/mazes';
import { generateContracts } from './contracts';
import { type WorldState, createWorld } from '../world/world';

export type PodMode = 'air' | 'ground' | 'dig';
export type Region = 'sky' | 'surface' | 'underground' | 'arena';
export type Outcome = 'active' | 'destroyed' | 'victory' | 'challengeWon' | 'challengeLost';

export interface DrillJob {
  dir: 'down' | 'left' | 'right';
  targetX: number; // tile coords
  targetY: number;
  startPxX: number;
  startPxY: number;
  traveledPx: number;
  broken: boolean; // tile consequences applied (at digBreakAtPx)
}

export interface PodState {
  // Position in px (original coordinate scale); pod is a TILE_PX-sized AABB, x/y = center.
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  xVel: number;
  yVel: number;
  facing: -1 | 1;
  mode: PodMode;
  launchCount: number; // frames a dig direction has been held
  drilling: DrillJob | null;
  hp: number;
  fuel: number;
  cash: number;
  points: number;
  upgrades: Record<UpgradeCategory, number>; // tier index
  blueprints: BlueprintId[]; // unlocked super-tiers (Goldium)
  bayContents: number[]; // count per COLLECTIBLES index
  inventory: Partial<Record<ItemId, number>>;
  itemCooldown: number; // ticks until next item use allowed
  itemLock: number; // ticks items are locked (boss staff ragdoll)
  guardian: boolean; // Seraph active — damage ×0.5
  lavaLatch: number; // ticks until lava can damage again
  /** Building the pod is currently standing on (drives the "press E" prompt). */
  nearBuilding: BuildingId | null;
  /** Expedition heat, 0–100+. Always 0 in story/challenge (stepHeat is expedition-gated). */
  heat: number;
  /** Expedition relic ids. Always empty outside expedition (ids narrowed in data/relics.ts). */
  relics: string[];
  /** Expedition module ids. Always empty outside expedition (ids narrowed in data/expedition.ts). */
  modules: string[];
  /** Most recent damage taken — lets the app explain a death cause. */
  lastDamage: { cause: DamageCause; atTick: number } | null;
}

export interface BossState {
  form: 1 | 2;
  hp: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  facing: -1 | 1;
  phase: 'idle' | 'telegraph' | 'attack' | 'recover' | 'transition' | 'dead';
  phaseTicks: number;
  currentAttack: BossAttackKind | null;
  attackCooldowns: Record<string, number>;
  contactCooldown: number;
  laserAngle: number;
}

export interface Projectile {
  kind: 'fireball';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  xVel: number;
  yVel: number;
  ttl: number;
}

export interface Charge {
  item: 'dynamite' | 'plastique';
  x: number; // px
  y: number;
  fuse: number; // ticks
}

export interface StoryState {
  fired: string[]; // transmission/egg ids
  maxDepthFt: number; // most-negative depth reached
  maxAltFt: number; // highest altitude reached
  pendingTransmission: string | null; // presentation opens the modal
  nextQuakeTick: number; // 0 = not scheduled yet
}

export interface ModeConfig {
  kind: 'story' | 'challenge' | 'expedition';
  challengeId?: string;
  goldium: boolean; // Goldium features on (blueprints buried, challenges menu)
  /** Expedition run parameters (loadout, modules, optional daily key). */
  expedition?: ExpeditionConfig;
  /**
   * Assist options frozen into the run at creation (never read live from settings —
   * keeps replays deterministic and "was this run assisted?" answerable from the save).
   */
  assists?: { fuelFailsafe: boolean };
}

/** Same-mineral collect streak; bankPct pays out at the processor (expedition only). */
export interface ChainState {
  id: number; // COLLECTIBLES index being chained
  count: number;
  bankPct: number; // banked sale bonus, 0–50
  lastCollectTick: number;
}

/** An expedition side-goal (reuses the challenge Objective vocabulary). */
export interface ContractState {
  objective: Objective;
  rewardCash: number;
  done: boolean;
}

export interface RunStats {
  ticks: number;
  tilesDug: number;
  damageTaken: number;
  quakes: number;
  itemsUsed: number;
  collectedTotal: number;
  stonesDestroyed: number;
  biggestSaleMass: number;
  exitReached: boolean;
  soldCount: number[]; // per COLLECTIBLES index
  bestChain: number; // longest same-mineral chain this run
  rescues: number; // fuel-failsafe tows used
}

export interface GameState {
  seed: number;
  level: number; // NG+ level, starts at 1
  mode: ModeConfig;
  tick: number;
  rng: Rng;
  world: WorldState;
  pod: PodState;
  boss: BossState | null;
  projectiles: Projectile[];
  charges: Charge[];
  story: StoryState;
  stats: RunStats;
  /** Active collect chain (tracker runs in all modes; only expedition pays it out). */
  chain: ChainState | null;
  /** Expedition contracts; always empty in story/challenge. */
  contracts: ContractState[];
  outcome: Outcome;
  challengeEndTick: number; // 0 unless challenge mode
  /** Latched heat-warning tier (0/1/2) — transient, resets on load. */
  heatWarnLevel: number;
  /** Set once when the run ends victorious — drops granted flag. */
  victoryRewarded: boolean;
}

export const maxHull = (p: PodState): number => {
  const bp = p.blueprints.includes('phoenixHull');
  return bp ? 220 : UPGRADES.hull[p.upgrades.hull].stat;
};
export const enginePower = (p: PodState): number =>
  p.blueprints.includes('slipstreamEngine') ? 230 : UPGRADES.engine[p.upgrades.engine].stat;
export const tankCapacity = (p: PodState): number =>
  p.blueprints.includes('siphonTank') ? 200 : UPGRADES.fuelTank[p.upgrades.fuelTank].stat;
export const radiatorMult = (p: PodState): number =>
  p.blueprints.includes('magmaTap') ? 0.1 : UPGRADES.radiator[p.upgrades.radiator].stat;
export const bayCapacity = (p: PodState): number =>
  p.blueprints.includes('pocketSingularity') ? 9_999 : UPGRADES.bay[p.upgrades.bay].stat;
export const drillSpeed = (p: PodState): number =>
  p.blueprints.includes('fractalDrill')
    ? 15
    : UPGRADES.drill[p.upgrades.drill].stat * (DRILL_SPEED_TUNE[p.upgrades.drill] ?? 1);
export const hasFractalDrill = (p: PodState): boolean => p.blueprints.includes('fractalDrill');

export const podMass = (p: PodState): number => {
  let m = PHYSICS.baseMass;
  for (let i = 0; i < p.bayContents.length; i++) m += p.bayContents[i] * COLLECTIBLES[i].mass;
  return m;
};
export const bayUsed = (p: PodState): number => p.bayContents.reduce((a, b) => a + b, 0);
export const bayContentsCount = (p: PodState, collectibleId: number): number =>
  p.bayContents[collectibleId] ?? 0;

/** Depth in ft (negative underground, positive altitude above the surface). */
export const podDepthFt = (p: PodState): number =>
  -((p.y + TILE_PX / 2 - SURFACE_ROW * TILE_PX) / 4);

export const podTileX = (p: PodState): number => Math.floor(p.x / TILE_PX);
export const podTileY = (p: PodState): number => Math.floor(p.y / TILE_PX);

export const challengeDef = (s: GameState): ChallengeDef | null =>
  s.mode.kind === 'challenge'
    ? (CHALLENGES.find((c) => c.id === s.mode.challengeId) ?? null)
    : null;

export interface NewRunOptions {
  seed?: number;
  level?: number;
  mode?: ModeConfig;
  /** NG+ carry-over from the previous run. */
  carry?: {
    cash: number;
    upgrades: Record<UpgradeCategory, number>;
    blueprints: BlueprintId[];
    inventory: Partial<Record<ItemId, number>>;
    points: number;
  };
}

export function createRun(opts: NewRunOptions = {}): GameState {
  const mode: ModeConfig = { ...(opts.mode ?? { kind: 'story', goldium: true }) };
  // Expedition invariant: the fuel failsafe is part of its balance, always on.
  if (mode.kind === 'expedition') mode.assists = { fuelFailsafe: true };
  const ch = mode.kind === 'challenge' ? CHALLENGES.find((c) => c.id === mode.challengeId) : null;
  // Seed must come from the caller (app layer owns entropy); fixed fallback keeps core pure.
  const seed = ch ? ch.seed : (opts.seed ?? hash32(0x600d, 0xc0de));
  const level = Math.max(1, opts.level ?? 1);

  const world = createWorld(seed, mode.goldium && !ch);
  if (ch?.mazeKey) applyMaze(world, ch.mazeKey);

  const upgrades: Record<UpgradeCategory, number> = {
    drill: 0,
    hull: 0,
    engine: 0,
    fuelTank: 0,
    radiator: 0,
    bay: 0,
    ...(opts.carry?.upgrades ?? {}),
    ...(ch?.loadout.upgrades ?? {}),
  };

  const pod: PodState = {
    x: (SPAWN_COL + 0.5) * TILE_PX,
    y: SURFACE_ROW * TILE_PX - TILE_PX / 2, // standing on the turf row
    prevX: 0,
    prevY: 0,
    xVel: 0,
    yVel: 0,
    facing: 1,
    mode: 'ground',
    launchCount: 0,
    drilling: null,
    hp: 0, // set below from hull tier
    fuel: 6, // verbatim: the intro asks you to go refuel
    cash: ch ? ch.loadout.cash : (opts.carry?.cash ?? 20),
    points: opts.carry?.points ?? 0,
    upgrades,
    blueprints: opts.carry?.blueprints ?? [],
    bayContents: new Array(COLLECTIBLES.length).fill(0),
    inventory: { ...(opts.carry?.inventory ?? {}), ...(ch?.loadout.items ?? {}) },
    itemCooldown: 0,
    itemLock: 0,
    guardian: false,
    lavaLatch: 0,
    nearBuilding: null,
    heat: 0,
    relics: [],
    modules: [],
    lastDamage: null,
  };
  pod.hp = maxHull(pod);
  pod.fuel = Math.min(pod.fuel, tankCapacity(pod));
  // Challenges and expeditions start fueled — no scripted refuel errand there.
  if (ch || mode.kind === 'expedition') pod.fuel = tankCapacity(pod);
  pod.prevX = pod.x;
  pod.prevY = pod.y;

  return {
    seed,
    level,
    mode,
    tick: 0,
    rng: new Rng(hash32(seed, 0x51b, level)),
    world,
    pod,
    boss: null,
    projectiles: [],
    charges: [],
    story: { fired: [], maxDepthFt: 0, maxAltFt: 0, pendingTransmission: null, nextQuakeTick: 0 },
    stats: {
      ticks: 0,
      tilesDug: 0,
      damageTaken: 0,
      quakes: 0,
      itemsUsed: 0,
      collectedTotal: 0,
      stonesDestroyed: 0,
      biggestSaleMass: 0,
      exitReached: false,
      soldCount: new Array(COLLECTIBLES.length).fill(0),
      bestChain: 0,
      rescues: 0,
    },
    chain: null,
    contracts: mode.kind === 'expedition' ? generateContracts(seed) : [],
    outcome: 'active',
    challengeEndTick: ch ? ch.timeLimitTicks : 0,
    heatWarnLevel: 0,
    victoryRewarded: false,
  };
}
