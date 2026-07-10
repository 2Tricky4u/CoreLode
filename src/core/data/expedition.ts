/**
 * Expedition mode — the roguelike layer. Single life, seeded world (the world
 * generator itself is untouched), heat pressure, contracts, and a "drive cores"
 * meta-economy. Every number here is remake tuning, never calibration data.
 */
import type { UpgradeCategory } from './upgrades';

export type LoadoutId = 'standard' | 'heavyRig' | 'prospector';
export type ModuleId =
  | 'thermalFins'
  | 'auxTank'
  | 'shockAbsorbers'
  | 'bulkhead'
  | 'sparkPlug'
  | 'surveyor';

export interface ExpeditionConfig {
  /** UTC date key (YYYY-MM-DD) when this is a daily run — fixed loadout, no modules. */
  dateKey?: string;
  loadoutId: LoadoutId;
  modules: ModuleId[];
}

export const EXPEDITION = {
  /** Rescue tow is always on in expedition, but costs more and runs the pod hot. */
  rescue: { costPct: 0.2, heatPenalty: 40 },
  cores: { depthPerCore: 500, perContract: 3, victoryBonus: 15 },
  /**
   * Heat — the second pressure axis. Builds below gainStartFt (≈1°/s at
   * −4500 ft with a stock radiator; the radiator multiplier scales it, giving
   * that upgrade line a second purpose), vents when shallow, dumps on refuel.
   */
  heat: {
    gainStartFt: -1_500,
    gainScaleFt: 3_000,
    perTileDug: 0.3,
    perLavaHit: 20,
    coolShallowPerSec: 4,
    coolSurfacePerSec: 25,
    /** At max heat the hull cooks: 2 HP/s (1 HP every 21 ticks). */
    overheatDamagePerSec: 2,
    warn1: 70,
    warn2: 90,
    warnResetBelow: 60,
    max: 100,
  },
  /**
   * Collect chains — consecutive same-mineral pickups bank a sale bonus.
   * A chain of N (≥3) banks min(perChainCap, N−2) percent, vault capped at
   * maxBankPct; the vault pays out at the processor and damage voids only the
   * running chain, never the vault. Dread preserved, hoarding rewarded.
   */
  chain: {
    minChain: 3,
    perChainCap: 20,
    maxBankPct: 50,
    timeoutTicks: 840, // 20 s of no pickups gently banks instead of voiding
  },
} as const;

/** Starting rigs, unlocked once with cores, then free to pick per run. */
export interface LoadoutDef {
  id: LoadoutId;
  key: string; // strings.ts name/blurb lookup
  cost: number; // cores, one-time unlock
  upgrades: Partial<Record<UpgradeCategory, number>>; // tier overrides
}

export const LOADOUTS: readonly LoadoutDef[] = [
  { id: 'standard', key: 'loStandard', cost: 0, upgrades: {} },
  { id: 'heavyRig', key: 'loHeavyRig', cost: 20, upgrades: { hull: 2, radiator: 2 } },
  { id: 'prospector', key: 'loProspector', cost: 30, upgrades: { drill: 2, engine: 1 } },
];

/**
 * Modules — the SteamWorld Dig 2 "cogs" lesson: buy once with cores, re-slot
 * freely between runs (experimentation is free), MODULE_SLOTS at a time.
 * Daily runs ignore modules so result codes stay comparable.
 */
export interface ModuleDef {
  id: ModuleId;
  key: string; // strings.ts name/blurb lookup
  cost: number; // cores, one-time unlock
}

export const MODULE_SLOTS = 2;

export const MODULES: readonly ModuleDef[] = [
  { id: 'thermalFins', key: 'mdThermalFins', cost: 10 },
  { id: 'auxTank', key: 'mdAuxTank', cost: 10 },
  { id: 'shockAbsorbers', key: 'mdShockAbsorbers', cost: 12 },
  { id: 'bulkhead', key: 'mdBulkhead', cost: 12 },
  { id: 'sparkPlug', key: 'mdSparkPlug', cost: 15 },
  { id: 'surveyor', key: 'mdSurveyor', cost: 8 },
];

export const MODULE_EFFECTS = {
  thermalFinsHeatMult: 0.75,
  auxTankLiters: 15,
  shockAbsorbersFallMult: 0.7,
  bulkheadHp: 20,
  sparkPlugDigFuelMult: 0.85,
  // surveyor is presentation-only: forces the minimap + ore glyphs on.
} as const;

/** Drive cores banked by a finished run (win or wreck — depth always pays). */
export function coresEarned(r: {
  maxDepthFt: number;
  contractsDone: number;
  victory: boolean;
}): number {
  return (
    Math.floor(Math.max(0, -r.maxDepthFt) / EXPEDITION.cores.depthPerCore) +
    EXPEDITION.cores.perContract * r.contractsDone +
    (r.victory ? EXPEDITION.cores.victoryBonus : 0)
  );
}
