/**
 * Engine-level constants recovered from the original SWF (see docs/calibration.md).
 * The sim runs at the original's fixed 42 Hz so per-frame constants apply verbatim.
 */

/** Fixed simulation rate — the original SWF's frame rate. */
export const TICK_HZ = 42;
export const DT_MS = 1000 / TICK_HZ;

/** World geometry (raw grid, including walls/sky/hell rows). */
export const WORLD_W = 36; // columns; cols 0-1 and 34-35 act as side walls
export const WORLD_H = 600; // rows
export const TILE_PX = 50; // original tile size in px
export const PX_PER_FT = 4; // 1 ft = 4 px → 12.5 ft per tile
export const TILE_FT = TILE_PX / PX_PER_FT; // 12.5

/** Row layout. */
export const SKY_ROWS = 5; // rows 0-4 empty sky
export const SURFACE_ROW = 5; // turf row; its TOP edge is depth 0
export const BARRIER_ROW = WORLD_H - 12; // 588 — impenetrable band with the 2-tile hole
export const HELL_FLOOR_ROW = WORLD_H - 5; // bottom band of the arena
export const ENTRANCE_COLS = [WORLD_W - 4, WORLD_W - 3] as const; // hole in the barrier (right side)

/** Altimeter display rules (exact from code). */
export const ALTIMETER_ARENA_FT = -7300; // below this, altimeter reads -66666
export const ALTIMETER_ARENA_TEXT = -66666;
export const ALTIMETER_GLITCH_FT = -5813; // below this, altimeter shows ? + random 10000-99999

/** Camera feel (original values; presentation-layer hints). */
export const CAMERA_LERP_DIV = 10; // 'scrollSpeed'
export const DAY_LENGTH_TICKS = 2880; // day/night tint cycle

/** Depth helpers. depthFt is NEGATIVE underground (0 at surface). */
export const rowTopDepthFt = (row: number): number => -(row - SURFACE_ROW) * TILE_FT;
export const depthFtToRow = (depthFt: number): number =>
  SURFACE_ROW + Math.floor(-depthFt / TILE_FT);
