/**
 * Expedition collect chains (Super Motherload's combo lesson): consecutive
 * same-mineral pickups build a running chain; finishing one banks a sale-bonus
 * percentage, damage voids the running chain (the banked vault survives), and
 * a long pause banks gently. Expedition-only — story/challenge runs never
 * create chain state (the story purity guard enforces this).
 */
import { EXPEDITION } from '../data/expedition';
import type { EventSink } from '../events';
import type { GameState } from './state';

const C = EXPEDITION.chain;

/** Fold the running chain into the vault. Emits chainBroken when one existed. */
function bank(s: GameState, out: EventSink): number {
  const cur = s.chain;
  if (!cur) return 0;
  let pct = cur.bankPct;
  if (cur.count >= C.minChain) {
    pct = Math.min(C.maxBankPct, pct + Math.min(C.perChainCap, cur.count - (C.minChain - 1)));
    out.push({ t: 'chainBroken', count: cur.count, banked: true });
  } else if (cur.count >= 2) {
    out.push({ t: 'chainBroken', count: cur.count, banked: false });
  }
  return pct;
}

export function chainOnCollect(s: GameState, collectibleId: number, out: EventSink): void {
  if (s.mode.kind !== 'expedition') return;
  const cur = s.chain;
  if (cur && cur.count > 0 && cur.id === collectibleId) {
    cur.count++;
    cur.lastCollectTick = s.tick;
    if (cur.count > s.stats.bestChain) s.stats.bestChain = cur.count;
    out.push({ t: 'chain', collectibleId, count: cur.count });
    return;
  }
  const bankPct = bank(s, out);
  s.chain = { id: collectibleId, count: 1, bankPct, lastCollectTick: s.tick };
}

/** Any hit voids the running chain — no banking. The vault survives. */
export function chainOnDamage(s: GameState, out: EventSink): void {
  const cur = s.chain;
  if (s.mode.kind !== 'expedition' || !cur || cur.count === 0) return;
  if (cur.count >= 2) out.push({ t: 'chainBroken', count: cur.count, banked: false });
  cur.count = 0;
}

/** Idle timeout: a long pause banks the running chain instead of voiding it. */
export function stepChain(s: GameState, out: EventSink): void {
  const cur = s.chain;
  if (s.mode.kind !== 'expedition' || !cur || cur.count === 0) return;
  if (s.tick - cur.lastCollectTick > C.timeoutTicks) {
    const pct = bank(s, out);
    s.chain = { ...cur, count: 0, bankPct: pct };
  }
}
