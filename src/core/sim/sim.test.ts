/** Behavior tests for the sim: physics anchors, hazards, drilling, economy, boss, determinism. */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { BOSS } from '../data/boss';
import { BUILDINGS } from '../data/buildings';
import { SURFACE_ROW, TILE_PX, WORLD_H, WORLD_W } from '../data/constants';
import { PHYSICS, fallDamage } from '../data/physics';
import type { EventSink } from '../events';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
import { fnv1a } from '../lib/math';
import { Tile } from '../world/tiles';
import { earthquake, getTile, setTile } from '../world/world';
import { gasDamageAtDepth } from './hazards';
import { podOverlapsSolid } from './physics';
import {
  type GameState,
  bayCapacity,
  bayUsed,
  createRun,
  drillSpeed,
  isCoopRun,
  podCount,
  podDepthFt,
  podTileX,
  podTileY,
} from './state';
import { tick } from './tick';

const run = (seed = 42): GameState => createRun({ seed, mode: { kind: 'story', goldium: true } });
const step = (s: GameState, input: Partial<IntentFrame> = {}, n = 1): EventSink => {
  const out: EventSink = [];
  for (let i = 0; i < n; i++) tick(s, [{ ...EMPTY_INTENTS, ...input }], out);
  return out;
};

describe('fall damage bands (from the exact yVel/2 rule)', () => {
  it('safe at or below 7 px/frame; 3 HP just above; ~8 HP at drag terminal', () => {
    expect(fallDamage(7)).toBe(0);
    expect(fallDamage(7.2)).toBe(3);
    expect(fallDamage(10)).toBe(5);
    // drag terminal: v* = (9.81/30)/(1−0.98) = 16.35 → 8 HP
    const terminal = PHYSICS.gravity / PHYSICS.gravityDivisor / (1 - PHYSICS.airResistance);
    expect(Math.floor(terminal / 2)).toBe(8);
  });
});

describe('gas formula', () => {
  it('matches the decompiled int(−(depth+3000)/15)', () => {
    expect(gasDamageAtDepth(-5700)).toBe(180);
    expect(gasDamageAtDepth(-4950)).toBe(130);
    expect(gasDamageAtDepth(-3000)).toBe(0);
    expect(gasDamageAtDepth(-2000)).toBe(0); // never negative
  });
});

describe('run start (authentic)', () => {
  it('starts with $20, 10 HP, 6 L fuel, on the surface', () => {
    const s = run();
    expect(s.pod.cash).toBe(20);
    expect(s.pod.hp).toBe(10);
    expect(s.pod.fuel).toBe(6);
    expect(Math.abs(podDepthFt(s.pod))).toBeLessThan(2);
  });
  it('fires the intro transmission on the first tick', () => {
    const s = run();
    const out = step(s);
    expect(out.some((e) => e.t === 'transmission' && e.id === 'tx-start')).toBe(true);
  });
});

describe('drilling', () => {
  it('can dig down through the surface turf at spawn (regression)', () => {
    const s = run();
    step(s, {}, 5); // settle on the turf
    const out = step(s, { down: true }, 40);
    expect(out.some((e) => e.t === 'digStart')).toBe(true);
    expect(s.stats.tilesDug).toBeGreaterThan(0);
  });

  it('digs down after the 5-frame hold, breaking the tile and burning fuel', () => {
    const s = run();
    step(s, {}, 5); // settle
    const tx = podTileX(s.pod);
    const ty = podTileY(s.pod) + 1;
    setTile(s.world, tx, ty, 3); // plain dirt below
    const fuelBefore = s.pod.fuel;
    const out = step(s, { down: true }, 40);
    expect(out.some((e) => e.t === 'digStart')).toBe(true);
    expect(out.some((e) => e.t === 'tileCleared' && e.x === tx && e.y === ty)).toBe(true);
    expect(getTile(s.world, tx, ty)).toBe(Tile.Air);
    expect(s.pod.fuel).toBeLessThan(fuelBefore);
    expect(s.stats.tilesDug).toBe(1);
  });

  it('collects a mineral into the bay with points ×5', () => {
    const s = run();
    step(s, {}, 5);
    const tx = podTileX(s.pod);
    const ty = podTileY(s.pod) + 1;
    setTile(s.world, tx, ty, Tile.MineralFirst); // ferrite, value 30
    const out = step(s, { down: true }, 40);
    expect(out.some((e) => e.t === 'collected' && e.collectibleId === 0)).toBe(true);
    expect(s.pod.bayContents[0]).toBe(1);
    expect(s.pod.points).toBe(150); // 30 × 5 × lvl1
  });

  it('destroys the mineral when the bay is full (authentic)', () => {
    const s = run();
    step(s, {}, 5);
    s.pod.bayContents[0] = bayCapacity(s.pod); // fill with ferrite
    const tx = podTileX(s.pod);
    const ty = podTileY(s.pod) + 1;
    setTile(s.world, tx, ty, Tile.MineralFirst + 1);
    const out = step(s, { down: true }, 40);
    expect(out.some((e) => e.t === 'cargoFullLost')).toBe(true);
    expect(s.pod.bayContents[1]).toBe(0);
  });

  it('early drill tiers are tuned slower; top tier and Fractal Bit stay verbatim', () => {
    const s = run();
    expect(drillSpeed(s.pod)).toBeCloseTo(1.2); // tier 0: 2 × 0.6 (deliberate deviation)
    s.pod.upgrades.drill = 6;
    expect(drillSpeed(s.pod)).toBe(12); // top tier converges to the verbatim value
    s.pod.blueprints.push('fractalDrill');
    expect(drillSpeed(s.pod)).toBe(15); // blueprint override untouched
  });

  it('never drills boulders with a standard bit', () => {
    const s = run();
    step(s, {}, 5);
    const tx = podTileX(s.pod);
    const ty = podTileY(s.pod) + 1;
    setTile(s.world, tx, ty, Tile.BoulderFirst);
    const out = step(s, { down: true }, 30);
    expect(out.some((e) => e.t === 'digStart')).toBe(false);
    expect(getTile(s.world, tx, ty)).toBe(Tile.BoulderFirst);
  });
});

describe('buildings need an explicit interact', () => {
  /** Stand on the fuel depot; returns every event emitted while settling. */
  const standOnFuelDepot = (s: GameState): EventSink => {
    const b = BUILDINGS[0]; // fuel depot, columns 3-5
    s.pod.x = (b.colStart + 0.5) * TILE_PX;
    s.pod.prevX = s.pod.x;
    return step(s, {}, 15); // spawn floats a few px above the turf; let it land
  };
  /** A surface column with no building on it (between fuel and the processor). */
  const EMPTY_COL = 6.5;

  it('shows a prompt when standing on a building, and does NOT auto-open it', () => {
    const s = run();
    const out = standOnFuelDepot(s);
    expect(out.some((e) => e.t === 'buildingPrompt' && e.id === 'fuel')).toBe(true);
    expect(out.some((e) => e.t === 'enterBuilding')).toBe(false);
    expect(s.pod.nearBuilding).toBe('fuel');
    // ...and it still won't open no matter how long you stand there.
    expect(step(s, {}, 60).some((e) => e.t === 'enterBuilding')).toBe(false);
  });

  it('opens the menu only on the interact press', () => {
    const s = run();
    standOnFuelDepot(s);
    const out = step(s, { interact: true });
    expect(out.some((e) => e.t === 'enterBuilding' && e.id === 'fuel')).toBe(true);
  });

  it('clears the prompt when walking off the building', () => {
    const s = run();
    standOnFuelDepot(s);
    expect(s.pod.nearBuilding).toBe('fuel');
    s.pod.x = EMPTY_COL * TILE_PX;
    const out = step(s, {}, 2);
    expect(out.some((e) => e.t === 'buildingPrompt' && e.id === null)).toBe(true);
    expect(s.pod.nearBuilding).toBeNull();
    // interacting in open air does nothing
    expect(step(s, { interact: true }).some((e) => e.t === 'enterBuilding')).toBe(false);
  });
});

describe('the pod can never rest inside unmined rock', () => {
  it('pushes out of a tile that closes on it (quake burial)', () => {
    const s = run();
    step(s, {}, 5);
    // Bury the pod: fill the tiles it occupies with solid dirt.
    const tx = podTileX(s.pod);
    const ty = podTileY(s.pod);
    for (let y = ty - 1; y <= ty + 1; y++) setTile(s.world, tx, y, 3);
    expect(podOverlapsSolid(s, s.pod)).toBe(true);
    step(s, {}, 2);
    expect(podOverlapsSolid(s, s.pod)).toBe(false);
  });

  it('never ends a tick overlapping solid while driving hard into a wall', () => {
    const s = run();
    step(s, {}, 5);
    // Solid wall of dirt to the right at the pod's row.
    const ty = podTileY(s.pod);
    for (let x = podTileX(s.pod) + 1; x < podTileX(s.pod) + 5; x++) {
      setTile(s.world, x, ty, 3);
      setTile(s.world, x, ty - 1, 3);
    }
    for (let i = 0; i < 120; i++) {
      step(s, { right: true, up: i % 3 === 0 });
      expect(podOverlapsSolid(s, s.pod), `overlap at tick ${i}`).toBe(false);
    }
  });
});

describe('economy commands', () => {
  it('sell-all pays value ÷ NG+ level and empties the hold', () => {
    const s = run();
    s.level = 2;
    s.pod.bayContents[8] = 1; // diamond 100k → 50k at lvl2
    const out: EventSink = [];
    applyCommand(s, { c: 'sellAllCargo' }, 0, out);
    expect(s.pod.cash).toBe(20 + 50_000);
    expect(bayUsed(s.pod)).toBe(0);
  });

  it('upgrade purchase respects funds; hull buy fully repairs', () => {
    const s = run();
    const out: EventSink = [];
    applyCommand(s, { c: 'buyUpgrade', category: 'hull' }, 0, out); // $750 > $20 → refused
    expect(s.pod.upgrades.hull).toBe(0);
    s.pod.cash = 1_000;
    s.pod.hp = 3;
    applyCommand(s, { c: 'buyUpgrade', category: 'hull' }, 0, out);
    expect(s.pod.upgrades.hull).toBe(1);
    expect(s.pod.hp).toBe(17); // new max, free repair
    expect(s.pod.cash).toBe(250);
  });

  it('refuel is capped by tank and cash at $1/L; repair costs $15/HP', () => {
    const s = run();
    s.pod.cash = 3;
    const out: EventSink = [];
    applyCommand(s, { c: 'refuel', liters: 'full' }, 0, out);
    expect(s.pod.fuel).toBeLessThanOrEqual(10);
    expect(s.pod.fuel).toBeGreaterThan(6);
    expect(s.pod.cash).toBeLessThanOrEqual(3);
    s.pod.cash = 150;
    s.pod.hp = 1;
    applyCommand(s, { c: 'repair', hp: 'full' }, 0, out);
    expect(s.pod.hp).toBe(10);
    expect(s.pod.cash).toBe(150 - 9 * 15);
  });
});

describe('boss', () => {
  const enterArena = (s: GameState): void => {
    s.pod.x = (BOSS.spawnCol - 6) * TILE_PX;
    s.pod.y = (BOSS.arenaTopRow + 2) * TILE_PX;
    s.pod.prevX = s.pod.x;
    s.pod.prevY = s.pod.y;
    s.pod.fuel = 100;
    s.pod.upgrades.fuelTank = 6;
  };

  it('spawns form 1 on arena entry and resets when the pod leaves', () => {
    const s = run();
    enterArena(s);
    step(s);
    expect(s.boss?.form).toBe(1);
    expect(s.boss?.hp).toBe(1_000);
    s.boss!.hp = 123;
    s.pod.y = (BOSS.arenaTopRow - 30) * TILE_PX; // leave
    const out = step(s);
    expect(out.some((e) => e.t === 'bossReset')).toBe(true);
    expect(s.boss).toBeNull();
  });

  it('takes 240 from a centered plastique and transitions to form 2 → victory with drops', () => {
    const s = run();
    enterArena(s);
    step(s);
    const b = s.boss!;
    s.pod.inventory.plastique = 99;
    s.pod.mode = 'ground';
    // place a charge right at the boss
    s.charges.push({ item: 'plastique', x: b.x, y: b.y, fuse: 1, owner: 0 });
    const out = step(s);
    expect(out.some((e) => e.t === 'bossDamaged' && e.amount === 240)).toBe(true);
    // kill form 1
    b.hp = 1;
    s.charges.push({ item: 'plastique', x: b.x, y: b.y, fuse: 1, owner: 0 });
    const out2 = step(s);
    expect(out2.some((e) => e.t === 'bossFormDown' && e.form === 1)).toBe(true);
    expect(s.pod.bayContents[14]).toBe(1); // suit drop
    // wait out the transition
    step(s, {}, BOSS.interPhaseTicks + 2);
    expect(s.boss?.form).toBe(2);
    expect(s.boss?.hp).toBe(2_000);
    s.boss!.hp = 1;
    s.charges.push({ item: 'plastique', x: s.boss!.x, y: s.boss!.y, fuse: 1, owner: 0 });
    const out3 = step(s);
    expect(out3.some((e) => e.t === 'victory')).toBe(true);
    expect(s.outcome).toBe('victory');
    expect(s.pod.bayContents[23]).toBe(1); // the $25M shares
  });
});

describe('death conditions', () => {
  it('explodes at 0 hull', () => {
    const s = run();
    s.pod.hp = 0;
    const out = step(s);
    expect(out.some((e) => e.t === 'podExploded' && e.cause === 'hull')).toBe(true);
    expect(s.outcome).toBe('destroyed');
  });
  it('is lost when out of fuel underground', () => {
    const s = run();
    step(s, {}, 3);
    s.pod.fuel = 0;
    s.pod.y += TILE_PX * 4; // pretend underground
    const out = step(s);
    expect(out.some((e) => e.t === 'podExploded' && e.cause === 'fuel')).toBe(true);
  });
});

describe('blueprint specials', () => {
  it('phoenix hull regenerates 1 HP per second up to its cap', () => {
    const s = run();
    s.pod.blueprints.push('phoenixHull');
    s.pod.hp = 50;
    step(s, {}, 42); // exactly one second of ticks
    expect(s.pod.hp).toBe(51);
  });

  it('slipstream engine grants surface recall with zero transporters, consuming none', () => {
    const s = run();
    s.pod.blueprints.push('slipstreamEngine');
    step(s, {}, 3);
    s.pod.y += TILE_PX * 8; // in a tunnel underground...
    s.pod.mode = 'ground'; // ...standing (items resolve before physics in the tick)
    const out = step(s, { useItem: 'priorityTransporter' });
    expect(out.some((e) => e.t === 'teleport' && e.item === 'priorityTransporter')).toBe(true);
    expect(s.pod.inventory.priorityTransporter ?? 0).toBe(0);
    expect(s.stats.itemsUsed).toBe(1);
    expect(podDepthFt(s.pod)).toBeGreaterThanOrEqual(-1);
  });

  it('without the schematic, an empty transporter slot does nothing', () => {
    const s = run();
    step(s, {}, 3);
    s.pod.y += TILE_PX * 8;
    s.pod.mode = 'ground';
    const out = step(s, { useItem: 'priorityTransporter' });
    expect(out.some((e) => e.t === 'teleport')).toBe(false);
  });
});

describe('fuel failsafe assist (rescue tow)', () => {
  const assistedRun = (): GameState =>
    createRun({
      seed: 42,
      mode: { kind: 'story', goldium: true, assists: { fuelFailsafe: true } },
    });

  it('tows to the surface instead of exploding: cash cut, cargo forfeited', () => {
    const s = assistedRun();
    step(s, {}, 3);
    s.pod.cash = 1_000;
    s.pod.bayContents[0] = 3;
    s.pod.fuel = 0;
    s.pod.y += TILE_PX * 4; // stranded underground
    const out = step(s);
    expect(out.some((e) => e.t === 'podExploded')).toBe(false);
    const rescue = out.find((e) => e.t === 'rescue');
    expect(rescue?.t === 'rescue' && rescue.cost).toBe(150); // 15% of $1,000
    expect(rescue?.t === 'rescue' && rescue.cargoLost).toBe(3);
    expect(s.outcome).toBe('active');
    expect(s.pod.cash).toBe(850);
    expect(s.pod.bayContents[0]).toBe(0);
    expect(s.pod.fuel).toBeGreaterThan(0);
    expect(podDepthFt(s.pod)).toBeGreaterThanOrEqual(-1); // back at the surface (settles on tick)
    expect(s.stats.rescues).toBe(1);
  });

  it('changes nothing without the assist — authentic death path intact', () => {
    const s = run();
    step(s, {}, 3);
    s.pod.fuel = 0;
    s.pod.y += TILE_PX * 4;
    const out = step(s);
    expect(out.some((e) => e.t === 'rescue')).toBe(false);
    expect(s.outcome).toBe('destroyed');
  });
});

describe('pods array alias invariant', () => {
  it('s.pod is always the same reference as s.pods[0]', () => {
    const s = run(77);
    expect(s.pod).toBe(s.pods[0]);
    step(s, { down: true }, 1_000);
    expect(s.pod).toBe(s.pods[0]);
    expect(s.pods).toHaveLength(1);
    expect(s.pod.respawnAtTick).toBe(0); // solo pods never enter the respawn state
  });
});

describe('minimap fog of war', () => {
  it('starts with sky and surface revealed, depths fogged', () => {
    const s = run();
    expect(s.world.discovered[3 * WORLD_W + 10]).toBe(1); // sky
    expect(s.world.discovered[SURFACE_ROW * WORLD_W + 10]).toBe(1); // turf
    expect(s.world.discovered[400 * WORLD_W + 10]).toBe(0); // deep cell
  });

  it('reveals a radius around the pod and never re-fogs', () => {
    const s = run();
    step(s, {}, 2);
    const tx = podTileX(s.pod);
    const ty = podTileY(s.pod);
    const d = (x: number, y: number) => s.world.discovered[y * WORLD_W + x];
    expect(d(tx, ty)).toBe(1);
    expect(d(tx, Math.min(WORLD_H - 1, ty + 4))).toBe(1); // edge of the radius
    expect(d(tx, ty + 10)).toBe(0); // beyond it
    // Move away — earlier cells stay revealed.
    s.pod.y += TILE_PX * 20;
    step(s, {}, 2);
    expect(d(tx, ty)).toBe(1);
  });

  it('rotates with earthquake rows so cells keep tracking their tiles', () => {
    const s = run();
    const y = 50;
    s.world.discovered[y * WORLD_W + 10] = 1; // lone revealed cell in the row
    earthquake(s.world, s.rng, 4); // chance 1/(5−4) → every eligible row shifts
    const row = s.world.discovered.subarray(y * WORLD_W + 2, (y + 1) * WORLD_W - 2);
    expect(row.reduce((a, b) => a + b, 0)).toBe(1); // still exactly one cell
    const at = row.indexOf(1) + 2;
    expect(at === 9 || at === 11).toBe(true); // moved one step with the row
  });
});

describe('story-mode purity guard', () => {
  // Remake-only systems (assists, chains, heat, relics, contracts, critters) must
  // never leak into a default story run. EXTEND this list with every new system:
  // the fidelity contract depends on this test staying green forever.
  const NEW_SYSTEM_EVENTS = [
    'rescue',
    'chain',
    'chainBroken',
    'heatWarning',
    'relicOffer',
    'contractDone',
    'critterSpawned',
    'critterKilled',
  ];

  it('a default story run emits no new-system events and no new-system state', () => {
    const s = run(1234);
    const inputs: Array<Partial<IntentFrame>> = [
      {},
      { down: true },
      { down: true },
      { left: true },
      { up: true },
      { right: true },
    ];
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) for (const e of step(s, inputs[i % 6])) seen.add(e.t);
    for (const evt of NEW_SYSTEM_EVENTS) expect(seen.has(evt)).toBe(false);
    expect(s.pod.heat).toBe(0);
    expect(s.pod.relics).toEqual([]);
    expect(s.pod.modules).toEqual([]);
    expect(s.contracts).toEqual([]);
    expect(s.stats.rescues).toBe(0);
  });
});

describe('determinism', () => {
  const script = (s: GameState): number => {
    const inputs: Array<Partial<IntentFrame>> = [
      {},
      { down: true },
      { down: true },
      { left: true },
      { up: true },
      { right: true },
    ];
    for (let i = 0; i < 600; i++) step(s, inputs[i % inputs.length]);
    return fnv1a([
      s.pod.x,
      s.pod.y,
      s.pod.fuel,
      s.pod.hp,
      s.pod.cash,
      s.pod.points,
      s.stats.tilesDug,
      s.rng.state,
    ]);
  };
  it('same seed + same intents → identical state hash', () => {
    expect(script(run(777))).toBe(script(run(777)));
  });
  it('different seed → different world state', () => {
    expect(script(run(777))).not.toBe(script(run(778)));
  });
});

describe('podCount / isCoopRun helpers', () => {
  it('podCount clamps per kind', () => {
    expect(podCount({ kind: 'story', goldium: true })).toBe(1);
    expect(podCount({ kind: 'challenge', challengeId: 'c1', goldium: true })).toBe(1);
    expect(podCount({ kind: 'coop', goldium: true })).toBe(2);
    expect(podCount({ kind: 'coop', goldium: true, players: 9 })).toBe(6);
    expect(podCount({ kind: 'coop', goldium: true, players: 1 })).toBe(2);
    // Expedition defaults solo; multiplayer clamps to the crew cap.
    const exp = { loadoutId: 'standard' as const, modules: [] };
    expect(podCount({ kind: 'expedition', goldium: true, expedition: exp })).toBe(1);
    expect(podCount({ kind: 'expedition', goldium: true, expedition: exp, players: 4 })).toBe(4);
    expect(podCount({ kind: 'expedition', goldium: true, expedition: exp, players: 9 })).toBe(6);
  });

  it('isCoopRun reads the pod roster, not the kind', () => {
    const solo = createRun({ seed: 1, mode: { kind: 'story', goldium: true } });
    expect(isCoopRun(solo)).toBe(false);
    const duo = createRun({ seed: 1, mode: { kind: 'coop', goldium: true, players: 2 } });
    expect(isCoopRun(duo)).toBe(true);
  });
});
