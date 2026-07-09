/**
 * Deterministic RNG. The original relied on Flash's unseeded random(); the remake
 * reproduces the same *distributions* from a serializable seeded stream so worlds
 * are reproducible and saves stay tiny.
 */

/** 32-bit avalanche hash — combine a seed with coordinates/salts into a new seed. */
export function hash32(a: number, b = 0, c = 0, d = 0): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  for (const v of [b, c, d]) {
    h = (h ^ Math.imul(v | 0, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  }
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 — tiny, fast, passes gjrand; state is a single uint32. */
export function mulberry32(state: number): () => number {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Serializable RNG with the Flash-style `random(n)` integer API used throughout
 * the original code (returns an int in [0, n) — random(0) returns 0).
 */
export class Rng {
  private a: number;

  constructor(state: number) {
    this.a = state >>> 0;
  }

  /** Current state — store this in saves. */
  get state(): number {
    return this.a >>> 0;
  }

  set state(v: number) {
    this.a = v >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.a = (this.a + 0x6d2b79f5) | 0;
    let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Flash `random(n)`: integer in [0, n). random(0) and random(1) are 0. */
  int(n: number): number {
    if (n <= 1) return 0;
    return Math.floor(this.next() * n);
  }

  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}
