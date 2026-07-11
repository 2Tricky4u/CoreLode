/**
 * Expedition co-op: per-pod roguelike systems for 2–6 players. Grows with the
 * expedition-coop plan (X3..X9); the solo contract lives in
 * goldenExpedition.test.ts and must never move.
 */
import { describe, expect, it } from 'vitest';
import { SURFACE_ROW, TILE_PX, WORLD_W } from '../data/constants';
import { EXPEDITION } from '../data/expedition';
import type { SimEvent } from '../events';
import { EMPTY_INTENTS } from '../intents';
import { Tile } from '../world/tiles';
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
