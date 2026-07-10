import type { BlueprintId } from './data/blueprints';
import type { BossAttackKind } from './data/boss';
import type { BuildingId } from './data/buildings';
/** Typed events — the only channel from the sim to the presentation layer. */
import type { ItemId } from './data/items';
import type { SfxKey } from './data/sfx';

export type DamageCause = 'fall' | 'lava' | 'gas' | 'blast' | 'boss' | 'teleport' | 'heat';

export type SimEvent =
  | { t: 'tileCleared'; x: number; y: number; tile: number; cause: 'drill' | 'blast' }
  | { t: 'digStart'; x: number; y: number; dir: 'down' | 'left' | 'right' }
  | { t: 'collected'; collectibleId: number }
  | { t: 'cargoFullLost'; collectibleId: number }
  | { t: 'points'; amount: number }
  | { t: 'landed'; impactVel: number; damage: number }
  | { t: 'damage'; amount: number; cause: DamageCause }
  | { t: 'fuelLow' }
  /** Fuel-failsafe assist fired: towed to the surface, cargo forfeited. */
  | { t: 'rescue'; cost: number; cargoLost: number }
  /** Expedition heat crossed a warning threshold (70 / 90). */
  | { t: 'heatWarning'; level: 1 | 2 }
  /** Expedition collect chain grew (emitted from ×2 up). */
  | { t: 'chain'; collectibleId: number; count: number }
  /** Expedition chain ended — banked into the sale-bonus vault or voided. */
  | { t: 'chainBroken'; count: number; banked: boolean }
  | { t: 'podExploded'; cause: 'hull' | 'fuel' }
  | { t: 'explosion'; x: number; y: number; radiusTiles: number; item: ItemId }
  | { t: 'gasIgnite'; x: number; y: number }
  | { t: 'teleport'; item: ItemId }
  | { t: 'enterBuilding'; id: BuildingId }
  /** The pod is standing on a building (id) or has left one (null) — drives the interact prompt. */
  | { t: 'buildingPrompt'; id: BuildingId | null }
  | { t: 'transaction'; kind: string; amount: number }
  | { t: 'transmission'; id: string }
  | { t: 'bonusCash'; amount: number }
  | { t: 'guardianSpawned' }
  | { t: 'quake'; rows: number[] }
  | { t: 'blueprintFound'; id: BlueprintId }
  | { t: 'bossActivated'; form: 1 | 2 }
  | { t: 'bossAttack'; form: 1 | 2; kind: BossAttackKind }
  | { t: 'bossDamaged'; amount: number; hp: number }
  | { t: 'bossFormDown'; form: 1 | 2 }
  | { t: 'bossReset' }
  | { t: 'victory' }
  | { t: 'challengeResult'; win: boolean; elapsedTicks: number }
  /** A typo here is a compile error — the audio analogue of check-frames.mjs. */
  | { t: 'sfx'; key: SfxKey };

export type EventSink = SimEvent[];
