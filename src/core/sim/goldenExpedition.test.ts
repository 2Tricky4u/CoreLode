/**
 * GOLDEN SOLO EXPEDITION REPLAY — the expedition solo contract, frozen as
 * hash literals (the expedition sibling of golden.test.ts).
 *
 * A 3,000-tick scripted solo expedition run must reproduce these exact hashes
 * forever. The setup places the pod deep in a carved pocket so the script
 * exercises every expedition system: heat gain → warn1 → warn2 → overheat
 * hull damage, collect chains (build/break/timeout) and a vault payout via a
 * scripted sale, relic milestone offers + scripted chooseRelic commands,
 * contract stepping, and critter spawns below the magmite gate.
 *
 * If this test fails, SOLO expedition behavior changed. Do NOT update the
 * literals to make a refactor pass unless the change is deliberate, reviewed,
 * and documented in docs/fidelity-checklist.md.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { SURFACE_ROW, TILE_PX, WORLD_W } from '../data/constants';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
import { fnv1a } from '../lib/math';
import { Tile } from '../world/tiles';
import { type GameState, createRun } from './state';
import { tick } from './tick';

const GOLDEN_SEED = 246_813_579;
const GOLDEN_TICKS = 3_000;
// Frozen 2026-07-12 (pre expedition-coop refactor). See header before touching.
const GOLDEN_STATE_HASH = 482_687_220;
const GOLDEN_WORLD_HASH = 3_740_816_736;

/** ~-5,510 ft: below the heat gate (−1,500) and the critter gate (−3,000),
 *  above the −6,500 relic milestone and the boss arena. */
const START_ROW = SURFACE_ROW + 440;
const START_COL = 18;

function playGolden(): GameState {
  const s = createRun({
    seed: GOLDEN_SEED,
    mode: {
      kind: 'expedition',
      goldium: true,
      expedition: { loadoutId: 'standard', modules: ['thermalFins', 'auxTank'] },
    },
  });
  // Deterministic setup: carve a 2-tall pocket deep in the mine and drop the
  // pod in, hot and over-provisioned so the scripted run can't end early.
  s.world.tiles[(START_ROW - 1) * WORLD_W + START_COL] = Tile.Air;
  s.world.tiles[START_ROW * WORLD_W + START_COL] = Tile.Air;
  // Three same-mineral tiles straight below: guarantees a collect chain builds
  // during the opening dig, before overheat damage starts voiding chains.
  for (let r = 1; r <= 3; r++)
    s.world.tiles[(START_ROW + r) * WORLD_W + START_COL] = Tile.MineralFirst + 2;
  s.pod.x = (START_COL + 0.5) * TILE_PX;
  s.pod.y = (START_ROW + 0.5) * TILE_PX;
  s.pod.fuel = 500;
  s.pod.hp = 500; // survives overheat cooking + critter bites for the full script
  s.pod.heat = 55; // warn1 (70) → warn2 (90) → overheat (100) all inside 3,000 ticks
  s.pod.upgrades.drill = 5; // band-5 rock must actually cut, or nothing collects

  // Each move is held for 30 ticks: deep-band digs take many ticks and the
  // job is abandoned when the key lifts, so a fast cycle would never cut rock.
  const script: Array<Partial<IntentFrame>> = [
    { down: true },
    { down: true },
    { left: true },
    { left: true, down: true },
    { down: true },
    { right: true },
    { right: true, down: true },
    { down: true },
    {},
    { up: true },
  ];
  for (let i = 0; i < GOLDEN_TICKS; i++) {
    tick(s, [{ ...EMPTY_INTENTS, ...script[Math.floor(i / 30) % script.length] }], []);
    // Scripted relic picks: always the first pending choice, at fixed ticks.
    if ((i === 300 || i === 600) && s.pendingRelicChoices) {
      applyCommand(s, { c: 'chooseRelic', id: s.pendingRelicChoices[0] }, 0, []);
    }
    // Scripted sale mid-run: banks the chain vault into the wallet.
    if (i === 2_000) applyCommand(s, { c: 'sellAllCargo' }, 0, []);
  }
  return s;
}

describe('golden solo expedition replay (remake-tuning contract)', () => {
  it('reproduces the frozen state hash', () => {
    const s = playGolden();
    expect(s.outcome).toBe('active'); // the script must not kill the pod
    expect(s.pod.relics.length).toBeGreaterThan(0); // relic path exercised
    expect(s.pod.heat).toBeGreaterThan(0); // heat path exercised
    const h = fnv1a([
      s.tick,
      s.pod.x,
      s.pod.y,
      s.pod.xVel,
      s.pod.yVel,
      s.pod.fuel,
      s.pod.hp,
      s.pod.cash,
      s.pod.points,
      s.pod.heat,
      s.pod.relics.length,
      s.pod.chain?.count ?? -1,
      s.pod.chain?.bankPct ?? -1,
      s.pendingRelicChoices?.length ?? -1,
      s.contracts.filter((c) => c.done).length,
      s.critters.length,
      s.stats.tilesDug,
      s.stats.damageTaken,
      s.stats.bestChain,
      s.story.maxDepthFt,
      s.rng.state,
    ]);
    expect(h).toBe(GOLDEN_STATE_HASH);
  });

  it('reproduces the frozen world hash', () => {
    const s = playGolden();
    expect(fnv1a(s.world.tiles)).toBe(GOLDEN_WORLD_HASH);
  });
});
