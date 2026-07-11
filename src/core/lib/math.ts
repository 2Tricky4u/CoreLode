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

/** Polynomial atan on [0,1] — mul/add only, so bit-identical across engines. */
const atanPoly = (x: number): number => {
  const x2 = x * x;
  return (
    x *
    (0.9999993329 +
      x2 *
        (-0.3332985605 +
          x2 *
            (0.1994653599 +
              x2 *
                (-0.1390853351 +
                  x2 *
                    (0.0964200441 +
                      x2 * (-0.0559098861 + x2 * (0.0218612288 + x2 * -0.004054058)))))))
  );
};

/**
 * Deterministic atan2 replacement (Math.atan2 is implementation-defined and
 * can differ across browsers — a lockstep hazard). Same [-π, π] convention.
 * Max error ≈ 1e-7 rad — six orders of magnitude inside the sim's coarsest
 * angular tolerance (the boss laser's 0.09 rad hit window).
 */
export function atan2d(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const swap = ay > ax;
  const num = swap ? ax : ay;
  const den = swap ? ay : ax;
  let a = atanPoly(den === 0 ? 0 : num / den);
  if (swap) a = Math.PI / 2 - a;
  if (x < 0) a = Math.PI - a;
  return y < 0 ? -a : a;
}

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
