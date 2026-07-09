export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

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
