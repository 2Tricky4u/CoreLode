/**
 * Expedition mode — the roguelike layer. Single life, seeded world (the world
 * generator itself is untouched), heat pressure, contracts, and a "drive cores"
 * meta-economy. Every number here is remake tuning, never calibration data.
 */
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
