/**
 * Expedition co-op: per-pod roguelike systems for 2–6 players. Grows with the
 * expedition-coop plan (X3..X9); the solo contract lives in
 * goldenExpedition.test.ts and must never move.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { SURFACE_ROW, TILE_PX, WORLD_W } from '../data/constants';
import { EXPEDITION } from '../data/expedition';
import type { SimEvent } from '../events';
import { EMPTY_INTENTS } from '../intents';
import { Tile } from '../world/tiles';
import { chainOnCollect, chainOnDamage } from './chain';
import { type GameState, createRun } from './state';
import { tick } from './tick';

const DEEP_ROW = SURFACE_ROW + 440; // ~-5,510 ft — inside the heat-gain band

function expeditionDuo(seed = 1234): GameState {
  return createRun({
    seed,
    mode: {
      kind: 'expedition',
      goldium: true,
      players: 2,
      expedition: { loadoutId: 'standard', modules: [] },
    },
  });
}

/** Park a pod in a carved pocket at the given row (deterministic placement). */
function placePod(s: GameState, player: number, row: number, col: number): void {
  s.world.tiles[(row - 1) * WORLD_W + col] = Tile.Air;
  s.world.tiles[row * WORLD_W + col] = Tile.Air;
  const p = s.pods[player];
  p.x = (col + 0.5) * TILE_PX;
  p.y = (row + 0.5) * TILE_PX;
  p.prevX = p.x;
  p.prevY = p.y;
}

const stepN = (s: GameState, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) tick(s, [EMPTY_INTENTS, EMPTY_INTENTS], out);
  return out;
};

describe('expedition co-op: per-pod heat', () => {
  it('a deep pod cooks while its surface teammate cools', () => {
    const s = expeditionDuo();
    placePod(s, 1, DEEP_ROW, 24);
    s.pods[0].heat = 50; // at the surface — must vent
    s.pods[1].heat = 50; // deep — must climb
    s.pods[0].fuel = 500;
    s.pods[1].fuel = 500;
    stepN(s, 210); // 5 s
    expect(s.pods[0].heat).toBeLessThan(50);
    expect(s.pods[1].heat).toBeGreaterThan(50);
  });

  it('overheat damage and warnings hit only the hot pod, with attribution', () => {
    const s = expeditionDuo();
    placePod(s, 1, DEEP_ROW, 24);
    s.pods[1].heat = EXPEDITION.heat.warn2 - 0.5; // one tick from the red-line warning
    s.pods[1].hp = 200;
    s.pods[0].fuel = 500;
    s.pods[1].fuel = 500;
    const ev = stepN(s, 900);
    const warns = ev.filter((e) => e.t === 'heatWarning');
    expect(warns.length).toBeGreaterThan(0);
    expect(warns.every((w) => w.t === 'heatWarning' && w.player === 1)).toBe(true);
    const heatDmg = ev.filter((e) => e.t === 'damage' && e.cause === 'heat');
    expect(heatDmg.length).toBeGreaterThan(0);
    expect(heatDmg.every((d) => d.t === 'damage' && d.player === 1)).toBe(true);
    expect(s.pods[0].hp).toBe(10); // stock hull untouched
    expect(s.pods[0].heatWarn).toBe(0);
    expect(s.pods[1].heatWarn).toBe(2);
  });
});

describe('expedition co-op: per-pod chains', () => {
  it('each pod builds its own chain; damage voids only the victim', () => {
    const s = expeditionDuo();
    const out: SimEvent[] = [];
    for (let i = 0; i < 4; i++) chainOnCollect(s, s.pods[0], 2, out);
    for (let i = 0; i < 6; i++) chainOnCollect(s, s.pods[1], 5, out);
    expect(s.pods[0].chain?.count).toBe(4);
    expect(s.pods[1].chain?.count).toBe(6);
    expect(s.stats.bestChain).toBe(6); // team best
    const chains = out.filter((e) => e.t === 'chain');
    expect(chains.some((e) => e.t === 'chain' && e.player === 0 && e.count === 4)).toBe(true);
    expect(chains.some((e) => e.t === 'chain' && e.player === 1 && e.count === 6)).toBe(true);

    const hit: SimEvent[] = [];
    chainOnDamage(s, s.pods[1], hit);
    expect(s.pods[1].chain?.count).toBe(0); // victim voided
    expect(s.pods[0].chain?.count).toBe(4); // teammate untouched
    expect(hit.some((e) => e.t === 'chainBroken' && e.player === 1 && !e.banked)).toBe(true);
  });

  it('each pod banks its own vault into the shared wallet at its own sale', () => {
    const s = expeditionDuo();
    s.pods[0].chain = { id: 0, count: 0, bankPct: 50, lastCollectTick: 0 };
    s.pods[1].chain = { id: 0, count: 0, bankPct: 10, lastCollectTick: 0 };
    s.pods[0].bayContents[0] = 10; // $300 of Ironium each
    s.pods[1].bayContents[0] = 10;
    const cash = s.pods[0].cash; // pod 0 IS the shared wallet
    applyCommand(s, { c: 'sellAllCargo' }, 1, []);
    expect(s.pods[0].cash).toBe(cash + 300 + 30); // pod 1's sale + ITS 10% vault
    expect(s.pods[1].chain?.bankPct).toBe(0);
    expect(s.pods[0].chain?.bankPct).toBe(50); // pod 0's vault untouched
    applyCommand(s, { c: 'sellAllCargo' }, 0, []);
    expect(s.pods[0].cash).toBe(cash + 330 + 300 + 150); // pod 0's sale + ITS 50% vault
    expect(s.pods[0].chain?.bankPct).toBe(0);
  });
});

describe('expedition co-op: per-pod relic offers', () => {
  it('each pod earns offers at its own depth; slots are independent', () => {
    const s = expeditionDuo(31);
    const out = stepN(s, 3);
    void out;
    s.pods[1].maxDepthFt = -1_001; // only pod 1 has crossed the milestone
    const ev = stepN(s, 1);
    const offer = ev.find((e) => e.t === 'relicOffer');
    expect(offer?.t === 'relicOffer' && offer.player).toBe(1);
    expect(s.pendingRelicChoices[0]).toBeNull();
    expect(s.pendingRelicChoices[1]).toHaveLength(3);
    // Pod 0 keeps the HISTORICAL latch key; pod 1 gets the suffixed one.
    expect(s.story.fired).toContain('relic-1000:1');
    expect(s.story.fired).not.toContain('relic-1000');

    // Pod 1's pending offer must not block pod 0's own milestone.
    s.pods[0].maxDepthFt = -1_001;
    const ev2 = stepN(s, 1);
    const offer2 = ev2.find((e) => e.t === 'relicOffer');
    expect(offer2?.t === 'relicOffer' && offer2.player).toBe(0);
    expect(s.story.fired).toContain('relic-1000');
    expect(s.pendingRelicChoices[0]).toHaveLength(3);
    expect(s.pendingRelicChoices[1]).toHaveLength(3);
  });

  it("chooseRelic consumes only the acting player's slot", () => {
    const s = expeditionDuo(31);
    stepN(s, 3);
    s.pods[0].maxDepthFt = -1_001;
    s.pods[1].maxDepthFt = -1_001;
    stepN(s, 1);
    const mine = s.pendingRelicChoices[0];
    const theirs = s.pendingRelicChoices[1];
    expect(mine).not.toBeNull();
    expect(theirs).not.toBeNull();
    if (!mine || !theirs) return;
    // Player 1 cannot take from player 0's offer unless it's also in their own.
    const onlyMine = mine.find((r) => !theirs.includes(r));
    if (onlyMine) {
      applyCommand(s, { c: 'chooseRelic', id: onlyMine }, 1, []);
      expect(s.pods[1].relics).toEqual([]);
    }
    applyCommand(s, { c: 'chooseRelic', id: theirs[0] }, 1, []);
    expect(s.pods[1].relics).toEqual([theirs[0]]);
    expect(s.pendingRelicChoices[1]).toBeNull();
    expect(s.pendingRelicChoices[0]).toEqual(mine); // untouched
  });
});
