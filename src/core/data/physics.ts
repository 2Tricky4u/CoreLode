/**
 * Pod physics — every value here is per-frame at 42 Hz, in original px units,
 * recovered from the SWF bytecode (docs/calibration.md). CAL() marks values that
 * still need black-box tuning against the Ruffle-hosted original.
 */

/** Provisional value pending calibration vs the original. Runtime no-op; greppable. */
export const CAL = (provisional: number, _note: string): number => provisional;

export const PHYSICS = {
  /** yVel += GRAVITY / 30 each airborne frame (= +0.327 px/frame²). */
  gravity: 9.81,
  gravityDivisor: 30,
  /** Hard cap on downward velocity, px/frame (drag equilibrium ~16.35 is usually lower). */
  maxFallVel: 20,
  /** Both velocity components multiply by this each airborne frame. */
  airResistance: 0.98,
  /** Horizontal velocity multiplier while grounded. */
  groundFriction: 0.94,
  /** Thrust acceleration = enginePower / mass / thrustDivisor (px/frame²). */
  thrustDivisor: 1.5,
  /** Horizontal drive acceleration = enginePower / mass / horizDivisor (px/frame²). */
  horizDivisor: CAL(1.5, 'exact horizontal accel expression not recovered; fit vs original'),
  /** Max horizontal speed, px/frame. */
  maxHorizVel: CAL(9, 'not recovered; fit vs original'),
  /** Landing with yVel above this deals fall damage. */
  fallDamageThreshold: 7,
  /** Fall damage = floor(yVel / this) HP. */
  fallDamageDivisor: 2,
  /** Vertical bounce factor applied on floor/ceiling impact. */
  bounce: -0.2,
  /** Pod base mass (cargo minerals add their mass). Original units (~×10 kg display). */
  baseMass: 198,

  /** Fuel burn per frame = enginePower / divisor. */
  fuelFlyDivisor: 50_000,
  fuelDigDivisor: 25_000,
  fuelIdlePerFrame: CAL(0, 'no idle-burn site found in bytecode; assumed zero'),

  /** Frames a direction must be held against diggable ground before the drill engages. */
  digStartDelayFrames: 5,
  /** Digging traversal: px of tile travel at which the tile visually breaks... */
  digBreakAtPx: 15,
  /** ...and px at which the dig completes (pod centered in the dug cell). */
  digDonePx: 40,
  /** Frames between consumable item uses. */
  itemCooldownFrames: 5,
} as const;

/**
 * Deliberate remake deviation (user-tuned): early drill tiers bite slower so
 * upgrades feel meaningful; converges to the verbatim table by the top tier.
 * Applied in drillSpeed(); UPGRADES.drill stays verbatim for the fidelity record.
 */
export const DRILL_SPEED_TUNE = [0.6, 0.7, 0.78, 0.85, 0.92, 0.97, 1] as const;

/** Per-frame thrust acceleration for a pod of the given engine power and mass. */
export const thrustAccel = (enginePower: number, mass: number): number =>
  enginePower / mass / PHYSICS.thrustDivisor;

/** Per-frame horizontal acceleration. */
export const horizAccel = (enginePower: number, mass: number): number =>
  enginePower / mass / PHYSICS.horizDivisor;

/** Fall damage for a landing at the given downward velocity (px/frame). */
export const fallDamage = (yVel: number): number =>
  yVel > PHYSICS.fallDamageThreshold ? Math.floor(yVel / PHYSICS.fallDamageDivisor) : 0;
