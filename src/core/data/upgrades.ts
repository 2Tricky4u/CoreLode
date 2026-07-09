/**
 * The six upgrade lines, verbatim from the original bytecode (values), with
 * clean-room display names resolved via content/strings.ts using `key`.
 * Tier index is 0-based. Goldium-mode "relic schematic" super-tiers are appended
 * at runtime from blueprints.ts when unlocked.
 */

export type UpgradeCategory = 'drill' | 'hull' | 'engine' | 'fuelTank' | 'radiator' | 'bay';

export interface UpgradeTier {
  key: string; // strings.ts name lookup
  price: number; // $0 for stock tier
  stat: number; // meaning depends on category (see below)
}

/** drill: dig speed px/frame · hull: max HP · engine: power · fuelTank: liters ·
 *  radiator: damage multiplier (1 = none, 0.2 = −80%) · bay: cargo units */
export const UPGRADES: Record<UpgradeCategory, readonly UpgradeTier[]> = {
  drill: [
    { key: 'drill0', price: 0, stat: 2 },
    { key: 'drill1', price: 750, stat: 2.8 },
    { key: 'drill2', price: 2_000, stat: 4 },
    { key: 'drill3', price: 5_000, stat: 5 },
    { key: 'drill4', price: 20_000, stat: 7 },
    { key: 'drill5', price: 100_000, stat: 9.5 },
    { key: 'drill6', price: 500_000, stat: 12 },
  ],
  hull: [
    { key: 'hull0', price: 0, stat: 10 },
    { key: 'hull1', price: 750, stat: 17 },
    { key: 'hull2', price: 2_000, stat: 30 },
    { key: 'hull3', price: 5_000, stat: 50 },
    { key: 'hull4', price: 20_000, stat: 80 },
    { key: 'hull5', price: 100_000, stat: 120 },
    { key: 'hull6', price: 500_000, stat: 180 },
  ],
  engine: [
    { key: 'engine0', price: 0, stat: 150 },
    { key: 'engine1', price: 750, stat: 160 },
    { key: 'engine2', price: 2_000, stat: 170 },
    { key: 'engine3', price: 5_000, stat: 180 },
    { key: 'engine4', price: 20_000, stat: 190 },
    { key: 'engine5', price: 100_000, stat: 200 },
    { key: 'engine6', price: 500_000, stat: 210 },
  ],
  fuelTank: [
    { key: 'fuelTank0', price: 0, stat: 10 },
    { key: 'fuelTank1', price: 750, stat: 15 },
    { key: 'fuelTank2', price: 2_000, stat: 25 },
    { key: 'fuelTank3', price: 5_000, stat: 40 },
    { key: 'fuelTank4', price: 20_000, stat: 60 },
    { key: 'fuelTank5', price: 100_000, stat: 100 },
    { key: 'fuelTank6', price: 500_000, stat: 150 },
  ],
  // Radiator has NO $750 tier (6 tiers total) — authentic quirk.
  radiator: [
    { key: 'radiator0', price: 0, stat: 1 },
    { key: 'radiator1', price: 2_000, stat: 0.9 },
    { key: 'radiator2', price: 5_000, stat: 0.75 },
    { key: 'radiator3', price: 20_000, stat: 0.6 },
    { key: 'radiator4', price: 100_000, stat: 0.4 },
    { key: 'radiator5', price: 500_000, stat: 0.2 },
  ],
  // Bay has NO $500,000 tier (6 tiers total) — authentic quirk.
  bay: [
    { key: 'bay0', price: 0, stat: 7 },
    { key: 'bay1', price: 750, stat: 15 },
    { key: 'bay2', price: 2_000, stat: 25 },
    { key: 'bay3', price: 5_000, stat: 40 },
    { key: 'bay4', price: 20_000, stat: 70 },
    { key: 'bay5', price: 100_000, stat: 120 },
  ],
};

export const UPGRADE_CATEGORIES: readonly UpgradeCategory[] = [
  'drill',
  'hull',
  'engine',
  'fuelTank',
  'radiator',
  'bay',
];

/** Hull repair price at the item shop, $ per HP (verbatim `repairCost = 15`). */
export const REPAIR_COST_PER_HP = 15;
/** Fuel price, $ per liter. */
export const FUEL_PRICE_PER_L = 1;
/** Fuel-shop quick-buy buttons (liters), plus "fill". */
export const FUEL_BUY_BUTTONS = [5, 10, 25, 50] as const;
