/**
 * Expedition collect chains (Super Motherload's combo lesson): consecutive
 * same-mineral pickups build a running chain; finishing one banks a sale-bonus
 * percentage, damage voids the running chain (the banked vault survives), and
 * a long pause banks gently. Expedition-only — story/challenge runs never
 * create chain state (the story purity guard enforces this).
 */
import { EXPEDITION } from '../data/expedition';
import type { EventSink } from '../events';
import type { GameState, PodState } from './state';

const C = EXPEDITION.chain;

/** Fold a pod's running chain into its vault. Emits chainBroken when one existed. */
function bank(s: GameState, p: PodState, out: EventSink): number {
  const cur = p.chain;
  if (!cur) return 0;
  const player = s.pods.indexOf(p);
  let pct = cur.bankPct;
  if (cur.count >= C.minChain) {
    pct = Math.min(C.maxBankPct, pct + Math.min(C.perChainCap, cur.count - (C.minChain - 1)));
    out.push({ t: 'chainBroken', count: cur.count, banked: true, player });
  } else if (cur.count >= 2) {
    out.push({ t: 'chainBroken', count: cur.count, banked: false, player });
  }
  return pct;
}

export function chainOnCollect(
  s: GameState,
  p: PodState,
  collectibleId: number,
  out: EventSink,
): void {
  if (s.mode.kind !== 'expedition') return;
  const cur = p.chain;
  if (cur && cur.count > 0 && cur.id === collectibleId) {
    cur.count++;
    cur.lastCollectTick = s.tick;
    if (cur.count > s.stats.bestChain) s.stats.bestChain = cur.count; // team best
    out.push({ t: 'chain', collectibleId, count: cur.count, player: s.pods.indexOf(p) });
    return;
  }
  const bankPct = bank(s, p, out);
  p.chain = { id: collectibleId, count: 1, bankPct, lastCollectTick: s.tick };
}

/** Any hit voids the victim's running chain — no banking. The vault survives. */
export function chainOnDamage(s: GameState, p: PodState, out: EventSink): void {
  const cur = p.chain;
  if (s.mode.kind !== 'expedition' || !cur || cur.count === 0) return;
  if (cur.count >= 2)
    out.push({ t: 'chainBroken', count: cur.count, banked: false, player: s.pods.indexOf(p) });
  cur.count = 0;
}

/** Idle timeout: a long pause banks a running chain instead of voiding it. */
export function stepChain(s: GameState, out: EventSink): void {
  if (s.mode.kind !== 'expedition') return;
  for (const p of s.pods) {
    const cur = p.chain;
    if (!cur || cur.count === 0) continue;
    if (s.tick - cur.lastCollectTick > C.timeoutTicks) {
      const pct = bank(s, p, out);
      p.chain = { ...cur, count: 0, bankPct: pct };
    }
  }
}
