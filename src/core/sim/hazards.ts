/**
 * Hazard damage — exact original formulas:
 *   lava: damage(29 × radiatorMult)      (per lava tile broken/contacted)
 *   gas:  damage(int(−(depth+3000)/15) × radiatorMult)
 * Blueprint twists (Goldium): Magma Tap pays cash on lava; Siphon Tank converts
 * gas to fuel — both still take the damage (authentic to Goldium's design).
 */
import { BLUEPRINT_EFFECTS } from '../data/blueprints';
import { EXPEDITION } from '../data/expedition';
import type { EventSink } from '../events';
import { applyDamage } from './physics';
import { type GameState, heatGainMult, podDepthFt, radiatorMult, tankCapacity } from './state';

export const LAVA_HIT_DAMAGE = 29;

export function applyLavaHit(s: GameState, out: EventSink): void {
  const p = s.pod;
  applyDamage(s, LAVA_HIT_DAMAGE * radiatorMult(p), 'lava', out);
  if (s.mode.kind === 'expedition')
    p.heat = Math.min(EXPEDITION.heat.max, p.heat + EXPEDITION.heat.perLavaHit * heatGainMult(p));
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
  if (p.relics.includes('gasPhase')) {
    // Gas Phase relic: the pocket vents harmlessly around a phased hull.
    out.push({ t: 'sfx', key: 'gasHiss' });
    return;
  }
  applyDamage(s, gasDamageAtDepth(podDepthFt(p)) * radiatorMult(p), 'gas', out);
  out.push({ t: 'gasIgnite', x, y });
  out.push({ t: 'sfx', key: 'gasHiss' });
  if (p.blueprints.includes('siphonTank')) {
    p.fuel = Math.min(tankCapacity(p), p.fuel + 10);
  }
}
