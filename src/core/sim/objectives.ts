/**
 * Objective evaluation, shared by Challenge Mode and expedition contracts.
 * Pure extraction of the switch that lived in stepChallenge — the challenge
 * suite guards parity.
 */
import type { Objective } from '../data/challenges';
import { type GameState, bayContentsCount } from './state';

export function objectiveMet(s: GameState, o: Objective): boolean {
  switch (o.kind) {
    case 'earnCash':
      return s.pod.cash >= o.amount;
    case 'reachDepthFt':
      return s.story.maxDepthFt <= o.ft;
    case 'collectMineral':
      return (
        bayContentsCount(s.pod, o.collectibleId) + (s.stats.soldCount[o.collectibleId] ?? 0) >=
        o.count
      );
    case 'destroyStones':
      return s.stats.stonesDestroyed >= o.count;
    case 'collectNoDamage':
      return s.stats.damageTaken === 0 && s.stats.collectedTotal >= o.count;
    case 'haulMassInOneTrip':
      return s.stats.biggestSaleMass >= o.mass;
    case 'reachExit':
      return s.stats.exitReached;
    case 'sellMineral':
      return s.stats.soldCount[o.collectibleId] > 0;
  }
}
