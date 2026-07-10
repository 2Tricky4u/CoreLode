import { describe, expect, it } from 'vitest';
import { STRATA_KEYS, stratumIndexAt } from './strata';

describe('named strata bands', () => {
  it('covers the full descent with six bands matching the minimap slices', () => {
    expect(stratumIndexAt(0)).toBe(0);
    expect(stratumIndexAt(100)).toBe(0); // altitude clamps to the surface band
    expect(stratumIndexAt(-100)).toBe(0);
    // Band width = (600−5)/6 rows ≈ 99.17 rows ≈ 1239.6 ft.
    expect(stratumIndexAt(-1230)).toBe(0);
    expect(stratumIndexAt(-1250)).toBe(1);
    expect(stratumIndexAt(-2500)).toBe(2);
    expect(stratumIndexAt(-5000)).toBe(4);
    expect(stratumIndexAt(-6600)).toBe(5);
    expect(stratumIndexAt(-99999)).toBe(STRATA_KEYS.length - 1); // clamped, never out of range
  });
});
