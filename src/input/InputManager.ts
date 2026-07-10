/**
 * Merges keyboard + gamepad + touch into one IntentFrame per tick.
 * Keys resolve through a bind table: a per-scheme preset (classic / vim
 * trainer — see bindings.ts) with user overrides merged on top, so every
 * action is rebindable while the two presets stay one click away.
 * Central edge detection: useItem fires exactly once per press.
 */
import type { IntentFrame, ItemId } from '@core/index';
import {
  type BindOverrides,
  type ControlScheme,
  ITEM_ACTIONS,
  type KeyBinds,
  keyLabel,
  mergeBinds,
} from './bindings';

export type { ControlScheme } from './bindings';

// Module-level view of the active binds so display helpers stay simple imports.
let activeScheme: ControlScheme = 'classic';
let activeBinds: KeyBinds = mergeBinds('classic', {});

export const currentScheme = (): ControlScheme => activeScheme;
export const itemKeyLabel = (id: ItemId): string => keyLabel(activeBinds[id][0] ?? '?');
export const interactLabel = (): string => keyLabel(activeBinds.interact[0] ?? 'KeyE');
/** @deprecated construction-time snapshot; prefer interactLabel(). */
export const INTERACT_LABEL = 'E';

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
  /** Opens the cargo inventory anywhere (rebindable; I in both presets). */
  onInventory: (() => void) | null = null;
  private scheme: ControlScheme = 'classic';
  private overrides: BindOverrides = {};
  private binds: KeyBinds = mergeBinds('classic', {});
  private itemByKey = new Map<string, ItemId>();

  constructor() {
    this.rebuild();
  }

  setScheme(scheme: ControlScheme): void {
    if (scheme === this.scheme) return;
    this.scheme = scheme;
    this.rebuild();
    this.clearHeld(); // a held key must not survive a remap
  }

  /** Apply user overrides (persisted app-side) on top of the scheme preset. */
  setBinds(overrides: BindOverrides): void {
    this.overrides = overrides;
    this.rebuild();
    this.clearHeld();
  }

  get bindTable(): KeyBinds {
    return this.binds;
  }

  private rebuild(): void {
    this.binds = mergeBinds(this.scheme, this.overrides);
    activeScheme = this.scheme;
    activeBinds = this.binds;
    this.itemByKey.clear();
    for (const id of ITEM_ACTIONS) {
      for (const code of this.binds[id]) this.itemByKey.set(code, id);
    }
  }

  private itemFor(e: KeyboardEvent): ItemId | null {
    // Shift-qualified binds win (vim's ⇧G), then the bare code.
    return (
      (e.shiftKey ? this.itemByKey.get(`Shift+${e.code}`) : undefined) ??
      this.itemByKey.get(e.code) ??
      null
    );
  }

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (!this.gameFocus) return;
      if (e.repeat) return this.prevent(e);
      this.keys.add(e.code);
      const item = this.itemFor(e);
      if (item) this.itemQueue.push(item);
      if (this.binds.interact.includes(e.code)) this.interactQueued = true;
      if (this.binds.pause.includes(e.code)) this.onPause?.();
      if (this.binds.inventory.includes(e.code)) this.onInventory?.();
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
    const useItem = this.itemQueue.shift() ?? this.touchItemQueue.shift() ?? pad.item ?? null;
    const interact = this.interactQueued || pad.interact;
    this.interactQueued = false;
    const held = (codes: string[]) => codes.some((c) => this.keys.has(c));
    return {
      left: held(this.binds.left) || this.touch.left || pad.left,
      right: held(this.binds.right) || this.touch.right || pad.right,
      up: held(this.binds.up) || this.touch.up || pad.up,
      down: held(this.binds.down) || this.touch.down || pad.down,
      useItem,
      interact,
    };
  }
}
