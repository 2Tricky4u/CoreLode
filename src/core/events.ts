import type { BlueprintId } from './data/blueprints';
import type { BossAttackKind } from './data/boss';
import type { BuildingId } from './data/buildings';
/** Typed events — the only channel from the sim to the presentation layer. */
import type { ItemId } from './data/items';

export type DamageCause = 'fall' | 'lava' | 'gas' | 'blast' | 'boss' | 'teleport';

export type SimEvent =
  | { t: 'tileCleared'; x: number; y: number; tile: number; cause: 'drill' | 'blast' }
  | { t: 'digStart'; x: number; y: number; dir: 'down' | 'left' | 'right' }
  | { t: 'collected'; collectibleId: number }
  | { t: 'cargoFullLost'; collectibleId: number }
  | { t: 'points'; amount: number }
  | { t: 'landed'; impactVel: number; damage: number }
  | { t: 'damage'; amount: number; cause: DamageCause }
  | { t: 'fuelLow' }
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
  | { t: 'sfx'; key: string };

export type EventSink = SimEvent[];
