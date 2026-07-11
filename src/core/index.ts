/** Public core API — everything the presentation layer may touch. */
export { tick } from './sim/tick';
export { applyCommand, type Command } from './commands';
export {
  createRun,
  podDepthFt,
  type ContractState,
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
  hasSurveyor,
  podAlive,
  wallet,
  type Critter,
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
export { RELICS, type RelicDef, type RelicId } from './data/relics';
export {
  EXPEDITION,
  LOADOUTS,
  MODULES,
  MODULE_SLOTS,
  coresEarned,
  type ExpeditionConfig,
  type LoadoutDef,
  type LoadoutId,
  type ModuleDef,
  type ModuleId,
} from './data/expedition';
export { CHALLENGES, type Objective } from './data/challenges';
export { BLUEPRINTS, type BlueprintId } from './data/blueprints';
export {
  SETTING_DEFS,
  defaultSettings,
  effectiveSettings,
  type SettingsValues,
} from './data/settings';
export { SFX, type SfxKey } from './data/sfx';
export { saleValue, bossFormHp } from './data/difficulty';
export { serialize, deserialize, SAVE_VERSION, type SaveFile } from './save/schema';
export { encodeSave, decodeSave, encodeToken, decodeToken } from './save/codec';
export { encodeSnapshot, decodeSnapshot } from './net/snapshot';
export { slotSummary, type SlotSummary } from './save/summary';
export {
  dailyKey,
  dailySeed,
  encodeDailyResult,
  decodeDailyResult,
  type DailyResult,
} from './daily';
export {
  PROTO_VERSION,
  INPUT_DELAY_TICKS,
  HASH_EVERY_TICKS,
  encodeMsg,
  decodeMsg,
  type NetMessage,
} from './net/messages';
export {
  HostSequencer,
  BundleLedger,
  coopStateHash,
  type Bundle,
  type PlayerInput,
} from './net/lockstep';
export { COOP, PLAYER_TINTS } from './data/coop';
