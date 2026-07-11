/**
 * Magmites — expedition-only critters that answer the original's "LONELY"
 * complaint with teeth. Digging deep occasionally wakes one; it hops through
 * AIR tiles toward the pod (your own tunnels, used against you) and pops on
 * contact for a radiator-scaled bite. Explosions clear them. Transient state
 * (like projectiles): never serialized, reset on load, story runs untouched.
 */
import { TILE_PX } from '../data/constants';
import type { EventSink } from '../events';
import { dist } from '../lib/math';
import { Tile } from '../world/tiles';
import { getTile } from '../world/world';
import { applyDamage } from './physics';
import { type GameState, podDepthFt, radiatorMult } from './state';

export const CRITTER = {
  maxAlive: 3,
  spawnChance: 60, // 1-in-N per tile dug below the gate
  minDepthFt: -3_000,
  hopTicks: 21, // one tile hop every half second
  contactTiles: 0.75,
  damage: 5, // × radiator multiplier
} as const;

/** Called per drilled tile (expedition-gated — the story rng stream is never touched). */
export function maybeSpawnCritter(s: GameState, tx: number, ty: number, out: EventSink): void {
  if (s.mode.kind !== 'expedition') return;
  if (s.critters.length >= CRITTER.maxAlive) return;
  if (podDepthFt(s.pod) > CRITTER.minDepthFt) return;
  if (s.rng.int(CRITTER.spawnChance) !== 0) return;
  const c = { x: (tx + 0.5) * TILE_PX, y: (ty + 0.5) * TILE_PX, moveCooldown: CRITTER.hopTicks };
  s.critters.push(c);
  out.push({ t: 'critterSpawned', x: c.x, y: c.y });
  out.push({ t: 'sfx', key: 'critter' });
}

export function stepCritters(s: GameState, out: EventSink): void {
  if (s.mode.kind !== 'expedition' || s.critters.length === 0) return;
  const p = s.pod;
  const survivors: typeof s.critters = [];
  for (const c of s.critters) {
    if (--c.moveCooldown <= 0) {
      c.moveCooldown = CRITTER.hopTicks;
      const tx = Math.floor(c.x / TILE_PX);
      const ty = Math.floor(c.y / TILE_PX);
      const dx = Math.sign(p.x - c.x);
      const dy = Math.sign(p.y - c.y);
      // Prefer the axis with the larger gap; fall back to the other. Air only.
      const tries =
        Math.abs(p.x - c.x) >= Math.abs(p.y - c.y)
          ? [
              [dx, 0],
              [0, dy],
            ]
          : [
              [0, dy],
              [dx, 0],
            ];
      for (const [ox, oy] of tries) {
        if ((ox !== 0 || oy !== 0) && getTile(s.world, tx + ox, ty + oy) === Tile.Air) {
          c.x += ox * TILE_PX;
          c.y += oy * TILE_PX;
          break;
        }
      }
    }
    if (dist(p.x - c.x, p.y - c.y) <= CRITTER.contactTiles * TILE_PX) {
      applyDamage(s, p, CRITTER.damage * radiatorMult(p), 'critter', out);
      out.push({ t: 'critterKilled', x: c.x, y: c.y });
      continue; // pops on contact
    }
    survivors.push(c);
  }
  s.critters = survivors;
}
