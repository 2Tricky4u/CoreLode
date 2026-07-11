import type { BlueprintId } from './data/blueprints';
import type { BossAttackKind } from './data/boss';
import type { BuildingId } from './data/buildings';
/** Typed events — the only channel from the sim to the presentation layer. */
import type { ItemId } from './data/items';
import type { SfxKey } from './data/sfx';

export type DamageCause =
  | 'fall'
  | 'lava'
  | 'gas'
  | 'blast'
  | 'boss'
  | 'teleport'
  | 'heat'
  | 'critter';

export type SimEvent =
  | {
      t: 'tileCleared';
      x: number;
      y: number;
      tile: number;
      cause: 'drill' | 'blast';
      player?: number;
    }
  | { t: 'digStart'; x: number; y: number; dir: 'down' | 'left' | 'right'; player?: number }
  | { t: 'collected'; collectibleId: number; player?: number }
  | { t: 'cargoFullLost'; collectibleId: number; player?: number }
  | { t: 'points'; amount: number; player?: number }
  | { t: 'landed'; impactVel: number; damage: number; player?: number }
  | { t: 'damage'; amount: number; cause: DamageCause; player?: number }
  | { t: 'fuelLow'; player?: number }
  /** Fuel-failsafe assist fired: towed to the surface, cargo forfeited. */
  | { t: 'rescue'; cost: number; cargoLost: number; player?: number }
  /** Expedition heat crossed a warning threshold (70 / 90). */
  | { t: 'heatWarning'; level: 1 | 2; player?: number }
  /** Expedition collect chain grew (emitted from ×2 up). */
  | { t: 'chain'; collectibleId: number; count: number; player?: number }
  /** Expedition chain ended — banked into the sale-bonus vault or voided. */
  | { t: 'chainBroken'; count: number; banked: boolean; player?: number }
  /** An expedition contract completed and paid out. */
  | { t: 'contractDone'; index: number; rewardCash: number }
  /** Depth milestone reached — pick one of these relics (chooseRelic command). */
  | { t: 'relicOffer'; choices: string[] }
  /** A magmite woke up (expedition) / was destroyed. */
  | { t: 'critterSpawned'; x: number; y: number }
  | { t: 'critterKilled'; x: number; y: number }
  | { t: 'podExploded'; cause: 'hull' | 'fuel'; player?: number }
  /** Co-op: a pod went down (respawns later); fee already charged to the wallet. */
  | { t: 'podDown'; player: number; cause: 'hull' | 'fuel'; fee: number }
  | { t: 'podRespawned'; player: number }
  | { t: 'explosion'; x: number; y: number; radiusTiles: number; item: ItemId }
  | { t: 'gasIgnite'; x: number; y: number }
  | { t: 'teleport'; item: ItemId; player?: number }
  | { t: 'enterBuilding'; id: BuildingId; player?: number }
  /** The pod is standing on a building (id) or has left one (null) — drives the interact prompt. */
  | { t: 'buildingPrompt'; id: BuildingId | null; player?: number }
  | { t: 'transaction'; kind: string; amount: number; player?: number }
  | { t: 'transmission'; id: string }
  | { t: 'bonusCash'; amount: number; player?: number }
  | { t: 'guardianSpawned'; player?: number }
  | { t: 'quake'; rows: number[] }
  | { t: 'blueprintFound'; id: BlueprintId; player?: number }
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
