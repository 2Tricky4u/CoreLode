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
  | 'drillBite'
  | 'digBreak'
  | 'clink'
  | 'bossRoar'
  | 'bossReset'
  | 'victory'
  | 'fuseLight'
  | 'fuseTick'
  | 'doorOpen'
  | 'promptBlip'
  | 'challengeWin'
  | 'challengeFail'
  | 'podExplode'
  | 'gameOver'
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
  | 'rescue'
  | 'heatAlarm'
  | 'critter'
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
  /** Grinding auger bed: long low rumble + grit; playbackRate is ramped live with dig progress. */
  drillLoop: [
    0.32, 0.12, 55, 0.02, 0.42, 0.12, 3, 0.6, 0, 0, 0, 0, 0.045, 3.4, 0, 0, 0, 0.8, 0, 0.35,
  ],
  thrustLoop: [0.25, 0.1, 60, 0.05, 0.2, 0.1, 3, 0.2, 0, 0, 0, 0, 0, 3.5],
  landThump: [0.8, 0.02, 70, 0, 0.04, 0.15, 2, 1.2, -4],
  hullHit: [0.9, 0.05, 180, 0, 0.05, 0.2, 2, 1.8, -6, 0, 0, 0, 0, 1.2],
  /** The drill bites into diggable ground (soft, once per dig). */
  drillBite: [0.4, 0.06, 130, 0.01, 0.03, 0.06, 3, 1.3, -2, 0, 0, 0, 0, 1.6],
  /** The tile gives way — dry crumble/crunch (once per broken block). */
  digBreak: [0.5, 0.2, 95, 0, 0.05, 0.14, 4, 1.1, -3, 0, 0, 0, 0, 2.8, 0, 0, 0, 0.6, 0.04],
  /** Metallic refusal — this rock will not drill. */
  clink: [0.55, 0.02, 1150, 0, 0.02, 0.05, 1, 2.6, 0, 0, 0, 0, 0, 0.35],
  bossRoar: [1.3, 0.1, 52, 0.08, 0.55, 0.9, 4, 1.7, -0.6, 0, 0, 0, 0, 3.5],
  bossReset: [0.7, 0.1, 190, 0.15, 0.2, 0.35, 4, 1, 5, 0.25, 0, 0, 0, 3],
  victory: [0.85, 0.02, 520, 0.04, 0.4, 0.7, 0, 1.2, 0, 0, 300, 0.09, 0, 0, 0, 0, 0.1],
  fuseLight: [0.45, 0.15, 320, 0.01, 0.14, 0.2, 4, 1, 0, 0, 0, 0, 0, 5],
  fuseTick: [0.28, 0.01, 1500, 0, 0.008, 0.02, 1, 2],
  doorOpen: [0.5, 0.05, 170, 0.04, 0.2, 0.16, 2, 0.9, 3, 0.12],
  promptBlip: [0.3, 0.01, 880, 0, 0.025, 0.05, 0, 1.2, 0, 0, 190, 0.03],
  challengeWin: [0.75, 0.02, 600, 0.02, 0.25, 0.45, 0, 1.3, 0, 0, 250, 0.07],
  challengeFail: [0.6, 0.03, 210, 0.02, 0.2, 0.32, 2, 0.7, -3],
  podExplode: [1.7, 0.12, 44, 0.02, 0.26, 1.2, 4, 2.2, -0.8, 0, 0, 0, 0, 5.5],
  /** Somber game-over sting: a slow minor fall with a hollow tail. */
  gameOver: [
    0.9, 0.02, 311, 0.1, 0.45, 1.4, 1, 1.1, -1.2, -0.08, -105, 0.32, 0, 0, 0, 0, 0.15, 0.7, 0.12,
  ],
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
  // Distress klaxon dipping into a tow whoosh — the fuel-failsafe rescue.
  rescue: [0.9, 0.08, 180, 0.12, 0.35, 0.5, 1, 1.1, 5, 0.25],
  // Two-tone overheat klaxon (expedition heat warnings).
  heatAlarm: [0.8, 0.15, 440, 0.02, 0.18, 0.25, 2, 0.9, -12, 0.4],
  // A magmite skittering awake — dry chitinous chirp.
  critter: [0.7, 0.3, 900, 0.01, 0.05, 0.12, 3, 1.8, -20, 0.1],
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
