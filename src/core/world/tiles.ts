/**
 * Tile ids. 0–31 match the original's scheme exactly; the original's negative
 * ids (surface/barrier/walls) are remapped to 32+ so the world fits a Uint16Array.
 */

export enum Tile {
  Air = 0,
  // 1-5: dirt variants (visuals only; identical behavior)
  Dirt1 = 1,
  Dirt5 = 5,
  // 6-15: minerals (tile - 6 = COLLECTIBLES index 0-9)
  MineralFirst = 6,
  MineralLast = 15,
  // 16-19: artifacts (tile - 6 = COLLECTIBLES index 10-13)
  ArtifactFirst = 16,
  ArtifactLast = 19,
  // 25-27: boulders (undrillable stone)
  BoulderFirst = 25,
  BoulderLast = 27,
  // 28-30: lava
  LavaFirst = 28,
  LavaLast = 30,
  Gas = 31,
  // Remapped structural tiles (negative ids in the original)
  TurfA = 32, // -1
  TurfB = 33, // -2
  BarrierA = 34, // -6
  BarrierB = 35, // -7
  HellFloor = 36, // -8
  Bedrock = 37, // -999 (side walls, hell walls)
  Slate = 38, // Goldium relic-schematic pickup (remake addition for Goldium mode)
}

export const isDirt = (t: number): boolean => t >= 1 && t <= 5;
export const isMineral = (t: number): boolean => t >= Tile.MineralFirst && t <= Tile.MineralLast;
export const isArtifact = (t: number): boolean => t >= Tile.ArtifactFirst && t <= Tile.ArtifactLast;
export const isCollectible = (t: number): boolean =>
  isMineral(t) || isArtifact(t) || t === Tile.Slate;
export const isBoulder = (t: number): boolean => t >= Tile.BoulderFirst && t <= Tile.BoulderLast;
export const isLava = (t: number): boolean => t >= Tile.LavaFirst && t <= Tile.LavaLast;
export const isGas = (t: number): boolean => t === Tile.Gas;

/** Anything the pod cannot pass through. */
export const isSolid = (t: number): boolean => t !== Tile.Air;

/** Diggable by a standard drill (boulders/barrier/bedrock are not; surface turf IS). */
export const isDrillable = (t: number): boolean =>
  isDirt(t) || isCollectible(t) || isLava(t) || isGas(t) || t === Tile.TurfA || t === Tile.TurfB;

/** Diggable by the Fractal Drill (adds boulders). */
export const isDrillableFractal = (t: number): boolean => isDrillable(t) || isBoulder(t);

/** Destructible by explosives (boulders yes; barrier/bedrock/turf no). */
export const isBlastable = (t: number): boolean => isDrillable(t) || isBoulder(t);

/** Collectible index (0-23) for a mineral/artifact tile, else -1. */
export const collectibleIndex = (t: number): number => (isMineral(t) || isArtifact(t) ? t - 6 : -1);
