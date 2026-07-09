import { TILE_PX } from '../data/constants';
/**
 * Scripted events: depth-triggered transmissions (exact original depths),
 * sky easter eggs, and periodic earthquakes (row-shift mechanic recovered from
 * the original; trigger cadence is CAL).
 */
import { SKY_EGGS, TRANSMISSIONS } from '../data/story';
import { QUAKE } from '../data/worldgen';
import type { EventSink } from '../events';
import { Tile } from '../world/tiles';
import { earthquake } from '../world/world';
import { solidAt } from '../world/world';
import { setTile } from '../world/world';
import { type GameState, podDepthFt, podTileY } from './state';

export function fireTransmission(s: GameState, id: string, out: EventSink): void {
  if (s.story.fired.includes(id)) return;
  const def = TRANSMISSIONS.find((t) => t.id === id);
  if (!def) return;
  s.story.fired.push(id);
  if (def.bonus > 0) {
    s.pod.cash += def.bonus;
    out.push({ t: 'bonusCash', amount: def.bonus });
  }
  s.story.pendingTransmission = id;
  out.push({ t: 'transmission', id });
  out.push({ t: 'sfx', key: 'transmission' });
}

export function stepScripted(s: GameState, out: EventSink): void {
  const depth = podDepthFt(s.pod);
  if (depth < s.story.maxDepthFt) s.story.maxDepthFt = depth;
  if (depth > s.story.maxAltFt) s.story.maxAltFt = depth;

  if (s.mode.kind === 'challenge') return; // no story in challenges

  // Intro transmission (the 'start' sentinel) — first tick of a fresh run.
  fireTransmission(s, 'tx-start', out);

  // Depth transmissions — watermark crossing fires each exactly once.
  for (const t of TRANSMISSIONS) {
    if (typeof t.trigger !== 'number') continue;
    if (s.story.maxDepthFt <= t.trigger) fireTransmission(s, t.id, out);
  }

  // Sky easter eggs.
  for (const egg of SKY_EGGS) {
    if (s.story.fired.includes(egg.id)) continue;
    if (s.story.maxAltFt >= egg.altitudeFt) {
      s.story.fired.push(egg.id);
      if (egg.bonus > 0) {
        s.pod.cash += egg.bonus;
        out.push({ t: 'bonusCash', amount: egg.bonus });
      }
      if (egg.spawnsGuardian && !s.pod.guardian) {
        s.pod.guardian = true;
        out.push({ t: 'guardianSpawned' });
        out.push({ t: 'sfx', key: 'seraph' });
      }
      s.story.pendingTransmission = egg.id;
      out.push({ t: 'transmission', id: egg.id });
    }
  }

  // Earthquakes — once the pod has ventured below the gate, shake periodically.
  if (s.story.maxDepthFt <= QUAKE.depthGateFt && s.boss === null) {
    if (s.story.nextQuakeTick === 0) {
      s.story.nextQuakeTick =
        s.tick +
        QUAKE.minIntervalTicks +
        s.rng.int(QUAKE.maxIntervalTicks - QUAKE.minIntervalTicks);
    } else if (s.tick >= s.story.nextQuakeTick) {
      const rows = earthquake(s.world, s.rng, QUAKE.intensity);
      s.story.nextQuakeTick =
        s.tick +
        QUAKE.minIntervalTicks +
        s.rng.int(QUAKE.maxIntervalTicks - QUAKE.minIntervalTicks);
      if (rows.length > 0) {
        s.stats.quakes++;
        // Safety: never entomb the pod — carve the cell it occupies.
        const tx = Math.floor(s.pod.x / TILE_PX);
        const ty = podTileY(s.pod);
        if (solidAt(s.world, tx, ty)) setTile(s.world, tx, ty, Tile.Air);
        out.push({ t: 'quake', rows });
        out.push({ t: 'sfx', key: 'quakeRumble' });
      }
    }
  }
}
