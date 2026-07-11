/**
 * Expedition contracts — three seeded side-goals per run, paying cash on
 * completion and cores at settlement. Generated from a run-setup Rng stream
 * (hash32(seed, 0xc047)) so the live `s.rng` sequence is never touched.
 */
import { COLLECTIBLES } from '../data/minerals';
import type { EventSink } from '../events';
import { Rng, hash32 } from '../lib/rng';
import { objectiveMet } from './objectives';
import { type ContractState, type GameState, wallet } from './state';

export function generateContracts(seed: number): ContractState[] {
  const rng = new Rng(hash32(seed, 0xc047));
  const depthFt = -(1_000 + rng.int(5) * 500); // −1000 … −3000
  const ci = 1 + rng.int(5); // Bronzite … Rubine tier picks stay early-game reachable
  const count = 3 + rng.int(6); // 3 … 8
  const mass = 20 + rng.int(41); // 20 … 60
  return [
    { objective: { kind: 'reachDepthFt', ft: depthFt }, rewardCash: -depthFt * 2, done: false },
    {
      objective: { kind: 'collectMineral', collectibleId: ci, count },
      rewardCash: Math.floor(COLLECTIBLES[ci].value * count * 0.6),
      done: false,
    },
    { objective: { kind: 'haulMassInOneTrip', mass }, rewardCash: mass * 120, done: false },
  ];
}

export function stepContracts(s: GameState, out: EventSink): void {
  if (s.mode.kind !== 'expedition' || s.outcome !== 'active') return;
  for (let i = 0; i < s.contracts.length; i++) {
    const c = s.contracts[i];
    if (c.done || !objectiveMet(s, c.objective)) continue;
    c.done = true;
    wallet(s).cash += c.rewardCash;
    out.push({ t: 'contractDone', index: i, rewardCash: c.rewardCash });
  }
}
