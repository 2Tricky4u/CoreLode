/**
 * Surface buildings. Functions are authentic; exact x-positions are CAL
 * (original placed building tiles around columns 3-15 at rows 3-4; fuel is
 * leftmost per the intro transmission "Drive over to the fuel station (Left)").
 */

export type BuildingId = 'fuel' | 'processor' | 'outfitter' | 'itemShop' | 'saveStation';

export interface BuildingDef {
  id: BuildingId;
  key: string; // strings.ts lookup
  /** Inclusive tile-column span on the surface row. */
  colStart: number;
  colEnd: number;
}

export const BUILDINGS: readonly BuildingDef[] = [
  { id: 'fuel', key: 'bldFuel', colStart: 3, colEnd: 5 },
  { id: 'processor', key: 'bldProcessor', colStart: 8, colEnd: 10 },
  { id: 'outfitter', key: 'bldOutfitter', colStart: 13, colEnd: 15 },
  { id: 'itemShop', key: 'bldItemShop', colStart: 19, colEnd: 21 },
  { id: 'saveStation', key: 'bldSaveStation', colStart: 25, colEnd: 27 },
];

/** Pod spawn column (beside the fuel depot; teleporters also land here). */
export const SPAWN_COL = 6;
