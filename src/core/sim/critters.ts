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
import { type GameState, type PodState, podAlive, podDepthFt, radiatorMult } from './state';

export const CRITTER = {
  maxAlive: 3,
  spawnChance: 60, // 1-in-N per tile dug below the gate
  minDepthFt: -3_000,
  hopTicks: 21, // one tile hop every half second
  contactTiles: 0.75,
  damage: 5, // × radiator multiplier
} as const;

/** Called per drilled tile (expedition-gated — the story rng stream is never touched). */
export function maybeSpawnCritter(
  s: GameState,
  p: PodState,
  tx: number,
  ty: number,
  out: EventSink,
): void {
  if (s.mode.kind !== 'expedition') return;
  if (s.critters.length >= CRITTER.maxAlive) return;
  if (podDepthFt(p) > CRITTER.minDepthFt) return; // the DIGGING pod's depth
  if (s.rng.int(CRITTER.spawnChance) !== 0) return;
  const c = { x: (tx + 0.5) * TILE_PX, y: (ty + 0.5) * TILE_PX, moveCooldown: CRITTER.hopTicks };
  s.critters.push(c);
  out.push({ t: 'critterSpawned', x: c.x, y: c.y, player: s.pods.indexOf(p) });
  out.push({ t: 'sfx', key: 'critter' });
}

/** Nearest living pod (lower index wins ties) — mirrors the boss targeting rule. */
function nearestPod(s: GameState, x: number, y: number): PodState | null {
  let best: PodState | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const q of s.pods) {
    if (!podAlive(q)) continue;
    const d = dist(q.x - x, q.y - y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

export function stepCritters(s: GameState, out: EventSink): void {
  if (s.mode.kind !== 'expedition' || s.critters.length === 0) return;
  const survivors: typeof s.critters = [];
  for (const c of s.critters) {
    const p = nearestPod(s, c.x, c.y);
    if (!p) break; // no living pods — the run is over anyway
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
    // Contact pops on the first touching pod, index-ascending.
    let popped = false;
    for (let i = 0; i < s.pods.length; i++) {
      const q = s.pods[i];
      if (!podAlive(q)) continue;
      if (dist(q.x - c.x, q.y - c.y) <= CRITTER.contactTiles * TILE_PX) {
        applyDamage(s, q, CRITTER.damage * radiatorMult(q), 'critter', out);
        out.push({ t: 'critterKilled', x: c.x, y: c.y, player: i });
        popped = true;
        break;
      }
    }
    if (popped) continue;
    survivors.push(c);
  }
  s.critters = survivors;
}
