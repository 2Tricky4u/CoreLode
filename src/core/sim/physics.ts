import { TILE_PX } from '../data/constants';
/**
 * Pod movement — the original per-frame integrator, verbatim:
 *   airborne: v *= 0.98;  yVel = min(yVel + 9.81/30, 20)
 *   grounded: xVel *= 0.94
 *   thrust:   yVel -= enginePower/mass/1.5   (burns enginePower/50000 fuel)
 *   landing:  yVel > 7 → damage floor(yVel/2); bounce yVel *= −0.2
 */
import { PHYSICS, fallDamage, horizAccel, thrustAccel } from '../data/physics';
import { GUARDIAN_DAMAGE_FACTOR } from '../data/story';
import type { DamageCause, EventSink } from '../events';
import type { IntentFrame } from '../intents';
import { clamp } from '../lib/math';
import { solidAt } from '../world/world';
import { chainOnDamage } from './chain';
import { type GameState, type PodState, enginePower, fallDamageMult, podMass } from './state';

/** Pod AABB half-extents (px). Slightly smaller than a tile, like the original clip. */
export const POD_HW = 19;
export const POD_HH = 21;

export function applyDamage(
  s: GameState,
  p: PodState,
  amount: number,
  cause: DamageCause,
  out: EventSink,
): void {
  if (amount <= 0 || s.outcome !== 'active') return;
  let dmg = amount;
  if (p.guardian) dmg *= GUARDIAN_DAMAGE_FACTOR;
  dmg = Math.floor(dmg);
  if (dmg <= 0) return;
  p.hp -= dmg;
  s.stats.damageTaken += dmg;
  p.lastDamage = { cause, atTick: s.tick }; // lets the app explain a death
  chainOnDamage(s, p, out); // a hit voids the victim's collect chain (expedition)
  out.push({ t: 'damage', amount: dmg, cause, player: s.pods.indexOf(p) });
}

const collides = (s: GameState, cx: number, cy: number): boolean => {
  const x0 = Math.floor((cx - POD_HW) / TILE_PX);
  const x1 = Math.floor((cx + POD_HW - 1) / TILE_PX);
  const y0 = Math.floor((cy - POD_HH) / TILE_PX);
  const y1 = Math.floor((cy + POD_HH - 1) / TILE_PX);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) if (solidAt(s.world, tx, ty)) return true;
  return false;
};

export const groundedAt = (s: GameState, cx: number, cy: number): boolean =>
  collides(s, cx, cy + 1) && !collides(s, cx, cy);

export const podOverlapsSolid = (s: GameState, p: PodState): boolean => collides(s, p.x, p.y);

/**
 * Push the pod out of any solid tile it is overlapping, along the shortest axis.
 * Without this the pod can end up *inside* unmined rock — an earthquake shifts a
 * row into it, a teleport lands in fill, or a resolution step leaves it embedded —
 * and the sweep loops below (which only step from a known-free position) can never
 * free it, so it stays clipped through the terrain.
 */
export function resolveOverlap(s: GameState, p: PodState): void {
  if (!collides(s, p.x, p.y)) return;
  const MAX_PUSH = TILE_PX + POD_HH; // enough to clear any single tile
  for (let d = 1; d <= MAX_PUSH; d++) {
    if (!collides(s, p.x, p.y - d)) {
      p.y -= d;
      if (p.yVel > 0) p.yVel = 0;
      return;
    }
    if (!collides(s, p.x - d, p.y)) {
      p.x -= d;
      p.xVel = 0;
      return;
    }
    if (!collides(s, p.x + d, p.y)) {
      p.x += d;
      p.xVel = 0;
      return;
    }
    if (!collides(s, p.x, p.y + d)) {
      p.y += d;
      p.yVel = 0;
      return;
    }
  }
}

export function stepPhysics(s: GameState, p: PodState, input: IntentFrame, out: EventSink): void {
  if (p.mode === 'dig') return; // drilling.ts owns movement during a dig

  // Never start a step embedded in rock (quake burial, teleport into fill).
  resolveOverlap(s, p);

  const mass = podMass(p);
  const power = enginePower(p);
  const thrusting = input.up && p.fuel > 0;

  // --- accelerations ---
  if (thrusting) {
    p.yVel -= thrustAccel(power, mass);
    p.fuel = Math.max(0, p.fuel - power / PHYSICS.fuelFlyDivisor);
    if (p.mode === 'ground') p.mode = 'air';
  }
  const drive = horizAccel(power, mass);
  if (input.left && !input.right) {
    p.xVel -= drive;
    p.facing = -1;
  } else if (input.right && !input.left) {
    p.xVel += drive;
    p.facing = 1;
  }
  p.xVel = clamp(p.xVel, -PHYSICS.maxHorizVel, PHYSICS.maxHorizVel);

  // --- friction / gravity (exact original order: damp, then gravity with cap) ---
  if (p.mode === 'air') {
    p.xVel *= PHYSICS.airResistance;
    p.yVel *= PHYSICS.airResistance;
    p.yVel = Math.min(p.yVel + PHYSICS.gravity / PHYSICS.gravityDivisor, PHYSICS.maxFallVel);
  } else {
    p.xVel *= PHYSICS.groundFriction;
    if (Math.abs(p.xVel) < 0.01) p.xVel = 0;
  }

  // --- integrate X ---
  // Sweep from the (guaranteed free) current position to the last free pixel, so
  // the pod stops flush against unmined rock instead of ending up inside it.
  const MAX_SWEEP = Math.ceil(PHYSICS.maxFallVel) + 2;
  let nx = p.x + p.xVel;
  if (collides(s, nx, p.y)) {
    // step back to contact
    const step = Math.sign(p.xVel);
    nx = p.x;
    for (let i = 0; i < MAX_SWEEP && !collides(s, nx + step, p.y); i++) nx += step;
    p.xVel = 0;
  }
  p.x = nx;

  // --- integrate Y ---
  let ny = p.y + p.yVel;
  if (collides(s, p.x, ny)) {
    const step = Math.sign(p.yVel) || 1;
    ny = p.y;
    for (let i = 0; i < MAX_SWEEP && !collides(s, p.x, ny + step); i++) ny += step;
    if (p.yVel > 0) {
      // landing (shock-absorber module scales the calibrated formula; ×1 in story)
      const dmg = Math.floor(fallDamage(p.yVel) * fallDamageMult(p));
      if (dmg > 0) {
        applyDamage(s, p, dmg, 'fall', out);
        out.push({ t: 'landed', impactVel: p.yVel, damage: dmg, player: s.pods.indexOf(p) });
      } else if (p.yVel > 2) {
        out.push({ t: 'landed', impactVel: p.yVel, damage: 0, player: s.pods.indexOf(p) });
      }
      p.yVel *= PHYSICS.bounce;
      if (Math.abs(p.yVel) < 1) {
        p.yVel = 0;
        p.mode = 'ground';
      }
    } else if (p.yVel < 0) {
      p.yVel *= PHYSICS.bounce; // ceiling bump
    }
  } else if (p.mode === 'ground' && !groundedAt(s, p.x, ny)) {
    p.mode = 'air'; // walked off an edge
  }
  p.y = ny;

  if (p.mode === 'air' && groundedAt(s, p.x, p.y) && p.yVel >= 0 && p.yVel < 1) {
    p.mode = 'ground';
    p.yVel = 0;
  }
}
