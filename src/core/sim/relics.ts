/**
 * Relic offers: when an expedition crosses a depth milestone, draw three
 * distinct un-owned relics with the live rng (expedition-only stream — story
 * rng is never touched) and hold them pending until a chooseRelic command.
 * The milestone latch reuses the story.fired ledger, so offers survive
 * save/load; the pending choices themselves are transient (an offer lost to
 * a force-quit mid-modal simply re-rolls nothing — the milestone is spent).
 */
import { RELICS, RELIC_CHOICES, RELIC_DEPTHS_FT } from '../data/relics';
import type { EventSink } from '../events';
import type { GameState } from './state';

export function stepRelics(s: GameState, out: EventSink): void {
  if (s.mode.kind !== 'expedition' || s.pendingRelicChoices || s.outcome !== 'active') return;
  for (const ft of RELIC_DEPTHS_FT) {
    const latch = `relic${ft}`;
    if (s.story.maxDepthFt > ft || s.story.fired.includes(latch)) continue;
    s.story.fired.push(latch);
    const pool = RELICS.map((r) => r.id).filter((r) => !s.pod.relics.includes(r));
    if (pool.length === 0) return;
    const choices: string[] = [];
    while (choices.length < Math.min(RELIC_CHOICES, pool.length)) {
      const pick = pool[s.rng.int(pool.length)];
      if (!choices.includes(pick)) choices.push(pick);
    }
    s.pendingRelicChoices = choices;
    out.push({ t: 'relicOffer', choices: [...choices] });
    out.push({ t: 'sfx', key: 'schematic' });
    return; // one offer at a time
  }
}
