/**
 * Assist tuning — remake additions, NOT calibrated original values (never listed
 * in docs/calibration.md). Assists only run when frozen into ModeConfig.assists.
 */
export const ASSIST = {
  /** Share of cash charged for an emergency fuel tow. */
  rescueCostPct: 0.15,
  /** Liters in the tank after a tow (capped by tank capacity). */
  rescueFuelLiters: 10,
} as const;
