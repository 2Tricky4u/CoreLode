import { TICK_HZ, WORLD_H } from './constants';
/**
 * Boss data. HP and NG+ scaling are verbatim (difficulty[lvl]: form1 1000·lvl,
 * form2 2000·lvl, damage ×lvl). Attack timings/damages were not decompiled —
 * CAL values chosen to match recorded fights; structure matches the original
 * (form 1: sweeping laser + staff swing; form 2: claw sweep + bouncing fireball).
 */
import { CAL } from './physics';

export type BossAttackKind = 'laserSweep' | 'staffSwing' | 'clawSweep' | 'fireball';

export interface BossAttackDef {
  kind: BossAttackKind;
  telegraphTicks: number;
  activeTicks: number;
  recoverTicks: number;
  cooldownTicks: number;
  /** Base damage at NG+ level 1 (scales ×lvl). */
  damage: number;
  knockback: { x: number; y: number }; // px/frame impulse
  /** Staff swing locks item use while the pod ragdolls. */
  itemLockTicks?: number;
  /** Melee range in tiles (staff); undefined = arena-wide test. */
  rangeTiles?: number;
}

export interface BossFormDef {
  form: 1 | 2;
  baseHp: number; // × NG+ level
  contactDamage: number; // × NG+ level
  contactRetriggerTicks: number;
  walkSpeed: number; // px/frame (original walkSpeed = 4)
  attacks: readonly BossAttackDef[];
}

export const BOSS = {
  /**
   * Spawn point, verbatim: px (1200, 29532) → tile (24, ~590). The original y
   * anchored the sprite TOP (its ~200px body reached the floor at row 595);
   * the sim anchors body-centre and derives y from HELL_FLOOR_ROW instead, so
   * spawnRow is kept as the recovered reference value only.
   */
  spawnCol: 24,
  spawnRow: 590,
  /** Arena region: everything below the barrier band. */
  arenaTopRow: WORLD_H - 11,
  interPhaseTicks: 3 * TICK_HZ, // ~3 s between form 1 death and form 2
  /** Only grounded explosives damage the boss (verbatim behavior). */
  explosiveDamage: { plastiqueCenter: 240, dynamiteCenter: 120, offCenter: 60 },
  exitResetsHp: true,
  pauseAllowed: false,
  forms: [
    {
      form: 1,
      baseHp: 1_000,
      contactDamage: CAL(8, 'contact damage per touch, ×lvl'),
      contactRetriggerTicks: CAL(32, '~0.75 s between contact ticks'),
      walkSpeed: 4,
      attacks: [
        {
          kind: 'laserSweep',
          telegraphTicks: CAL(34, '~0.8 s'),
          activeTicks: CAL(105, '~2.5 s sweep'),
          recoverTicks: CAL(42, ''),
          cooldownTicks: CAL(252, '~6 s'),
          damage: CAL(12, 'per hit, ×lvl'),
          knockback: { x: 8, y: -4 },
        },
        {
          kind: 'staffSwing',
          telegraphTicks: CAL(21, '~0.5 s'),
          activeTicks: CAL(17, ''),
          recoverTicks: CAL(34, ''),
          cooldownTicks: CAL(126, '~3 s'),
          damage: CAL(18, 'per hit, ×lvl'),
          knockback: { x: 14, y: -10 },
          itemLockTicks: CAL(63, '~1.5 s item lockout while ragdolling'),
          rangeTiles: 3,
        },
      ],
    },
    {
      form: 2,
      baseHp: 2_000,
      contactDamage: CAL(8, '×lvl'),
      contactRetriggerTicks: CAL(32, ''),
      walkSpeed: 4,
      attacks: [
        {
          kind: 'clawSweep',
          telegraphTicks: CAL(42, '~1 s'),
          activeTicks: CAL(63, 'half-circle sweep'),
          recoverTicks: CAL(34, ''),
          cooldownTicks: CAL(189, '~4.5 s'),
          damage: CAL(15, '×lvl'),
          knockback: { x: 10, y: -6 },
        },
        {
          kind: 'fireball',
          telegraphTicks: CAL(25, ''),
          activeTicks: CAL(8, 'spawn projectile'),
          recoverTicks: CAL(34, ''),
          cooldownTicks: CAL(147, '~3.5 s'),
          damage: CAL(20, 'projectile hit, ×lvl'),
          knockback: { x: 6, y: -6 },
        },
      ],
    },
  ] as readonly BossFormDef[],
  fireball: {
    speed: CAL(6, 'px/frame horizontal'),
    bounceApexFrac: CAL(0.8, 'bounces to ~80% of arena height'),
    gravityPerFrame: CAL(0.25, ''),
    lifetimeTicks: CAL(42 * 8, ''),
  },
} as const;
