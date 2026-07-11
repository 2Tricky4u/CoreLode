/**
 * Exact mid-session state snapshot for co-op resync. Unlike SaveFile (which
 * persists only what a surface save needs), this keeps EVERY sim field
 * verbatim — velocities, drilling progress, timers, boss and critter state —
 * so the adopted state hashes identically to the host's. JSON round-trips
 * numbers exactly; only the typed arrays, the Rng instance and the pods[0]
 * alias need special handling.
 */
import { Rng } from '../lib/rng';
import { rleDecode, rleDecodeBytes, rleEncode } from '../save/schema';
import type { GameState } from '../sim/state';

export function encodeSnapshot(s: GameState): string {
  return JSON.stringify({
    ...s,
    pod: undefined, // alias of pods[0] — restored on decode
    rng: s.rng.state,
    world: {
      ...s.world,
      tiles: rleEncode(s.world.tiles),
      discovered: rleEncode(s.world.discovered),
    },
  });
}

interface WireSnapshot extends Omit<GameState, 'rng' | 'world'> {
  rng: number;
  world: Omit<GameState['world'], 'tiles' | 'discovered'> & {
    tiles: number[];
    discovered: number[];
  };
}

export function decodeSnapshot(text: string): GameState {
  const raw = JSON.parse(text) as WireSnapshot;
  const s = raw as unknown as GameState;
  s.rng = new Rng(raw.rng);
  s.world.tiles = rleDecode(raw.world.tiles);
  s.world.discovered = rleDecodeBytes(raw.world.discovered);
  s.pod = s.pods[0];
  return s;
}
