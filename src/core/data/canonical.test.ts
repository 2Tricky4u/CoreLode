/**
 * THE ENCODED RULESET — verbatim values recovered from the original game
 * (docs/calibration.md). Any drift in these tables fails CI.
 */
import { describe, expect, it } from 'vitest';
import {
  ALTIMETER_ARENA_FT,
  ALTIMETER_GLITCH_FT,
  TICK_HZ,
  TILE_FT,
  TILE_PX,
  WORLD_H,
  WORLD_W,
} from './constants';
import { bossFormHp, mineralValueMod, saleValue } from './difficulty';
import { ITEMS, ITEM_BY_ID, ITEM_EFFECTS } from './items';
import { COLLECTIBLES, DIRT_POINTS, POINTS_TILE_CAP, POINTS_VALUE_MULT } from './minerals';
import { PHYSICS } from './physics';
import { FUEL_PRICE_PER_L, REPAIR_COST_PER_HP, UPGRADES } from './upgrades';
import { WORLDGEN } from './worldgen';

describe('engine constants (from SWF header/bytecode)', () => {
  it('runs at the original 42 Hz with 50px/12.5ft tiles on a 36×600 grid', () => {
    expect(TICK_HZ).toBe(42);
    expect(TILE_PX).toBe(50);
    expect(TILE_FT).toBe(12.5);
    expect(WORLD_W).toBe(36);
    expect(WORLD_H).toBe(600);
  });
  it('altimeter thresholds', () => {
    expect(ALTIMETER_ARENA_FT).toBe(-7300);
    expect(ALTIMETER_GLITCH_FT).toBe(-5813);
  });
});

describe('physics (verbatim per-frame constants)', () => {
  it('gravity 9.81/30 capped at 20; drag 0.98; friction 0.94; bounce −0.2', () => {
    expect(PHYSICS.gravity).toBe(9.81);
    expect(PHYSICS.gravityDivisor).toBe(30);
    expect(PHYSICS.maxFallVel).toBe(20);
    expect(PHYSICS.airResistance).toBe(0.98);
    expect(PHYSICS.groundFriction).toBe(0.94);
    expect(PHYSICS.bounce).toBe(-0.2);
  });
  it('fall damage: >7 px/frame → yVel/2', () => {
    expect(PHYSICS.fallDamageThreshold).toBe(7);
    expect(PHYSICS.fallDamageDivisor).toBe(2);
  });
  it('fuel burn: fly P/50000, dig P/25000; base mass 198', () => {
    expect(PHYSICS.fuelFlyDivisor).toBe(50_000);
    expect(PHYSICS.fuelDigDivisor).toBe(25_000);
    expect(PHYSICS.baseMass).toBe(198);
  });
  it('dig engages after >5 held frames; breaks at 15px of 40px traversal', () => {
    expect(PHYSICS.digStartDelayFrames).toBe(5);
    expect(PHYSICS.digBreakAtPx).toBe(15);
    expect(PHYSICS.digDonePx).toBe(40);
  });
});

describe('upgrade tables (verbatim)', () => {
  it('drill speeds 2/2.8/4/5/7/9.5/12 px/frame', () => {
    expect(UPGRADES.drill.map((t) => t.stat)).toEqual([2, 2.8, 4, 5, 7, 9.5, 12]);
  });
  it('hull 10/17/30/50/80/120/180', () => {
    expect(UPGRADES.hull.map((t) => t.stat)).toEqual([10, 17, 30, 50, 80, 120, 180]);
  });
  it('engine 150–210', () => {
    expect(UPGRADES.engine.map((t) => t.stat)).toEqual([150, 160, 170, 180, 190, 200, 210]);
  });
  it('tanks 10/15/25/40/60/100/150 L', () => {
    expect(UPGRADES.fuelTank.map((t) => t.stat)).toEqual([10, 15, 25, 40, 60, 100, 150]);
  });
  it('radiator multipliers 1/0.9/0.75/0.6/0.4/0.2 — and NO $750 tier (quirk)', () => {
    expect(UPGRADES.radiator.map((t) => t.stat)).toEqual([1, 0.9, 0.75, 0.6, 0.4, 0.2]);
    expect(UPGRADES.radiator.map((t) => t.price)).toEqual([
      0, 2_000, 5_000, 20_000, 100_000, 500_000,
    ]);
  });
  it('bay 7/15/25/40/70/120 — and NO $500k tier (quirk)', () => {
    expect(UPGRADES.bay.map((t) => t.stat)).toEqual([7, 15, 25, 40, 70, 120]);
    expect(UPGRADES.bay.map((t) => t.price)).toEqual([0, 750, 2_000, 5_000, 20_000, 100_000]);
  });
  it('standard price ladder on 7-tier lines', () => {
    for (const cat of ['drill', 'hull', 'engine', 'fuelTank'] as const) {
      expect(UPGRADES[cat].map((t) => t.price)).toEqual([
        0, 750, 2_000, 5_000, 20_000, 100_000, 500_000,
      ]);
    }
  });
  it('repair $15/HP, fuel $1/L', () => {
    expect(REPAIR_COST_PER_HP).toBe(15);
    expect(FUEL_PRICE_PER_L).toBe(1);
  });
});

describe('collectibles (verbatim mineral(index, mass, value) table)', () => {
  const expected: Array<[number, number, number]> = [
    [0, 1, 30],
    [1, 1, 60],
    [2, 1, 100],
    [3, 2, 250],
    [4, 3, 750],
    [5, 4, 2_000],
    [6, 6, 5_000],
    [7, 8, 20_000],
    [8, 10, 100_000],
    [9, 12, 500_000],
    [10, 1, 1_000],
    [11, 1, 5_000],
    [12, 1, 10_000],
    [13, 1, 50_000],
    [14, 1, 50_000],
    [15, 1, 100_000],
    [16, 1, 200_000],
    [17, 1, 300_000],
    [18, 1, 400_000],
    [19, 1, 500_000],
    [20, 1, 500_000],
    [21, 1, 600_000],
    [22, 1, 1_000_000],
    [23, 1, 25_000_000],
  ];
  it('all 24 entries match', () => {
    expect(COLLECTIBLES.length).toBe(24);
    for (const [id, mass, value] of expected) {
      expect(COLLECTIBLES[id].mass, `#${id} mass`).toBe(mass);
      expect(COLLECTIBLES[id].value, `#${id} value`).toBe(value);
    }
  });
  it('points formula: dirt 25, minerals ×5, capped at tile 14 (Diamond)', () => {
    expect(DIRT_POINTS).toBe(25);
    expect(POINTS_VALUE_MULT).toBe(5);
    expect(POINTS_TILE_CAP).toBe(14);
    // Amazonite (tile 15) → capped to Diamond: 100000×5 = 500000 points
    expect(COLLECTIBLES[Math.min(15, POINTS_TILE_CAP) - 6].value * POINTS_VALUE_MULT).toBe(500_000);
  });
});

describe('items (verbatim)', () => {
  it('prices and hotkeys', () => {
    expect(ITEM_BY_ID.reserveFuel.price).toBe(2_000);
    expect(ITEM_BY_ID.reserveFuel.hotkey).toBe('F');
    expect(ITEM_BY_ID.nanoWelders.price).toBe(7_500);
    expect(ITEM_BY_ID.nanoWelders.hotkey).toBe('R');
    expect(ITEM_BY_ID.dynamite.price).toBe(2_000);
    expect(ITEM_BY_ID.plastique.price).toBe(5_000);
    expect(ITEM_BY_ID.discountTeleporter.price).toBe(2_000);
    expect(ITEM_BY_ID.priorityTransporter.price).toBe(10_000);
    expect(ITEM_BY_ID.coreTeleporter.price).toBe(1); // hidden dev item
    expect(ITEMS.filter((i) => i.shopVisible).length).toBe(6);
  });
  it('effects: +25L, +30HP, 3×3/5×5, boss 240/120/60', () => {
    expect(ITEM_EFFECTS.reserveFuelLiters).toBe(25);
    expect(ITEM_EFFECTS.nanoWeldersHp).toBe(30);
    expect(ITEM_EFFECTS.dynamiteRadiusTiles).toBe(1);
    expect(ITEM_EFFECTS.plastiqueRadiusTiles).toBe(2);
    expect(ITEM_EFFECTS.bossDamage).toEqual({
      plastiqueCenter: 240,
      dynamiteCenter: 120,
      offCenter: 60,
    });
  });
  it('ground-only rules', () => {
    for (const id of [
      'dynamite',
      'plastique',
      'discountTeleporter',
      'priorityTransporter',
    ] as const)
      expect(ITEM_BY_ID[id].groundOnly).toBe(true);
    expect(ITEM_BY_ID.reserveFuel.groundOnly).toBe(false);
    expect(ITEM_BY_ID.nanoWelders.groundOnly).toBe(false);
  });
});

describe('difficulty / NG+ (verbatim: ×lvl points & boss, ÷lvl cash)', () => {
  it('boss HP 1000/2000 × level', () => {
    expect(bossFormHp(1, 1)).toBe(1_000);
    expect(bossFormHp(2, 1)).toBe(2_000);
    expect(bossFormHp(1, 3)).toBe(3_000);
  });
  it('sale value divides by level', () => {
    expect(saleValue(100_000, 1)).toBe(100_000);
    expect(saleValue(100_000, 2)).toBe(50_000);
    expect(mineralValueMod(4)).toBe(4);
  });
});

describe('worldgen parameters (verbatim)', () => {
  it('mineralRate 65, artifact row 80, ⅓ caverns', () => {
    expect(WORLDGEN.mineralRate).toBe(65);
    expect(WORLDGEN.artifactMinRow).toBe(80);
    expect(WORLDGEN.cavernChance).toBe(3);
    expect(WORLDGEN.hazardDensityScale).toBe(15);
  });
});
