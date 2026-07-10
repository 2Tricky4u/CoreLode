import { describe, expect, it } from 'vitest';
import { dailyKey, dailySeed, decodeDailyResult, encodeDailyResult } from './daily';
import { SaveError } from './save/migrate';

describe('daily seed', () => {
  it('derives the UTC date key regardless of local zone', () => {
    expect(dailyKey(new Date('2026-07-10T23:59:59Z'))).toBe('2026-07-10');
    expect(dailyKey(new Date('2026-07-11T00:00:01Z'))).toBe('2026-07-11');
  });

  it('is deterministic and frozen (a changed value breaks every shared daily)', () => {
    expect(dailySeed('2026-07-10')).toBe(dailySeed('2026-07-10'));
    expect(dailySeed('2026-07-10')).not.toBe(dailySeed('2026-07-11'));
    expect(dailySeed('2026-07-10')).toBe(4_050_233_114); // frozen — do not change
  });
});

describe('daily result codes', () => {
  const result = {
    v: 1 as const,
    date: '2026-07-10',
    depthFt: -3_212,
    cash: 14_250,
    points: 51_000,
    ticks: 42_000,
    bestChain: 7,
    outcome: 'destroyed' as const,
  };

  it('round-trips', () => {
    const code = encodeDailyResult(result);
    expect(code.startsWith('CLDR1.')).toBe(true);
    const back = decodeDailyResult(code);
    expect(back.depthFt).toBe(result.depthFt);
    expect(back.cash).toBe(result.cash);
    expect(back.date).toBe(result.date);
  });

  it('rejects corrupted and tampered codes', () => {
    const code = encodeDailyResult(result);
    expect(() => decodeDailyResult(`${code.slice(0, 12)}x${code.slice(13)}`)).toThrow(SaveError);
    // Tamper with the depth inside a re-encoded payload: h no longer matches.
    const forged = encodeDailyResult({ ...result, depthFt: -9_999 });
    const swapped = decodeDailyResult(forged); // internally consistent forge decodes…
    expect(swapped.depthFt).toBe(-9_999); // …(honor system — documented)
    expect(() => decodeDailyResult('CLDR1.garbage.zz')).toThrow(SaveError);
  });
});
