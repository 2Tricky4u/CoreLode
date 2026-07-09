/**
 * Authored maze layers for Challenge Mode. Each maze overwrites a region of the
 * generated world starting just below the surface. Legend:
 *   # boulder (undrillable) · . air · d dirt · L lava · G gas · E exit beacon
 * The exit is modeled as a Slate-style pickup the objective system watches for.
 */
import { SURFACE_ROW, WORLD_W } from '../data/constants';
import { Tile } from './tiles';
import type { WorldState } from './world';
import { setTile } from './world';

const CHAR_TILE: Record<string, number> = {
  '#': Tile.BoulderFirst,
  '.': Tile.Air,
  d: 3,
  L: Tile.LavaFirst,
  G: Tile.Gas,
  E: Tile.Slate,
};

export const MAZES: Record<string, readonly string[]> = {
  wormworks: [
    'dddddddddddddddddddddddddddddddd',
    'd..#....#......#........#......d',
    'd.###.####.###.#.######.#.####.d',
    'd.#.....#..#.#.#..#...#.#.#....d',
    'd.#.###.#.##.#.####.#.#.#.#.####',
    'd.#.#.#.#..#.#......#.#.#.#....d',
    'd.#.#.#.###..########.#.#.####.d',
    'd...#.#.....#.........#.#....#.d',
    'd####.#######.#########.####.#.d',
    'd.....#.....#.#.......#....#.#.d',
    'd.#####.###.#.#.#####.####.#.#.d',
    'd.#...#.#...#.#.#...#....#.#.#.d',
    'd.#.#.#.#.###.#.#.#.####.#.#.#.d',
    'd.#.#...#.....#...#....#...#.E.d',
    'dddddddddddddddddddddddddddddddd',
  ],
  magmaVeins: [
    'dddddddddddddddddddddddddddddddd',
    'd..............#............L.d',
    'd.##########L#.#.##########.#.d',
    'd.#........#L#.#.#........#.#.d',
    'd.#.######.#L#.#.#.######.#.#.d',
    'd.#.#....#.#L#...#.#....#.#.#.d',
    'd.#.#.LL.#.#L#####.#.LL.#.#.#.d',
    'd.#.#.LL.#.#L....#.#.LL.#.#.#.d',
    'd.#.#....#.#L##.#..#....#.#.#.d',
    'd.#.######.#L.#.##########.#.#.d',
    'd.#........#L.#............#.#.d',
    'd.##########L.##############.#.d',
    'd...........L................E.d',
    'dddddddddddddddddddddddddddddddd',
  ],
  vault: [
    'dddddddddddddddddddddddddddddddd',
    'd..#.......G.......#.........G.d',
    'd.#.#######.#######.#########.d',
    'd.#.#.....#.#.....#.#.......#.d',
    'd.#.#.###.#.#.###.#.#.#####.#.d',
    'd.#.#.#G#.#.#.#E#.#.#.#...#.#.d',
    'd.#.#.#.#.#.#.#.#.#.#.#.#.#.#.d',
    'd.#.#.#.#####.#.#####.#.#.#.#.d',
    'd.#.#.#...........G...#.#.#.#.d',
    'd.#.#.#################.#.#.#.d',
    'd.#.#...................#.#.#.d',
    'd.#.#####################.#.#.d',
    'd.#.......................#...d',
    'dddddddddddddddddddddddddddddddd',
  ],
  lavaShelf: [
    'dddddddddddddddddddddddddddddddd',
    'd..............................d',
    'd.####LLLL####LLLL####LLLL####.d',
    'd..............................d',
    'd.LLLL####LLLL####LLLL####LLLL.d',
    'd..............................d',
    'd.####LLLL####LLLL####LLLL####Ed',
    'dddddddddddddddddddddddddddddddd',
  ],
};

/** Stamp a maze into the world just below the surface, spanning the interior width. */
export function applyMaze(w: WorldState, key: string): void {
  const rows = MAZES[key];
  if (!rows) return;
  const top = SURFACE_ROW + 2;
  for (let ry = 0; ry < rows.length; ry++) {
    const line = rows[ry];
    for (let rx = 0; rx < Math.min(line.length, WORLD_W - 4); rx++) {
      const tile = CHAR_TILE[line[rx]];
      if (tile !== undefined) setTile(w, 2 + rx, top + ry, tile);
    }
  }
  // Seal below the maze so the challenge stays inside it.
  const bottom = top + rows.length;
  for (let x = 2; x < WORLD_W - 2; x++) setTile(w, x, bottom, Tile.Bedrock);
}
