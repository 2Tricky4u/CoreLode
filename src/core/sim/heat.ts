/**
 * Expedition heat — the second pressure axis beside fuel. Deterministic, no
 * rng: pure arithmetic on depth/radiator. Story and challenge runs return
 * immediately (the story purity guard test enforces this forever).
 */
import { EXPEDITION } from '../data/expedition';
import type { EventSink } from '../events';
import { applyDamage } from './physics';
import { type GameState, heatGainMult, podAlive, podDepthFt, radiatorMult } from './state';

const H = EXPEDITION.heat;

export function stepHeat(s: GameState, out: EventSink): void {
  if (s.mode.kind !== 'expedition') return;
  for (let i = 0; i < s.pods.length; i++) {
    const p = s.pods[i];
    if (!podAlive(p)) continue;
    const depth = podDepthFt(p);

    if (depth <= H.gainStartFt) {
      // ((−depth) + gainStartFt) / gainScaleFt → 0 at the gate, 1/s at −4500 ft stock.
      const perSec = ((-depth + H.gainStartFt) / H.gainScaleFt) * radiatorMult(p) * heatGainMult(p);
      p.heat = Math.min(H.max, p.heat + perSec / 42);
    } else if (depth >= -1) {
      p.heat = Math.max(0, p.heat - H.coolSurfacePerSec / 42); // surface air rushes in
    } else {
      p.heat = Math.max(0, p.heat - H.coolShallowPerSec / 42);
    }

    // Overheat: the hull cooks at 2 HP/s (integer damage every half second).
    if (p.heat >= H.max && s.tick % 21 === 0) applyDamage(s, p, 1, 'heat', out);

    // Edge-triggered warnings, latched per pod until it cools back down.
    if (p.heat < H.warnResetBelow) p.heatWarn = 0;
    if (p.heat >= H.warn2 && p.heatWarn < 2) {
      p.heatWarn = 2;
      out.push({ t: 'heatWarning', level: 2, player: i });
      out.push({ t: 'sfx', key: 'heatAlarm' });
    } else if (p.heat >= H.warn1 && p.heatWarn < 1) {
      p.heatWarn = 1;
      out.push({ t: 'heatWarning', level: 1, player: i });
      out.push({ t: 'sfx', key: 'heatAlarm' });
    }
  }
}
