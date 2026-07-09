/**
 * Hazard damage — exact original formulas:
 *   lava: damage(29 × radiatorMult)      (per lava tile broken/contacted)
 *   gas:  damage(int(−(depth+3000)/15) × radiatorMult)
 * Blueprint twists (Goldium): Magma Tap pays cash on lava; Siphon Tank converts
 * gas to fuel — both still take the damage (authentic to Goldium's design).
 */
import { BLUEPRINT_EFFECTS } from '../data/blueprints';
import type { EventSink } from '../events';
import { applyDamage } from './physics';
import { type GameState, podDepthFt, radiatorMult, tankCapacity } from './state';

export const LAVA_HIT_DAMAGE = 29;

export function applyLavaHit(s: GameState, out: EventSink): void {
  const p = s.pod;
  applyDamage(s, LAVA_HIT_DAMAGE * radiatorMult(p), 'lava', out);
  out.push({ t: 'sfx', key: 'lavaSizzle' });
  if (p.blueprints.includes('magmaTap')) {
    p.cash += BLUEPRINT_EFFECTS.lavaCashPerHit;
    out.push({ t: 'bonusCash', amount: BLUEPRINT_EFFECTS.lavaCashPerHit });
  }
}

export function gasDamageAtDepth(depthFt: number): number {
  return Math.max(0, Math.floor(-(depthFt + 3000) / 15));
}

export function applyGasPocket(s: GameState, x: number, y: number, out: EventSink): void {
  const p = s.pod;
  applyDamage(s, gasDamageAtDepth(podDepthFt(p)) * radiatorMult(p), 'gas', out);
  out.push({ t: 'gasIgnite', x, y });
  if (p.blueprints.includes('siphonTank')) {
    p.fuel = Math.min(tankCapacity(p), p.fuel + 10);
  }
}
