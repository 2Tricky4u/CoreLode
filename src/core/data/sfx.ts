/**
 * ZzFX sound parameter arrays (all-original, generated for this remake — legally
 * clean). The presentation layer synthesizes these at runtime via the bundled
 * ZzFX player; no audio files are shipped for SFX.
 * Param order: [volume, randomness, frequency, attack, sustain, release, shape,
 * shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise,
 * modulation, bitCrush, delay, sustainVolume, decay, tremolo]
 */

export type SfxKey =
  | 'drillLoop'
  | 'thrustLoop'
  | 'landThump'
  | 'hullHit'
  | 'clink'
  | 'collect'
  | 'collectBig'
  | 'cargoFull'
  | 'sell'
  | 'buy'
  | 'error'
  | 'fuelLow'
  | 'refuel'
  | 'nano'
  | 'explosionSmall'
  | 'explosionLarge'
  | 'gasHiss'
  | 'lavaSizzle'
  | 'transmission'
  | 'textBlip'
  | 'teleportUp'
  | 'teleportFail'
  | 'save'
  | 'schematic'
  | 'bossLaser'
  | 'bossSwing'
  | 'bossFireball'
  | 'bossHurt'
  | 'bossDeath'
  | 'seraph'
  | 'quakeRumble'
  | 'uiClick'
  | 'uiBack';

export const SFX: Record<SfxKey, (number | undefined)[]> = {
  drillLoop: [0.3, 0.05, 90, 0.02, 0.18, 0.08, 3, 0.4, 0, 0, 0, 0, 0.06, 2.5],
  thrustLoop: [0.25, 0.1, 60, 0.05, 0.2, 0.1, 3, 0.2, 0, 0, 0, 0, 0, 3.5],
  landThump: [0.8, 0.02, 70, 0, 0.04, 0.15, 2, 1.2, -4],
  hullHit: [0.9, 0.05, 180, 0, 0.05, 0.2, 2, 1.8, -6, 0, 0, 0, 0, 1.2],
  clink: [0.5, 0.02, 900, 0, 0.02, 0.06, 1, 2.4, 0, 0, 0, 0, 0, 0.4],
  collect: [0.6, 0.02, 520, 0, 0.06, 0.18, 0, 1.4, 0, 0, 120, 0.05],
  collectBig: [0.7, 0.02, 420, 0, 0.1, 0.3, 0, 1.2, 0, 0, 180, 0.07],
  cargoFull: [0.6, 0.03, 160, 0, 0.12, 0.1, 2, 0.6, -2],
  sell: [0.6, 0.02, 700, 0, 0.08, 0.2, 0, 1.6, 6, 0, 90, 0.04],
  buy: [0.5, 0.02, 600, 0, 0.05, 0.12, 0, 1.5, 4],
  error: [0.6, 0.05, 140, 0, 0.1, 0.12, 2, 0.5, -1],
  fuelLow: [0.5, 0, 880, 0.01, 0.12, 0.12, 1, 0, 0, 0, 0, 0, 0.35],
  refuel: [0.5, 0.03, 240, 0.02, 0.25, 0.15, 3, 0.8, 2],
  nano: [0.5, 0.03, 980, 0.02, 0.2, 0.2, 1, 1.2, 0, 0, 60, 0.1],
  explosionSmall: [1.2, 0.1, 80, 0, 0.1, 0.5, 4, 2, -1, 0, 0, 0, 0, 4],
  explosionLarge: [1.6, 0.1, 50, 0, 0.15, 0.9, 4, 2.4, -1, 0, 0, 0, 0, 5],
  gasHiss: [0.9, 0.15, 220, 0.02, 0.3, 0.4, 4, 1, 0, 0, 0, 0, 0, 6],
  lavaSizzle: [0.9, 0.1, 120, 0.01, 0.25, 0.4, 4, 1.4, -0.5, 0, 0, 0, 0, 3],
  transmission: [0.6, 0.02, 1100, 0.01, 0.08, 0.15, 1, 1.6, 0, 0, 200, 0.06],
  textBlip: [0.25, 0.02, 800, 0, 0.015, 0.03, 1, 1.2],
  teleportUp: [0.8, 0.05, 300, 0.08, 0.3, 0.4, 1, 1.5, 8, 0.4],
  teleportFail: [0.9, 0.1, 320, 0.05, 0.25, 0.4, 2, 1.2, -6, -0.3],
  save: [0.6, 0.02, 660, 0.02, 0.15, 0.25, 0, 1.3, 0, 0, 110, 0.08],
  schematic: [0.7, 0.02, 480, 0.03, 0.3, 0.5, 1, 1.2, 2, 0, 150, 0.1],
  bossLaser: [1, 0.05, 1200, 0.05, 0.4, 0.3, 3, 0.8, -8, -0.2, 0, 0, 0, 2],
  bossSwing: [0.9, 0.05, 90, 0.02, 0.15, 0.25, 4, 1.6, -3, 0, 0, 0, 0, 2.5],
  bossFireball: [0.9, 0.08, 140, 0.03, 0.3, 0.4, 4, 1.2, -1, 0, 0, 0, 0, 3],
  bossHurt: [1, 0.05, 200, 0, 0.12, 0.35, 2, 1.6, -4, 0, 0, 0, 0, 1.5],
  bossDeath: [1.5, 0.1, 60, 0.05, 0.5, 1.5, 4, 2, -0.5, 0, 0, 0, 0, 5],
  seraph: [0.6, 0.01, 1040, 0.05, 0.4, 0.6, 0, 1, 0, 0, 260, 0.15],
  quakeRumble: [1.1, 0.2, 40, 0.1, 0.6, 0.8, 4, 0.6, 0, 0, 0, 0, 0.12, 6],
  uiClick: [0.35, 0.01, 700, 0, 0.02, 0.04, 1, 1.5],
  uiBack: [0.35, 0.01, 500, 0, 0.02, 0.05, 1, 1.2, -2],
};
