/**
 * NG+ difficulty — verbatim original scaling. `level` starts at 1 and increments
 * each time the boss is defeated and the post-victory save is continued.
 *   difficulty[i] = { satanP1Hp: 1000·i, satanP2Hp: 2000·i,
 *                     satanDamage: ×i, mineralValueMod: i }
 * Mineral SALE value divides by the mod; POINTS multiply by it.
 */

export const bossFormHp = (form: 1 | 2, level: number): number =>
  (form === 1 ? 1_000 : 2_000) * Math.max(1, level);

export const bossDamageMult = (level: number): number => Math.max(1, level);

export const mineralValueMod = (level: number): number => Math.max(1, level);

/** Sale price of a collectible at the given NG+ level. */
export const saleValue = (baseValue: number, level: number): number =>
  Math.floor(baseValue / mineralValueMod(level));

/** Points for a collectible/dirt tile at the given NG+ level (base × 5 already applied by caller). */
export const pointsMod = (points: number, level: number): number => points * mineralValueMod(level);
