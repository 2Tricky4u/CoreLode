/**
 * Goldium-mode "Relic Schematics" — six buried super-tier upgrades. Effects match
 * the Goldium Edition's Ancient Blueprints; stats are CAL (Goldium SWF was not
 * available for decompilation — values chosen to sit above tier 7).
 * Each generated world buries ONE schematic (never the drill — that one is the
 * Challenge Mode completion reward).
 */
import { CAL } from './physics';
import type { UpgradeCategory } from './upgrades';

export type BlueprintId =
  | 'fractalDrill'
  | 'phoenixHull'
  | 'slipstreamEngine'
  | 'siphonTank'
  | 'magmaTap'
  | 'pocketSingularity';

export interface BlueprintDef {
  id: BlueprintId;
  key: string; // strings.ts lookup
  category: UpgradeCategory;
  stat: number;
  special:
    | 'drillsStone'
    | 'hullRegen'
    | 'freeSurfaceRecall'
    | 'gasToFuel'
    | 'lavaToCash'
    | 'infiniteCargo';
  /** Buried in the world (true) or awarded by completing all challenges (false). */
  buried: boolean;
}

export const BLUEPRINTS: readonly BlueprintDef[] = [
  {
    id: 'fractalDrill',
    key: 'bpFractalDrill',
    category: 'drill',
    stat: CAL(15, 'px/frame'),
    special: 'drillsStone',
    buried: false,
  },
  {
    id: 'phoenixHull',
    key: 'bpPhoenixHull',
    category: 'hull',
    stat: CAL(220, 'HP'),
    special: 'hullRegen',
    buried: true,
  },
  {
    id: 'slipstreamEngine',
    key: 'bpSlipstream',
    category: 'engine',
    stat: CAL(230, 'power'),
    special: 'freeSurfaceRecall',
    buried: true,
  },
  {
    id: 'siphonTank',
    key: 'bpSiphonTank',
    category: 'fuelTank',
    stat: CAL(200, 'L'),
    special: 'gasToFuel',
    buried: true,
  },
  {
    id: 'magmaTap',
    key: 'bpMagmaTap',
    category: 'radiator',
    stat: CAL(0.1, 'damage mult'),
    special: 'lavaToCash',
    buried: true,
  },
  {
    id: 'pocketSingularity',
    key: 'bpSingularity',
    category: 'bay',
    stat: 9_999,
    special: 'infiniteCargo',
    buried: true,
  },
];

export const BLUEPRINT_EFFECTS = {
  hullRegenPerSecond: CAL(1, 'HP/s'),
  lavaCashPerHit: CAL(500, '$ per lava contact'),
  /** Buried schematics appear between these depths. */
  minDepthFt: -4_000,
  maxDepthFt: -7_250,
} as const;
