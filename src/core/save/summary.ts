/**
 * Save-slot teaser info for menus ("−2,340 ft · cargo 63% · Ruby Bit within
 * reach") — pure derivation from a SaveFile, no live state or world decode.
 */
import { UPGRADES, type UpgradeCategory } from '../data/upgrades';
import type { SaveFile } from './schema';

export interface SlotSummary {
  cargoPct: number; // 0–100
  hp: number;
  maxHp: number;
  /** The cheapest next tier not yet affordable — the thing to come back for. */
  nextUpgrade: { category: UpgradeCategory; tier: number; price: number } | null;
}

const CATEGORIES = Object.keys(UPGRADES) as UpgradeCategory[];

export function slotSummary(f: SaveFile): SlotSummary {
  const pod = f.pods[0];
  const has = (id: string) => pod.blueprints.includes(id as (typeof pod.blueprints)[number]);
  const bayCap = has('pocketSingularity') ? 9_999 : (UPGRADES.bay[pod.upgrades.bay]?.stat ?? 7);
  const used = pod.bayContents.reduce((a, b) => a + b, 0);
  const maxHp = has('phoenixHull') ? 220 : (UPGRADES.hull[pod.upgrades.hull]?.stat ?? 10);

  let tease: SlotSummary['nextUpgrade'] = null;
  let cheapest: SlotSummary['nextUpgrade'] = null;
  for (const category of CATEGORIES) {
    const tier = (pod.upgrades[category] ?? 0) + 1;
    const def = UPGRADES[category][tier];
    if (!def) continue;
    const cand = { category, tier, price: def.price };
    if (!cheapest || cand.price < cheapest.price) cheapest = cand;
    if (cand.price > pod.cash && (!tease || cand.price < tease.price)) tease = cand;
  }
  return {
    cargoPct: Math.min(100, Math.round((used / Math.max(1, bayCap)) * 100)),
    hp: pod.hp,
    maxHp,
    nextUpgrade: tease ?? cheapest,
  };
}
