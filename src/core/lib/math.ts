export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Euclidean distance via sqrt(dx²+dy²) — NOT Math.hypot. sqrt/mul/add are
 * IEEE-754 correctly-rounded (bit-identical across engines); Math.hypot is
 * implementation-defined and may differ by an ulp between browsers, which
 * would desync networked lockstep. Sim coordinates are far from overflow,
 * so hypot's extra range safety buys nothing here.
 */
export const dist = (dx: number, dy: number): number => Math.sqrt(dx * dx + dy * dy);

/** FNV-1a over a numeric array — used for golden replay state hashes. */
export function fnv1a(values: ArrayLike<number>): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < values.length; i++) {
    // mix each number's integer and fractional bits
    const v = values[i];
    const iv = v | 0;
    const fv = Math.round((v - iv) * 1e6) | 0;
    h = Math.imul(h ^ (iv & 0xff), 0x01000193);
    h = Math.imul(h ^ ((iv >>> 8) & 0xff), 0x01000193);
    h = Math.imul(h ^ ((iv >>> 16) & 0xff), 0x01000193);
    h = Math.imul(h ^ ((iv >>> 24) & 0xff), 0x01000193);
    h = Math.imul(h ^ (fv & 0xff), 0x01000193);
    h = Math.imul(h ^ ((fv >>> 16) & 0xff), 0x01000193);
  }
  return h >>> 0;
}
