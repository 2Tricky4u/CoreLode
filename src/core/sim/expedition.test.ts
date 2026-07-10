/** Expedition mode: run setup, cores math, rescue tuning, heat, determinism. */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { TILE_PX } from '../data/constants';
import { EXPEDITION, coresEarned } from '../data/expedition';
import type { EventSink } from '../events';
import { EMPTY_INTENTS, type IntentFrame } from '../intents';
import { fnv1a } from '../lib/math';
import { chainOnCollect, chainOnDamage, stepChain } from './chain';
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

describe('collect chains', () => {
  const collect = (s: GameState, ci: number): EventSink => {
    const out: EventSink = [];
    chainOnCollect(s, ci, out);
    return out;
  };

  it('builds on same-mineral pickups and banks on a switch', () => {
    const s = expRun();
    collect(s, 0);
    expect(collect(s, 0).some((e) => e.t === 'chain' && e.count === 2)).toBe(true);
    collect(s, 0); // ×3
    expect(s.stats.bestChain).toBe(3);
    const out = collect(s, 3); // different mineral → bank the ×3 chain (+1%)
    expect(out.some((e) => e.t === 'chainBroken' && e.banked)).toBe(true);
    expect(s.chain?.bankPct).toBe(1); // min(20, 3−2)
    expect(s.chain?.id).toBe(3);
    expect(s.chain?.count).toBe(1);
  });

  it('a long chain banks big, capped per chain and in total', () => {
    const s = expRun();
    for (let i = 0; i < 25; i++) collect(s, 2); // ×25 chain
    collect(s, 0); // bank: min(20, 25−2) = 20
    expect(s.chain?.bankPct).toBe(20);
    for (let i = 0; i < 25; i++) collect(s, 1);
    collect(s, 0); // +20 → 40
    for (let i = 0; i < 25; i++) collect(s, 2);
    collect(s, 0); // +20 → capped at 50
    expect(s.chain?.bankPct).toBe(50);
  });

  it('damage voids the running chain but keeps the vault', () => {
    const s = expRun();
    for (let i = 0; i < 5; i++) collect(s, 1);
    collect(s, 0); // bank ×5 → +3%
    for (let i = 0; i < 4; i++) collect(s, 0); // running ×5... (count 5)
    const out: EventSink = [];
    chainOnDamage(s, out);
    expect(out.some((e) => e.t === 'chainBroken' && !e.banked)).toBe(true);
    expect(s.chain?.count).toBe(0);
    expect(s.chain?.bankPct).toBe(3); // vault survives the hit
  });

  it('an idle timeout banks instead of voiding', () => {
    const s = expRun();
    for (let i = 0; i < 4; i++) collect(s, 1); // ×4
    s.tick += EXPEDITION.chain.timeoutTicks + 1;
    const out: EventSink = [];
    stepChain(s, out);
    expect(out.some((e) => e.t === 'chainBroken' && e.banked)).toBe(true);
    expect(s.chain?.bankPct).toBe(2); // min(20, 4−2)
    expect(s.chain?.count).toBe(0);
  });

  it('pays the vault on sale, then resets it — expedition only', () => {
    const s = expRun();
    s.pod.bayContents[0] = 10; // 10 × Ironium ($30) = $300
    s.chain = { id: 0, count: 0, bankPct: 50, lastCollectTick: 0 };
    const cash = s.pod.cash;
    const out: EventSink = [];
    applyCommand(s, { c: 'sellAllCargo' }, out);
    expect(s.pod.cash).toBe(cash + 300 + 150); // sale + 50% vault
    expect(s.chain?.bankPct).toBe(0);
    expect(out.some((e) => e.t === 'transaction' && e.kind === 'chainBonus')).toBe(true);
  });

  it('story sale math is untouched even with a forced vault present', () => {
    const s = createRun({ seed: 3, mode: { kind: 'story', goldium: true } });
    s.pod.bayContents[0] = 10;
    s.chain = { id: 0, count: 0, bankPct: 50, lastCollectTick: 0 }; // hostile setup
    const cash = s.pod.cash;
    applyCommand(s, { c: 'sellAllCargo' }, []);
    expect(s.pod.cash).toBe(cash + 300); // no bonus, byte-authentic
  });

  it('never creates chain state in story mode', () => {
    const s = createRun({ seed: 3, mode: { kind: 'story', goldium: true } });
    chainOnCollect(s, 0, []);
    chainOnCollect(s, 0, []);
    expect(s.chain).toBeNull();
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
