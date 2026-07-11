/** Co-op mode: N-pod runs, shared wallet, purity, determinism. */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { BOSS } from '../data/boss';
import { SPAWN_COL } from '../data/buildings';
import { TILE_PX } from '../data/constants';
import { COOP } from '../data/coop';
import type { EventSink } from '../events';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
import { podOverlapsSolid } from './physics';
import { type GameState, createRun, wallet } from './state';
import { tick } from './tick';

const coopRun = (players = 2, seed = 4242): GameState =>
  createRun({ seed, mode: { kind: 'coop', goldium: true, players } });

const stepN = (s: GameState, inputs: Array<Partial<IntentFrame>>, n = 1): EventSink => {
  const out: EventSink = [];
  const frames = inputs.map((i) => ({ ...EMPTY_INTENTS, ...i }));
  for (let i = 0; i < n; i++) tick(s, frames, out);
  return out;
};

describe('co-op run setup', () => {
  it('spawns N pods on their own columns with one shared wallet', () => {
    const s = coopRun(3);
    expect(s.pods).toHaveLength(3);
    expect(s.pod).toBe(s.pods[0]);
    for (let i = 0; i < 3; i++) {
      expect(s.pods[i].x).toBe((SPAWN_COL + i * COOP.spawnColStride + 0.5) * TILE_PX);
      expect(s.pods[i].fuel).toBe(6); // the refuel errand applies to everyone
    }
    expect(wallet(s).cash).toBe(20);
    expect(s.pods[1].cash).toBe(0);
    expect(s.pods[2].cash).toBe(0);
  });

  it('clamps the player count to 2–6', () => {
    expect(coopRun(1).pods).toHaveLength(2);
    expect(coopRun(9).pods).toHaveLength(6);
    expect(createRun({ seed: 1, mode: { kind: 'coop', goldium: true } }).pods).toHaveLength(2);
  });

  it('runs the story beats (co-op story world)', () => {
    const s = coopRun(2);
    const out = stepN(s, [{}, {}]);
    expect(out.some((e) => e.t === 'transmission' && e.id === 'tx-start')).toBe(true);
  });

  it('never fires expedition systems (co-op purity)', () => {
    const s = coopRun(2);
    const seen = new Set<string>();
    const script: Array<Array<Partial<IntentFrame>>> = [
      [{ down: true }, {}],
      [{}, { down: true }],
      [{ left: true }, { right: true }],
      [{ up: true }, { up: true }],
    ];
    for (let i = 0; i < 600; i++)
      for (const e of stepN(s, script[i % script.length])) seen.add(e.t);
    for (const evt of [
      'chain',
      'chainBroken',
      'heatWarning',
      'relicOffer',
      'contractDone',
      'critterSpawned',
      'critterKilled',
    ])
      expect(seen.has(evt), evt).toBe(false);
    expect(s.pods.every((p) => p.heat === 0 && p.relics.length === 0)).toBe(true);
    expect(s.contracts).toEqual([]);
  });

  it('pods dig independently and pass through each other', () => {
    const s = coopRun(2);
    // Both dig straight down for a while — two shafts, two dug counters.
    const out = stepN(s, [{ down: true }, { down: true }], 400);
    const p0Digs = out.filter((e) => e.t === 'tileCleared' && e.player === 0).length;
    const p1Digs = out.filter((e) => e.t === 'tileCleared' && e.player === 1).length;
    expect(p0Digs).toBeGreaterThan(2);
    expect(p1Digs).toBeGreaterThan(2);
    // Overlap test: teleport pod 1 onto pod 0 — nothing collides (tile-only physics).
    s.pods[1].x = s.pods[0].x;
    s.pods[1].y = s.pods[0].y;
    const hpBefore = [s.pods[0].hp, s.pods[1].hp];
    stepN(s, [{}, {}], 10);
    expect(s.pods[0].hp).toBe(hpBefore[0]);
    expect(s.pods[1].hp).toBe(hpBefore[1]);
  });
});

describe('co-op commands act on the right pod, cash on the wallet', () => {
  it("selling player 1's cargo credits the shared wallet", () => {
    const s = coopRun(2);
    s.pods[1].bayContents[0] = 10; // 10 × Ferrite ($30) = $300
    applyCommand(s, { c: 'sellAllCargo' }, 1, []);
    expect(s.pods[1].bayContents[0]).toBe(0);
    expect(wallet(s).cash).toBe(320); // $20 start + $300
    expect(s.pods[1].cash).toBe(0); // never touches their own pocket
  });

  it("player 1's upgrade debits the wallet and lands on their pod", () => {
    const s = coopRun(2);
    wallet(s).cash = 1_000;
    applyCommand(s, { c: 'buyUpgrade', category: 'hull' }, 1, []); // $750 tier 1
    expect(wallet(s).cash).toBe(250);
    expect(s.pods[1].upgrades.hull).toBe(1);
    expect(s.pods[0].upgrades.hull).toBe(0);
  });

  it('an out-of-range player index is ignored', () => {
    const s = coopRun(2);
    applyCommand(s, { c: 'refuel', liters: 5 }, 5, []);
    expect(wallet(s).cash).toBe(20);
  });
});

describe('co-op death and respawn', () => {
  it('a downed pod pays the fee, loses cargo, and respawns after the timer', () => {
    const s = coopRun(2);
    stepN(s, [{}, {}], 3);
    wallet(s).cash = 1_000;
    s.pods[1].bayContents[0] = 5;
    s.pods[1].hp = 0;
    const out = stepN(s, [{}, {}]);
    const down = out.find((e) => e.t === 'podDown');
    expect(down?.t === 'podDown' && down.player).toBe(1);
    expect(down?.t === 'podDown' && down.fee).toBe(200); // 20% of the wallet
    expect(wallet(s).cash).toBe(800);
    expect(s.pods[1].bayContents[0]).toBe(0);
    expect(s.pods[1].respawnAtTick).toBeGreaterThan(s.tick);
    expect(s.outcome).toBe('active'); // partner is still up
    expect(out.some((e) => e.t === 'podExploded')).toBe(false);

    // Down pods are frozen: no movement, no digging.
    const x = s.pods[1].x;
    stepN(s, [{}, { down: true, left: true }], 10);
    expect(s.pods[1].x).toBe(x);

    // ...and come back at their own spawn column, repaired and fueled.
    const respawnOut = stepN(s, [{}, {}], COOP.respawnTicks);
    expect(respawnOut.some((e) => e.t === 'podRespawned' && e.player === 1)).toBe(true);
    expect(s.pods[1].respawnAtTick).toBe(0);
    expect(s.pods[1].hp).toBe(10); // stock hull
    expect(s.pods[1].fuel).toBe(10); // min(stock tank 10, respawn 25)
    expect(s.pods[1].x).toBe((SPAWN_COL + COOP.spawnColStride + 0.5) * TILE_PX);
  });

  it('a simultaneous full wipe ends the run', () => {
    const s = coopRun(2);
    stepN(s, [{}, {}], 3);
    s.pods[0].hp = 0;
    s.pods[1].hp = 0;
    const out = stepN(s, [{}, {}]);
    expect(out.filter((e) => e.t === 'podDown')).toHaveLength(2);
    expect(out.some((e) => e.t === 'podExploded')).toBe(true);
    expect(s.outcome).toBe('destroyed');
  });

  it('a fuel death in co-op goes down instead of ending the run', () => {
    const s = coopRun(2);
    stepN(s, [{}, {}], 3);
    s.pods[0].fuel = 0;
    s.pods[0].y += TILE_PX * 4; // stranded underground
    const out = stepN(s, [{}, {}]);
    expect(out.some((e) => e.t === 'podDown' && e.player === 0 && e.cause === 'fuel')).toBe(true);
    expect(s.outcome).toBe('active');
  });
});

describe('co-op quake safety and watermarks', () => {
  it('a quake never entombs any pod', () => {
    const s = coopRun(2);
    stepN(s, [{}, {}], 3);
    // Park both pods underground in carved pockets, then force a quake.
    for (let i = 0; i < 2; i++) {
      const p = s.pods[i];
      p.x = (5 + i * 20) * TILE_PX + TILE_PX / 2;
      p.y = 60 * TILE_PX + TILE_PX / 2;
      p.prevX = p.x;
      p.prevY = p.y;
      p.fuel = 100;
    }
    s.story.maxDepthFt = -1_001; // open the quake gate
    s.story.nextQuakeTick = s.tick + 1;
    stepN(s, [{}, {}], 3);
    expect(podOverlapsSolid(s, s.pods[0])).toBe(false);
    expect(podOverlapsSolid(s, s.pods[1])).toBe(false);
  });

  it('the deepest pod drives the shared depth watermark', () => {
    const s = coopRun(2);
    stepN(s, [{}, {}], 3);
    s.pods[1].y += 600 * 4; // player 1 dives to −600 ft
    stepN(s, [{}, {}]);
    expect(s.story.maxDepthFt).toBeLessThan(-500);
  });
});

describe('co-op boss rules', () => {
  const enterArena = (s: GameState, player: number, colOff = -6): void => {
    const p = s.pods[player];
    p.x = (BOSS.spawnCol + colOff) * TILE_PX;
    p.y = (BOSS.arenaTopRow + 2) * TILE_PX;
    p.prevX = p.x;
    p.prevY = p.y;
    p.fuel = 100;
    p.upgrades.fuelTank = 6;
  };

  it('spawns when ANY pod enters and resets only when none remain', () => {
    const s = coopRun(2);
    enterArena(s, 1); // player 1 goes down alone
    stepN(s, [{}, {}]);
    expect(s.boss?.form).toBe(1);
    enterArena(s, 0); // player 0 joins
    stepN(s, [{}, {}]);
    expect(s.boss).not.toBeNull();
    s.pods[1].y = (BOSS.arenaTopRow - 30) * TILE_PX; // player 1 leaves
    stepN(s, [{}, {}]);
    expect(s.boss).not.toBeNull(); // player 0 still inside
    s.pods[0].y = (BOSS.arenaTopRow - 30) * TILE_PX; // last one leaves
    const out = stepN(s, [{}, {}]);
    expect(out.some((e) => e.t === 'bossReset')).toBe(true);
    expect(s.boss).toBeNull();
  });

  it('grants drops to the player whose charge landed the kill', () => {
    const s = coopRun(2);
    enterArena(s, 0);
    enterArena(s, 1, -9); // both in, player 1 further away
    stepN(s, [{}, {}]);
    const b = s.boss;
    expect(b).not.toBeNull();
    if (!b) return;
    b.hp = 1;
    // Player 1's plastique at the boss' feet lands the kill.
    s.charges.push({ item: 'plastique', x: b.x, y: b.y, fuse: 1, owner: 1 });
    stepN(s, [{}, {}]);
    expect(b.lastHitBy).toBe(1);
    expect(s.pods[1].bayContents[14]).toBe(1); // form-1 first drop → the bomber
    expect(s.pods[0].bayContents[14]).toBe(0);
  });
});

describe('six players end-to-end', () => {
  it('wallet, deaths, respawns and the wipe rule all hold at the cap', () => {
    const s = coopRun(6);
    stepN(s, [{}, {}, {}, {}, {}, {}], 3);
    wallet(s).cash = 10_000;

    // Players 3 and 5 sell into the shared wallet.
    s.pods[3].bayContents[0] = 10;
    s.pods[5].bayContents[2] = 2; // Argentite $100
    applyCommand(s, { c: 'sellAllCargo' }, 3, []);
    applyCommand(s, { c: 'sellAllCargo' }, 5, []);
    expect(wallet(s).cash).toBe(10_500);

    // Five pods go down — the run survives on the last one standing.
    for (const i of [0, 1, 2, 3, 4]) s.pods[i].hp = 0;
    stepN(s, new Array(6).fill({}));
    expect(s.pods.filter((p) => p.respawnAtTick > 0)).toHaveLength(5);
    expect(s.outcome).toBe('active');

    // They all come back, staggered respawns land on their own columns.
    stepN(s, new Array(6).fill({}), COOP.respawnTicks + 2);
    expect(s.pods.every((p) => p.respawnAtTick === 0)).toBe(true);
    for (let i = 0; i < 6; i++)
      expect(s.pods[i].x).toBe((SPAWN_COL + i * COOP.spawnColStride + 0.5) * TILE_PX);
  });
});

describe('co-op determinism', () => {
  const script = (s: GameState): string => {
    const inputs: Array<Array<Partial<IntentFrame>>> = [
      [{ down: true }, { left: true }],
      [{ down: true }, { down: true }],
      [{}, { down: true }],
      [{ right: true }, { up: true }],
    ];
    for (let i = 0; i < 600; i++) stepN(s, inputs[i % inputs.length]);
    return s.pods
      .map((p) => `${p.x},${p.y},${p.fuel},${p.hp},${p.cash},${p.points}`)
      .concat([String(s.rng.state), String(s.stats.tilesDug)])
      .join('|');
  };

  it('same seed + same frames → identical state (2 players)', () => {
    expect(script(coopRun(2, 7))).toBe(script(coopRun(2, 7)));
  });

  it('same seed + same frames → identical state (6 players)', () => {
    expect(script(coopRun(6, 7))).toBe(script(coopRun(6, 7)));
  });
});
