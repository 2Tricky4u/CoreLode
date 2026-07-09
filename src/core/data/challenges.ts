/**
 * Challenge Mode (Goldium feature): 12 timed challenges + 3 authored mazes,
 * designed in the original's spirit (specifics were never documented; see plan).
 * Completing all 15 awards the Fractal Drill schematic.
 */
import type { ItemId } from './items';
import type { UpgradeCategory } from './upgrades';

export type Objective =
  | { kind: 'earnCash'; amount: number }
  | { kind: 'reachDepthFt'; ft: number }
  | { kind: 'collectMineral'; collectibleId: number; count: number }
  | { kind: 'destroyStones'; count: number }
  | { kind: 'collectNoDamage'; count: number }
  | { kind: 'haulMassInOneTrip'; mass: number }
  | { kind: 'reachExit' }
  | { kind: 'sellMineral'; collectibleId: number };

export type ChallengeConstraint = 'noTeleport' | 'noRefuel' | 'noRepair';

export interface ChallengeDef {
  id: string;
  key: string; // strings.ts name/blurb lookup
  kind: 'challenge' | 'maze';
  timeLimitTicks: number;
  seed: number; // fixed seed so records are comparable
  loadout: {
    cash: number;
    upgrades: Partial<Record<UpgradeCategory, number>>; // tier index overrides
    items: Partial<Record<ItemId, number>>;
  };
  objective: Objective;
  constraints: readonly ChallengeConstraint[];
  /** Mazes use an authored tile layer keyed by this name (world/mazes.ts). */
  mazeKey?: string;
}

const T = 42; // ticks per second
const M = 60 * T;

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: 'ch1',
    key: 'ch1',
    kind: 'challenge',
    timeLimitTicks: 3 * M,
    seed: 101,
    loadout: { cash: 20, upgrades: {}, items: {} },
    objective: { kind: 'earnCash', amount: 5_000 },
    constraints: [],
  },
  {
    id: 'ch2',
    key: 'ch2',
    kind: 'challenge',
    timeLimitTicks: 2 * M,
    seed: 102,
    loadout: { cash: 200, upgrades: {}, items: {} },
    objective: { kind: 'reachDepthFt', ft: -1_000 },
    constraints: [],
  },
  {
    id: 'ch3',
    key: 'ch3',
    kind: 'challenge',
    timeLimitTicks: 4 * M,
    seed: 103,
    loadout: { cash: 0, upgrades: {}, items: {} },
    objective: { kind: 'reachDepthFt', ft: -750 },
    constraints: ['noRefuel'],
  },
  {
    id: 'ch4',
    key: 'ch4',
    kind: 'challenge',
    timeLimitTicks: 5 * M,
    seed: 104,
    loadout: { cash: 500, upgrades: { hull: 2 }, items: {} },
    objective: { kind: 'collectNoDamage', count: 15 },
    constraints: [],
  },
  {
    id: 'ch5',
    key: 'ch5',
    kind: 'challenge',
    timeLimitTicks: 4 * M,
    seed: 105,
    loadout: { cash: 0, upgrades: { hull: 3 }, items: { dynamite: 25 } },
    objective: { kind: 'destroyStones', count: 20 },
    constraints: [],
  },
  {
    id: 'ch6',
    key: 'ch6',
    kind: 'challenge',
    timeLimitTicks: 6 * M,
    seed: 106,
    loadout: { cash: 1_000, upgrades: { drill: 2, fuelTank: 2 }, items: {} },
    objective: { kind: 'collectMineral', collectibleId: 2, count: 10 },
    constraints: [],
  },
  {
    id: 'ch7',
    key: 'ch7',
    kind: 'challenge',
    timeLimitTicks: 3 * M,
    seed: 107,
    loadout: { cash: 0, upgrades: { radiator: 4, hull: 4, drill: 3, fuelTank: 3 }, items: {} },
    objective: { kind: 'reachExit' },
    constraints: [],
    mazeKey: 'lavaShelf',
  },
  {
    id: 'ch8',
    key: 'ch8',
    kind: 'challenge',
    timeLimitTicks: 5 * M,
    seed: 108,
    loadout: {
      cash: 0,
      upgrades: { hull: 5, radiator: 3, drill: 4, fuelTank: 4 },
      items: { reserveFuel: 3 },
    },
    objective: { kind: 'reachDepthFt', ft: -5_250 },
    constraints: [],
  },
  {
    id: 'ch9',
    key: 'ch9',
    kind: 'challenge',
    timeLimitTicks: 8 * M,
    seed: 109,
    loadout: { cash: 2_000, upgrades: { bay: 3, drill: 2, fuelTank: 2 }, items: {} },
    objective: { kind: 'collectMineral', collectibleId: 3, count: 40 },
    constraints: [],
  },
  {
    id: 'ch10',
    key: 'ch10',
    kind: 'challenge',
    timeLimitTicks: 10 * M,
    seed: 110,
    loadout: { cash: 1_500, upgrades: { drill: 3, fuelTank: 4 }, items: {} },
    objective: { kind: 'reachDepthFt', ft: -2_500 },
    constraints: ['noTeleport'],
  },
  {
    id: 'ch11',
    key: 'ch11',
    kind: 'challenge',
    timeLimitTicks: 6 * M,
    seed: 111,
    loadout: { cash: 5_000, upgrades: { engine: 4, bay: 4, drill: 3, fuelTank: 3 }, items: {} },
    objective: { kind: 'haulMassInOneTrip', mass: 50 },
    constraints: [],
  },
  {
    id: 'ch12',
    key: 'ch12',
    kind: 'challenge',
    timeLimitTicks: 20 * M,
    seed: 112,
    loadout: {
      cash: 0,
      upgrades: { drill: 6, hull: 6, engine: 6, fuelTank: 6, radiator: 5, bay: 5 },
      items: { reserveFuel: 10, nanoWelders: 10, plastique: 10 },
    },
    objective: { kind: 'sellMineral', collectibleId: 9 },
    constraints: [],
  },
  {
    id: 'maze1',
    key: 'maze1',
    kind: 'maze',
    timeLimitTicks: 4 * M,
    seed: 201,
    loadout: { cash: 0, upgrades: { drill: 3, fuelTank: 3 }, items: {} },
    objective: { kind: 'reachExit' },
    constraints: [],
    mazeKey: 'wormworks',
  },
  {
    id: 'maze2',
    key: 'maze2',
    kind: 'maze',
    timeLimitTicks: 5 * M,
    seed: 202,
    loadout: { cash: 0, upgrades: { drill: 3, fuelTank: 3, radiator: 5, hull: 4 }, items: {} },
    objective: { kind: 'reachExit' },
    constraints: [],
    mazeKey: 'magmaVeins',
  },
  {
    id: 'maze3',
    key: 'maze3',
    kind: 'maze',
    timeLimitTicks: 6 * M,
    seed: 203,
    loadout: {
      cash: 0,
      upgrades: { drill: 4, fuelTank: 4, hull: 5, radiator: 4 },
      items: { dynamite: 5 },
    },
    objective: { kind: 'reachExit' },
    constraints: [],
    mazeKey: 'vault',
  },
];

export const CHALLENGE_COMPLETION_REWARD = 'fractalDrill' as const;
