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
import { type GameState, podAlive } from './state';

export function stepRelics(s: GameState, out: EventSink): void {
  if (s.mode.kind !== 'expedition' || s.outcome !== 'active') return;
  // Index-ascending: pod 0 first, so the solo rng draw order is unchanged.
  for (let i = 0; i < s.pods.length; i++) {
    const p = s.pods[i];
    if (s.pendingRelicChoices[i] || !podAlive(p)) continue;
    for (const ft of RELIC_DEPTHS_FT) {
      // Pod 0 keeps the historical latch key, so solo replays and old exp:0
      // suspends keep their spent milestones; other pods get suffixed keys.
      const latch = i === 0 ? `relic${ft}` : `relic${ft}:${i}`;
      if (p.maxDepthFt > ft || s.story.fired.includes(latch)) continue;
      s.story.fired.push(latch);
      const pool = RELICS.map((r) => r.id).filter((r) => !p.relics.includes(r));
      if (pool.length === 0) break;
      const choices: string[] = [];
      while (choices.length < Math.min(RELIC_CHOICES, pool.length)) {
        const pick = pool[s.rng.int(pool.length)];
        if (!choices.includes(pick)) choices.push(pick);
      }
      s.pendingRelicChoices[i] = choices;
      out.push({ t: 'relicOffer', choices: [...choices], player: i });
      out.push({ t: 'sfx', key: 'schematic' });
      break; // one offer at a time per pod
    }
  }
}
