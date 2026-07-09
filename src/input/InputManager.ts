/**
 * Merges keyboard + gamepad + touch into one IntentFrame per tick.
 * Two key schemes (Settings → controls):
 *  - classic (default, authentic): arrows/WASD move; F fuel, R nano-welders,
 *    X dynamite, C plastique, Q discount tp, M priority tp, 0 core tp.
 *  - vim (trainer): h/j/k/l move (WASD disabled so the muscle memory sticks;
 *    arrows stay, as in real vim); items keep vim mnemonics — x (delete char =
 *    small blast), d (delete = big blast), r (replace = repair), f (find =
 *    fuel), t (till = risky teleport), g (gg → top = safe transport to the
 *    surface), G (→ bottom of file = the Core Teleporter).
 * Central edge detection: useItem fires exactly once per press.
 */
import type { IntentFrame, ItemId } from '@core/index';

/** Keys that open the building menu you're standing on. */
export const INTERACT_KEYS = ['KeyE', 'Enter', 'Space'];
export const INTERACT_LABEL = 'E';

export type ControlScheme = 'classic' | 'vim';

const CLASSIC_ITEM_KEYS: Record<string, ItemId> = {
  KeyF: 'reserveFuel',
  KeyR: 'nanoWelders',
  KeyX: 'dynamite',
  KeyC: 'plastique',
  KeyQ: 'discountTeleporter',
  KeyM: 'priorityTransporter',
  Digit0: 'coreTeleporter',
};
/** KeyG is resolved separately: g = priority transporter, G (shift) = core teleporter. */
const VIM_ITEM_KEYS: Record<string, ItemId> = {
  KeyF: 'reserveFuel',
  KeyR: 'nanoWelders',
  KeyX: 'dynamite',
  KeyD: 'plastique',
  KeyT: 'discountTeleporter',
};

/** Display labels per scheme (HUD hotbar, shop rows, help screen). */
const ITEM_LABELS: Record<ControlScheme, Record<ItemId, string>> = {
  classic: {
    reserveFuel: 'F',
    nanoWelders: 'R',
    dynamite: 'X',
    plastique: 'C',
    discountTeleporter: 'Q',
    priorityTransporter: 'M',
    coreTeleporter: '0',
  },
  vim: {
    reserveFuel: 'f',
    nanoWelders: 'r',
    dynamite: 'x',
    plastique: 'd',
    discountTeleporter: 't',
    priorityTransporter: 'g',
    coreTeleporter: 'G',
  },
};

let activeScheme: ControlScheme = 'classic';
export const currentScheme = (): ControlScheme => activeScheme;
export const itemKeyLabel = (id: ItemId): string => ITEM_LABELS[activeScheme][id];

export class InputManager {
  private keys = new Set<string>();
  private itemQueue: ItemId[] = [];
  private prevPadButtons: boolean[] = [];
  /** Written by TouchControls. */
  readonly touch = { left: false, right: false, up: false, down: false };
  private touchItemQueue: ItemId[] = [];
  /** Edge-triggered interact ("press E to interact"), consumed by the next sample(). */
  private interactQueued = false;
  /** When false (a modal/screen owns focus), gameplay input is ignored. */
  gameFocus = true;
  onPause: (() => void) | null = null;
  private scheme: ControlScheme = 'classic';

  setScheme(scheme: ControlScheme): void {
    if (scheme === this.scheme) return;
    this.scheme = scheme;
    activeScheme = scheme;
    this.clearHeld(); // a held key must not survive a remap
  }

  private itemFor(e: KeyboardEvent): ItemId | null {
    if (this.scheme === 'vim') {
      if (e.code === 'KeyG') return e.shiftKey ? 'coreTeleporter' : 'priorityTransporter';
      return VIM_ITEM_KEYS[e.code] ?? null;
    }
    return CLASSIC_ITEM_KEYS[e.code] ?? null;
  }

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (!this.gameFocus) return;
      if (e.repeat) return this.prevent(e);
      this.keys.add(e.code);
      const item = this.itemFor(e);
      if (item) this.itemQueue.push(item);
      if (INTERACT_KEYS.includes(e.code)) this.interactQueued = true;
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
    this.interactQueued = false;
    this.touch.left = this.touch.right = this.touch.up = this.touch.down = false;
  }

  queueTouchItem(item: ItemId): void {
    this.touchItemQueue.push(item);
  }

  /** Touch/UI-driven interact press. */
  queueInteract(): void {
    this.interactQueued = true;
  }

  /** Poll gamepad (standard mapping) — call once per host frame. */
  private padState(): {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    item: ItemId | null;
    interact: boolean;
  } {
    const pads = typeof navigator !== 'undefined' ? navigator.getGamepads?.() : null;
    const pad = pads?.find((p) => p?.connected);
    if (!pad)
      return { left: false, right: false, up: false, down: false, item: null, interact: false };
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
    const interact = b(1) && !this.prevPadButtons[1]; // B = interact
    this.prevPadButtons = pad.buttons.map((x) => x.pressed);
    return {
      left: b(14) || ax < -dead,
      right: b(15) || ax > dead,
      up: b(12) || b(0) || ay < -dead, // A also thrusts
      down: b(13) || ay > dead,
      item,
      interact,
    };
  }

  /** One IntentFrame per sim tick. */
  sample(): IntentFrame {
    if (!this.gameFocus) {
      this.itemQueue.length = 0;
      this.touchItemQueue.length = 0;
      this.interactQueued = false;
      return { left: false, right: false, up: false, down: false, useItem: null, interact: false };
    }
    const pad = this.padState();
    const k = this.keys;
    const useItem = this.itemQueue.shift() ?? this.touchItemQueue.shift() ?? pad.item ?? null;
    const interact = this.interactQueued || pad.interact;
    this.interactQueued = false;
    // vim: hjkl replace WASD entirely (training wheels off); arrows remain, as in real vim.
    const vim = this.scheme === 'vim';
    return {
      left: k.has('ArrowLeft') || k.has(vim ? 'KeyH' : 'KeyA') || this.touch.left || pad.left,
      right: k.has('ArrowRight') || k.has(vim ? 'KeyL' : 'KeyD') || this.touch.right || pad.right,
      up: k.has('ArrowUp') || k.has(vim ? 'KeyK' : 'KeyW') || this.touch.up || pad.up,
      down: k.has('ArrowDown') || k.has(vim ? 'KeyJ' : 'KeyS') || this.touch.down || pad.down,
      useItem,
      interact,
    };
  }
}
