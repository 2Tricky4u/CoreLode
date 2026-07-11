/** Co-op mode: N-pod runs, shared wallet, purity, determinism. */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { SPAWN_COL } from '../data/buildings';
import { TILE_PX } from '../data/constants';
import { COOP } from '../data/coop';
import type { EventSink } from '../events';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
import { type GameState, createRun, wallet } from './state';
import { tick } from './tick';

export const coopRun = (players = 2, seed = 4242): GameState =>
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
