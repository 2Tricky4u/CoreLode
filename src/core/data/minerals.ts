/**
 * The complete collectible table, verbatim from the original bytecode:
 * indices 0-9 minerals (world tiles 6-15), 10-13 buried artifacts (tiles 16-19),
 * 14-23 boss drops / end rewards (never buried; granted at the finale).
 * `mass` is in original units (≈ ×10 kg for display); every mineral occupies
 * exactly 1 cargo-bay unit. Display names live in content/strings.ts.
 */

export type CollectibleKind = 'mineral' | 'artifact' | 'bossDrop';

export interface CollectibleDef {
  /** Index into the table; world tile id = index + 6 for kinds that spawn. */
  id: number;
  key: string; // strings.ts lookup + atlas frame key
  kind: CollectibleKind;
  mass: number;
  value: number;
}

export const COLLECTIBLES: readonly CollectibleDef[] = [
  { id: 0, key: 'ferrite', kind: 'mineral', mass: 1, value: 30 },
  { id: 1, key: 'bronzite', kind: 'mineral', mass: 1, value: 60 },
  { id: 2, key: 'argentite', kind: 'mineral', mass: 1, value: 100 },
  { id: 3, key: 'aurite', kind: 'mineral', mass: 2, value: 250 },
  { id: 4, key: 'platinite', kind: 'mineral', mass: 3, value: 750 },
  { id: 5, key: 'einsteinium', kind: 'mineral', mass: 4, value: 2_000 },
  { id: 6, key: 'emerald', kind: 'mineral', mass: 6, value: 5_000 },
  { id: 7, key: 'ruby', kind: 'mineral', mass: 8, value: 20_000 },
  { id: 8, key: 'diamond', kind: 'mineral', mass: 10, value: 100_000 },
  { id: 9, key: 'amazonite', kind: 'mineral', mass: 12, value: 500_000 },
  { id: 10, key: 'fossil', kind: 'artifact', mass: 1, value: 1_000 },
  { id: 11, key: 'cache', kind: 'artifact', mass: 1, value: 5_000 },
  { id: 12, key: 'xenoSkeleton', kind: 'artifact', mass: 1, value: 10_000 },
  { id: 13, key: 'sacredIdol', kind: 'artifact', mass: 1, value: 50_000 },
  // Boss drops — awarded by the finale, sellable like anything else.
  { id: 14, key: 'tyrantSuit', kind: 'bossDrop', mass: 1, value: 50_000 },
  { id: 15, key: 'tyrantStaff', kind: 'bossDrop', mass: 1, value: 100_000 },
  { id: 16, key: 'tyrantMonocle', kind: 'bossDrop', mass: 1, value: 200_000 },
  { id: 17, key: 'tyrantHooves', kind: 'bossDrop', mass: 1, value: 300_000 },
  { id: 18, key: 'tyrantHorns', kind: 'bossDrop', mass: 1, value: 400_000 },
  { id: 19, key: 'tyrantEyeR', kind: 'bossDrop', mass: 1, value: 500_000 },
  { id: 20, key: 'tyrantEyeL', kind: 'bossDrop', mass: 1, value: 500_000 },
  { id: 21, key: 'tyrantBoiler', kind: 'bossDrop', mass: 1, value: 600_000 },
  { id: 22, key: 'peaceReward', kind: 'bossDrop', mass: 1, value: 1_000_000 },
  { id: 23, key: 'natasShares', kind: 'bossDrop', mass: 1, value: 25_000_000 },
] as const;

/** Drops granted when boss form 1 dies. */
export const FORM1_DROPS = [14, 15, 16] as const;
/** Drops granted when boss form 2 dies (finale adds the two victory rewards). */
export const FORM2_DROPS = [17, 18, 19, 20, 21] as const;
export const VICTORY_REWARDS = [22, 23] as const;

/**
 * Points for clearing a tile (exact original formula):
 * dirt → 25 × mod; mineral/artifact tile t → COLLECTIBLES[min(t,14)−6].value × 5 × mod.
 * The min(…,14) cap is why Amazonite and all artifacts score 500,000 × mod.
 */
export const DIRT_POINTS = 25;
export const POINTS_VALUE_MULT = 5;
export const POINTS_TILE_CAP = 14;
