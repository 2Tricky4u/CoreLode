/**
 * Consumable items, verbatim values from the original (docs/calibration.md §Items).
 * Hotkeys F/R/X/C/Q/M and the hidden `0` item match the original bindings.
 */
import { CAL } from './physics';

export type ItemId =
  | 'reserveFuel'
  | 'nanoWelders'
  | 'dynamite'
  | 'plastique'
  | 'discountTeleporter'
  | 'priorityTransporter'
  | 'coreTeleporter';

export interface ItemDef {
  id: ItemId;
  key: string; // strings.ts lookup
  price: number;
  hotkey: string; // KeyboardEvent.code suffix, e.g. 'F'
  groundOnly: boolean;
  shopVisible: boolean; // core teleporter is hidden from the shop
}

export const ITEMS: readonly ItemDef[] = [
  {
    id: 'reserveFuel',
    key: 'itemReserveFuel',
    price: 2_000,
    hotkey: 'F',
    groundOnly: false,
    shopVisible: true,
  },
  {
    id: 'nanoWelders',
    key: 'itemNanoWelders',
    price: 7_500,
    hotkey: 'R',
    groundOnly: false,
    shopVisible: true,
  },
  {
    id: 'dynamite',
    key: 'itemDynamite',
    price: 2_000,
    hotkey: 'X',
    groundOnly: true,
    shopVisible: true,
  },
  {
    id: 'plastique',
    key: 'itemPlastique',
    price: 5_000,
    hotkey: 'C',
    groundOnly: true,
    shopVisible: true,
  },
  {
    id: 'discountTeleporter',
    key: 'itemDiscountTeleporter',
    price: 2_000,
    hotkey: 'Q',
    groundOnly: true,
    shopVisible: true,
  },
  {
    id: 'priorityTransporter',
    key: 'itemPriorityTransporter',
    price: 10_000,
    hotkey: 'M',
    groundOnly: true,
    shopVisible: true,
  },
  // Hidden dev/easter-egg item from the original ($1, hotkey 0, "to the planet's core").
  {
    id: 'coreTeleporter',
    key: 'itemCoreTeleporter',
    price: 1,
    hotkey: 'Digit0',
    groundOnly: true,
    shopVisible: false,
  },
];

export const ITEM_BY_ID: Record<ItemId, ItemDef> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i]),
) as Record<ItemId, ItemDef>;

export const ITEM_EFFECTS = {
  reserveFuelLiters: 25, // min-capped at tank capacity
  nanoWeldersHp: 30, // min-capped at max hull
  dynamiteRadiusTiles: 1, // 3×3
  plastiqueRadiusTiles: 2, // 5×5
  bossDamage: { plastiqueCenter: 240, dynamiteCenter: 120, offCenter: 60 },
  /** Center-blast distance threshold vs the boss, in tiles. */
  bossCenterRangeTiles: CAL(1.5, 'off-center falloff radius not decompiled'),
  /**
   * Discount teleporter: original "teleports you somewhere above surface level
   * (results may vary)" — a random drop height above the surface, so the danger
   * is fall damage.
   */
  discountDropMinFt: CAL(0, 'drop-height distribution not decompiled'),
  discountDropMaxFt: CAL(220, 'up to a 7-8 HP fall at worst'),
  explosionFuseFrames: CAL(42, '~1 s fuse before the blast'),
} as const;
