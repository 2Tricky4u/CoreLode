/** Per-tick player input, produced by the input layer, consumed by the sim. */
import type { ItemId } from './data/items';

export interface IntentFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** Edge-triggered: at most one item activation per tick. */
  useItem: ItemId | null;
  /** Edge-triggered: open the building menu the pod is standing on. */
  interact: boolean;
}

export const EMPTY_INTENTS: Readonly<IntentFrame> = {
  left: false,
  right: false,
  up: false,
  down: false,
  useItem: null,
  interact: false,
};
