/**
 * Named depth strata — presentation flavor only (nothing in the sim reads this).
 * Six bands matching the soil-tint bands used by the minimap and debris tinting
 * (GameScene BAND_TINTS / Hud MAP_BANDS): equal row slices from surface to floor.
 */
import { PX_PER_FT, SURFACE_ROW, TILE_PX, WORLD_H } from './constants';

export const STRATA_KEYS = [
  'stratum0',
  'stratum1',
  'stratum2',
  'stratum3',
  'stratum4',
  'stratum5',
] as const;

const FT_PER_TILE = TILE_PX / PX_PER_FT; // 12.5
const BAND_ROWS = (WORLD_H - SURFACE_ROW) / STRATA_KEYS.length;

/** Band index (0–5) for a depth in ft (negative underground). */
export function stratumIndexAt(depthFt: number): number {
  const rows = Math.max(0, -depthFt) / FT_PER_TILE;
  const i = Math.floor(rows / BAND_ROWS);
  return Math.max(0, Math.min(STRATA_KEYS.length - 1, i));
}
