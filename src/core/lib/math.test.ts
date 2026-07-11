import { describe, expect, it } from 'vitest';
import { atan2d, dist, fnv1a } from './math';

describe('deterministic math', () => {
  it('dist matches sqrt form', () => {
    expect(dist(3, 4)).toBe(5);
    expect(dist(0, 0)).toBe(0);
    expect(dist(-3, -4)).toBe(5);
  });

  it('atan2d is exact on the axes', () => {
    expect(atan2d(0, 1)).toBe(0);
    expect(atan2d(1, 0)).toBe(Math.PI / 2);
    expect(atan2d(0, -1)).toBe(Math.PI);
    expect(atan2d(-1, 0)).toBe(-Math.PI / 2);
    expect(atan2d(0, 0)).toBe(0);
  });

  it('atan2d tracks Math.atan2 within 5e-7 rad over the full circle', () => {
    let maxErr = 0;
    for (let i = 0; i < 4_000; i++) {
      const theta = (i / 4_000) * 2 * Math.PI - Math.PI;
      const x = Math.cos(theta) * (0.5 + (i % 7));
      const y = Math.sin(theta) * (0.5 + (i % 7));
      let err = Math.abs(atan2d(y, x) - Math.atan2(y, x));
      if (err > Math.PI) err = 2 * Math.PI - err; // ±π seam
      if (err > maxErr) maxErr = err;
    }
    expect(maxErr).toBeLessThan(5e-7);
  });

  it('fnv1a differs on different inputs and is stable', () => {
    expect(fnv1a([1, 2, 3])).toBe(fnv1a([1, 2, 3]));
    expect(fnv1a([1, 2, 3])).not.toBe(fnv1a([1, 2, 4]));
  });
});
