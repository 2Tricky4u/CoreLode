/**
 * GOLDEN SOLO REPLAY — the solo fidelity contract, frozen as hash literals.
 *
 * A 3,000-tick scripted story run (walk/dig/fly only: never enters the arena,
 * uses no items, spawns no charges) must reproduce these exact hashes forever.
 * If this test fails, solo behavior changed — which the fidelity contract
 * forbids. Do NOT update the literals to make a refactor pass unless the
 * change to solo behavior is deliberate, reviewed, and documented in
 * docs/fidelity-checklist.md.
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
import { fnv1a } from '../lib/math';
import { type GameState, createRun } from './state';
import { tick } from './tick';

const GOLDEN_SEED = 987_654_321;
const GOLDEN_TICKS = 3_000;
// Frozen 2026-07-11 (pre-coop refactor). See header before touching these.
const GOLDEN_STATE_HASH = 3_330_157_502;
const GOLDEN_WORLD_HASH = 3_432_131_525;

function playGolden(): GameState {
  const s = createRun({ seed: GOLDEN_SEED, mode: { kind: 'story', goldium: true } });
  s.pod.fuel = 500; // scripted run must not end in a fuel death (deterministic setup)
  const script: Array<Partial<IntentFrame>> = [
    {},
    { down: true },
    { down: true },
    { down: true },
    { left: true },
    { left: true, down: true },
    { up: true },
    { up: true, right: true },
    { right: true },
    { down: true },
  ];
  for (let i = 0; i < GOLDEN_TICKS; i++) {
    tick(s, [{ ...EMPTY_INTENTS, ...script[i % script.length] }], []);
  }
  return s;
}

describe('golden solo replay (fidelity contract)', () => {
  it('reproduces the frozen state hash', () => {
    const s = playGolden();
    expect(s.outcome).toBe('active'); // the script must not kill the pod
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
      s.stats.tilesDug,
      s.stats.damageTaken,
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
