/**
 * Expedition relics — run-defining pickups offered at depth milestones
 * (Dome Keeper's lesson: high-variance choices beat stat bumps). Chosen via
 * the chooseRelic command; effects hook the sim where blueprints already do.
 * Remake content, never calibration data.
 */
export type RelicId =
  | 'oreMagnet'
  | 'gasPhase'
  | 'chainDetonate'
  | 'heatSink'
  | 'scavenger'
  | 'seismicScanner';

export interface RelicDef {
  id: RelicId;
  key: string; // strings.ts name/blurb lookup
}

export const RELICS: readonly RelicDef[] = [
  { id: 'oreMagnet', key: 'rlOreMagnet' },
  { id: 'gasPhase', key: 'rlGasPhase' },
  { id: 'chainDetonate', key: 'rlChainDetonate' },
  { id: 'heatSink', key: 'rlHeatSink' },
  { id: 'scavenger', key: 'rlScavenger' },
  { id: 'seismicScanner', key: 'rlSeismicScanner' },
];

/** Depth watermarks that each trigger one three-way relic offer. */
export const RELIC_DEPTHS_FT = [-1_000, -2_500, -4_500, -6_500] as const;
export const RELIC_CHOICES = 3;
