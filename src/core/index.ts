/** Public core API — everything the presentation layer may touch. */
export { tick } from './sim/tick';
export { applyCommand, type Command } from './commands';
export {
  createRun,
  podDepthFt,
  podTileX,
  podTileY,
  maxHull,
  tankCapacity,
  bayCapacity,
  bayUsed,
  podMass,
  enginePower,
  drillSpeed,
  radiatorMult,
  challengeDef,
  type GameState,
  type PodState,
  type BossState,
  type ModeConfig,
  type NewRunOptions,
} from './sim/state';
export { type IntentFrame, EMPTY_INTENTS } from './intents';
export type { SimEvent, EventSink, DamageCause } from './events';
export { getTile, setTile } from './world/world';
export { Tile, isGas, isLava, isBoulder, isMineral, isArtifact, isDirt } from './world/tiles';
export * from './data/constants';
export { PHYSICS } from './data/physics';
export { COLLECTIBLES } from './data/minerals';
export {
  UPGRADES,
  UPGRADE_CATEGORIES,
  REPAIR_COST_PER_HP,
  FUEL_PRICE_PER_L,
  FUEL_BUY_BUTTONS,
  type UpgradeCategory,
} from './data/upgrades';
export { ITEMS, ITEM_BY_ID, type ItemId } from './data/items';
export { BUILDINGS, type BuildingId } from './data/buildings';
export { TRANSMISSIONS, SKY_EGGS } from './data/story';
export { STRATA_KEYS, stratumIndexAt } from './data/strata';
export {
  EXPEDITION,
  coresEarned,
  type ExpeditionConfig,
  type LoadoutId,
  type ModuleId,
} from './data/expedition';
export { CHALLENGES } from './data/challenges';
export { BLUEPRINTS, type BlueprintId } from './data/blueprints';
export {
  SETTING_DEFS,
  defaultSettings,
  effectiveSettings,
  type SettingsValues,
} from './data/settings';
export { SFX, type SfxKey } from './data/sfx';
export { saleValue, bossFormHp } from './data/difficulty';
export { serialize, deserialize, type SaveFile } from './save/schema';
export { slotSummary, type SlotSummary } from './save/summary';
export {
  dailyKey,
  dailySeed,
  encodeDailyResult,
  decodeDailyResult,
  type DailyResult,
} from './daily';
