/** Behavior tests for the sim: physics anchors, hazards, drilling, economy, boss, determinism. */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { BOSS } from '../data/boss';
import { TILE_PX } from '../data/constants';
import { PHYSICS, fallDamage } from '../data/physics';
import type { EventSink } from '../events';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
import { fnv1a } from '../lib/math';
import { Tile } from '../world/tiles';
import { getTile, setTile } from '../world/world';
import { gasDamageAtDepth } from './hazards';
import {
  type GameState,
  bayCapacity,
  bayUsed,
  createRun,
  podDepthFt,
  podTileX,
  podTileY,
} from './state';
import { tick } from './tick';

const run = (seed = 42): GameState => createRun({ seed, mode: { kind: 'story', goldium: true } });
const step = (s: GameState, input: Partial<IntentFrame> = {}, n = 1): EventSink => {
  const out: EventSink = [];
  for (let i = 0; i < n; i++) tick(s, { ...EMPTY_INTENTS, ...input }, out);
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

describe('economy commands', () => {
  it('sell-all pays value ÷ NG+ level and empties the hold', () => {
    const s = run();
    s.level = 2;
    s.pod.bayContents[8] = 1; // diamond 100k → 50k at lvl2
    const out: EventSink = [];
    applyCommand(s, { c: 'sellAllCargo' }, out);
    expect(s.pod.cash).toBe(20 + 50_000);
    expect(bayUsed(s.pod)).toBe(0);
  });

  it('upgrade purchase respects funds; hull buy fully repairs', () => {
    const s = run();
    const out: EventSink = [];
    applyCommand(s, { c: 'buyUpgrade', category: 'hull' }, out); // $750 > $20 → refused
    expect(s.pod.upgrades.hull).toBe(0);
    s.pod.cash = 1_000;
    s.pod.hp = 3;
    applyCommand(s, { c: 'buyUpgrade', category: 'hull' }, out);
    expect(s.pod.upgrades.hull).toBe(1);
    expect(s.pod.hp).toBe(17); // new max, free repair
    expect(s.pod.cash).toBe(250);
  });

  it('refuel is capped by tank and cash at $1/L; repair costs $15/HP', () => {
    const s = run();
    s.pod.cash = 3;
    const out: EventSink = [];
    applyCommand(s, { c: 'refuel', liters: 'full' }, out);
    expect(s.pod.fuel).toBeLessThanOrEqual(10);
    expect(s.pod.fuel).toBeGreaterThan(6);
    expect(s.pod.cash).toBeLessThanOrEqual(3);
    s.pod.cash = 150;
    s.pod.hp = 1;
    applyCommand(s, { c: 'repair', hp: 'full' }, out);
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
    s.charges.push({ item: 'plastique', x: b.x, y: b.y, fuse: 1 });
    const out = step(s);
    expect(out.some((e) => e.t === 'bossDamaged' && e.amount === 240)).toBe(true);
    // kill form 1
    b.hp = 1;
    s.charges.push({ item: 'plastique', x: b.x, y: b.y, fuse: 1 });
    const out2 = step(s);
    expect(out2.some((e) => e.t === 'bossFormDown' && e.form === 1)).toBe(true);
    expect(s.pod.bayContents[14]).toBe(1); // suit drop
    // wait out the transition
    step(s, {}, BOSS.interPhaseTicks + 2);
    expect(s.boss?.form).toBe(2);
    expect(s.boss?.hp).toBe(2_000);
    s.boss!.hp = 1;
    s.charges.push({ item: 'plastique', x: s.boss!.x, y: s.boss!.y, fuse: 1 });
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
