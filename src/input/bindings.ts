/**
 * Key bindings: preset tables per control scheme + user overrides on top.
 * Codes are KeyboardEvent.code values; an item bind may carry a 'Shift+'
 * prefix (vim's G). User overrides are stored per action in IndexedDB and
 * merged over the active preset — resetting is just clearing the overrides.
 */
import type { ItemId } from '@core/index';

export type ControlScheme = 'classic' | 'vim';

export const ITEM_ACTIONS: readonly ItemId[] = [
  'reserveFuel',
  'nanoWelders',
  'dynamite',
  'plastique',
  'discountTeleporter',
  'priorityTransporter',
  'coreTeleporter',
];

export type BindAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'interact'
  | 'pause'
  | 'inventory'
  | ItemId;

export const BIND_ACTIONS: readonly BindAction[] = [
  'left',
  'right',
  'up',
  'down',
  'interact',
  'pause',
  'inventory',
  ...ITEM_ACTIONS,
];

export type KeyBinds = Record<BindAction, string[]>;
export type BindOverrides = Partial<Record<BindAction, string[]>>;

export function presetBinds(scheme: ControlScheme): KeyBinds {
  if (scheme === 'vim') {
    return {
      left: ['ArrowLeft', 'KeyH'],
      right: ['ArrowRight', 'KeyL'],
      up: ['ArrowUp', 'KeyK'],
      down: ['ArrowDown', 'KeyJ'],
      interact: ['KeyE', 'Enter', 'Space'],
      pause: ['Escape', 'KeyP'],
      inventory: ['KeyI'],
      reserveFuel: ['KeyF'],
      nanoWelders: ['KeyR'],
      dynamite: ['KeyX'],
      plastique: ['KeyD'],
      discountTeleporter: ['KeyT'],
      priorityTransporter: ['KeyG'],
      coreTeleporter: ['Shift+KeyG'],
    };
  }
  return {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    interact: ['KeyE', 'Enter', 'Space'],
    pause: ['Escape', 'KeyP'],
    inventory: ['KeyI'],
    reserveFuel: ['KeyF'],
    nanoWelders: ['KeyR'],
    dynamite: ['KeyX'],
    plastique: ['KeyC'],
    discountTeleporter: ['KeyQ'],
    priorityTransporter: ['KeyM'],
    coreTeleporter: ['Digit0'],
  };
}

export function mergeBinds(scheme: ControlScheme, overrides: BindOverrides): KeyBinds {
  const merged = { ...presetBinds(scheme) };
  for (const action of BIND_ACTIONS) {
    const o = overrides[action];
    // Presence = override, even when empty (a conflict-steal may unbind an action).
    if (o) merged[action] = [...o];
  }
  return merged;
}

/** Compact display label for a KeyboardEvent.code (or 'Shift+…' compound). */
export function keyLabel(code: string): string {
  const shift = code.startsWith('Shift+');
  const bare = shift ? code.slice(6) : code;
  const map: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
  };
  let label = map[bare];
  if (!label && bare.startsWith('Key')) label = bare.slice(3);
  if (!label && bare.startsWith('Digit')) label = bare.slice(5);
  if (!label) label = bare;
  return shift ? `⇧${label}` : label;
}
