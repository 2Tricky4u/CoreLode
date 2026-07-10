/** Expedition mode: run setup, cores math, rescue tuning, heat, determinism. */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { TILE_PX } from '../data/constants';
import { EXPEDITION, coresEarned } from '../data/expedition';
import type { EventSink } from '../events';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
import { fnv1a } from '../lib/math';
import { type GameState, createRun, tankCapacity } from './state';
import { tick } from './tick';

const expRun = (seed = 99): GameState =>
  createRun({
    seed,
    mode: {
      kind: 'expedition',
      goldium: true,
      expedition: { loadoutId: 'standard', modules: [] },
    },
  });

const step = (s: GameState, input: Partial<IntentFrame> = {}, n = 1): EventSink => {
  const out: EventSink = [];
  for (let i = 0; i < n; i++) tick(s, { ...EMPTY_INTENTS, ...input }, out);
  return out;
};

describe('expedition run setup', () => {
  it('starts fueled with the failsafe forced on', () => {
    const s = expRun();
    expect(s.mode.assists?.fuelFailsafe).toBe(true);
    expect(s.pod.fuel).toBe(tankCapacity(s.pod));
  });

  it('fires no story transmissions and takes no transmission bonuses', () => {
    const s = expRun();
    const out = step(s, {}, 60);
    expect(out.some((e) => e.t === 'transmission')).toBe(false);
    expect(s.pod.cash).toBe(20);
  });

  it('does not force assists onto story runs', () => {
    const s = createRun({ seed: 1, mode: { kind: 'story', goldium: true } });
    expect(s.mode.assists).toBeUndefined();
  });
});

describe('drive cores', () => {
  it('pays for depth, contracts and victory', () => {
    expect(coresEarned({ maxDepthFt: -2_600, contractsDone: 2, victory: true })).toBe(26);
    expect(coresEarned({ maxDepthFt: -499, contractsDone: 0, victory: false })).toBe(0);
    expect(coresEarned({ maxDepthFt: 120, contractsDone: 0, victory: false })).toBe(0);
  });
});

describe('expedition rescue tuning', () => {
  it('charges the expedition rate and runs the pod hot', () => {
    const s = expRun();
    step(s, {}, 3);
    s.pod.cash = 1_000;
    s.pod.fuel = 0;
    s.pod.y += TILE_PX * 4;
    const out = step(s);
    const r = out.find((e) => e.t === 'rescue');
    expect(r?.t === 'rescue' && r.cost).toBe(200); // 20%, not the story 15%
    expect(s.pod.heat).toBe(EXPEDITION.rescue.heatPenalty);
    expect(s.outcome).toBe('active');
  });
});

describe('expedition heat', () => {
  it('builds below the gate and vents at the surface', () => {
    const s = expRun();
    step(s, {}, 3);
    const surfaceY = s.pod.y;
    s.pod.y += 4_500 * 4; // −4500 ft → ≈1 heat/s with the stock radiator
    step(s, {}, 42);
    expect(s.pod.heat).toBeGreaterThan(0.5);
    const peak = s.pod.heat;
    s.pod.y = surfaceY;
    step(s, {}, 42);
    expect(s.pod.heat).toBeLessThan(peak); // −25/s at the surface
  });

  it('cooks the hull at max heat, tagged with the heat cause', () => {
    const s = expRun();
    step(s, {}, 3);
    s.pod.y += 4_500 * 4;
    s.pod.heat = 100;
    const out = step(s, {}, 43);
    expect(out.filter((e) => e.t === 'damage' && e.cause === 'heat').length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('warns at 70 and 90, latched until cooled', () => {
    const s = expRun();
    step(s, {}, 3);
    s.pod.heat = 71;
    let out = step(s);
    expect(out.some((e) => e.t === 'heatWarning' && e.level === 1)).toBe(true);
    out = step(s); // still hot — but latched, no repeat
    expect(out.some((e) => e.t === 'heatWarning')).toBe(false);
    s.pod.heat = 95;
    out = step(s);
    expect(out.some((e) => e.t === 'heatWarning' && e.level === 2)).toBe(true);
    s.pod.heat = 10;
    step(s); // resets the latch
    s.pod.heat = 75;
    out = step(s);
    expect(out.some((e) => e.t === 'heatWarning' && e.level === 1)).toBe(true);
  });

  it('digging adds heat; refueling flushes it', () => {
    const s = expRun();
    step(s, {}, 3);
    s.pod.heat = 50;
    s.pod.fuel = 1;
    applyCommand(s, { c: 'refuel', liters: 5 }, []);
    expect(s.pod.heat).toBe(0);
  });

  it('never touches a story run (heat stays frozen at 0)', () => {
    const s = createRun({ seed: 5, mode: { kind: 'story', goldium: true } });
    step(s, {}, 3);
    s.pod.y += 4_500 * 4;
    step(s, {}, 42);
    expect(s.pod.heat).toBe(0);
  });
});

describe('expedition determinism', () => {
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
      s.pod.heat,
      s.pod.cash,
      s.stats.tilesDug,
      s.rng.state,
    ]);
  };

  it('same seed + same intents → identical state hash', () => {
    expect(script(expRun(7))).toBe(script(expRun(7)));
  });

  it('different seed → different world hash', () => {
    expect(script(expRun(7))).not.toBe(script(expRun(8)));
  });
});
