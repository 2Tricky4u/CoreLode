/**
 * Merges keyboard + gamepad + touch into one IntentFrame per tick.
 * Item hotkeys are authentic: F reserve fuel, R nano-welders, X dynamite,
 * C plastique, Q discount teleporter, M priority transporter, 0 core teleporter.
 * Central edge detection: useItem fires exactly once per press.
 */
import type { IntentFrame, ItemId } from '@core/index';

const ITEM_KEYS: Record<string, ItemId> = {
  KeyF: 'reserveFuel',
  KeyR: 'nanoWelders',
  KeyX: 'dynamite',
  KeyC: 'plastique',
  KeyQ: 'discountTeleporter',
  KeyM: 'priorityTransporter',
  Digit0: 'coreTeleporter',
};

export class InputManager {
  private keys = new Set<string>();
  private itemQueue: ItemId[] = [];
  private prevPadButtons: boolean[] = [];
  /** Written by TouchControls. */
  readonly touch = { left: false, right: false, up: false, down: false };
  private touchItemQueue: ItemId[] = [];
  /** When false (a modal/screen owns focus), gameplay input is ignored. */
  gameFocus = true;
  onPause: (() => void) | null = null;

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (!this.gameFocus) return;
      if (e.repeat) return this.prevent(e);
      this.keys.add(e.code);
      const item = ITEM_KEYS[e.code];
      if (item) this.itemQueue.push(item);
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPause?.();
      this.prevent(e);
    });
    target.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    target.addEventListener('blur', () => this.clearHeld());
  }

  private prevent(e: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code))
      e.preventDefault();
  }

  clearHeld(): void {
    this.keys.clear();
    this.itemQueue.length = 0;
    this.touch.left = this.touch.right = this.touch.up = this.touch.down = false;
  }

  queueTouchItem(item: ItemId): void {
    this.touchItemQueue.push(item);
  }

  /** Poll gamepad (standard mapping) — call once per host frame. */
  private padState(): {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    item: ItemId | null;
  } {
    const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null;
    const pad = pads?.find((p) => p?.connected);
    if (!pad) return { left: false, right: false, up: false, down: false, item: null };
    const dead = 0.35;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const b = (i: number) => pad.buttons[i]?.pressed ?? false;
    let item: ItemId | null = null;
    // edges on face buttons: A=dynamite? Keep: X(2)=dynamite, Y(3)=plastique, LB=fuel, RB=nano
    const mapping: Array<[number, ItemId]> = [
      [2, 'dynamite'],
      [3, 'plastique'],
      [4, 'reserveFuel'],
      [5, 'nanoWelders'],
    ];
    for (const [btn, it] of mapping) {
      if (b(btn) && !this.prevPadButtons[btn]) item = it;
    }
    if (b(9) && !this.prevPadButtons[9]) this.onPause?.();
    this.prevPadButtons = pad.buttons.map((x) => x.pressed);
    return {
      left: b(14) || ax < -dead,
      right: b(15) || ax > dead,
      up: b(12) || b(0) || ay < -dead,
      down: b(13) || ay > dead,
      item,
    };
  }

  /** One IntentFrame per sim tick. */
  sample(): IntentFrame {
    if (!this.gameFocus) {
      this.itemQueue.length = 0;
      this.touchItemQueue.length = 0;
      return { left: false, right: false, up: false, down: false, useItem: null };
    }
    const pad = this.padState();
    const k = this.keys;
    const useItem = this.itemQueue.shift() ?? this.touchItemQueue.shift() ?? pad.item ?? null;
    return {
      left: k.has('ArrowLeft') || k.has('KeyA') || this.touch.left || pad.left,
      right: k.has('ArrowRight') || k.has('KeyD') || this.touch.right || pad.right,
      up: k.has('ArrowUp') || k.has('KeyW') || this.touch.up || pad.up,
      down: k.has('ArrowDown') || k.has('KeyS') || this.touch.down || pad.down,
      useItem,
    };
  }
}
