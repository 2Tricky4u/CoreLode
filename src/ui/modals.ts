import { t } from '@content/strings';
/**
 * Modal system + the five building dialogs, transmissions, pause, game-over.
 * Opening any modal pauses the sim and takes input focus (App wires that).
 */
import {
  BUILDINGS,
  type BuildingId,
  COLLECTIBLES,
  type Command,
  FUEL_BUY_BUTTONS,
  type GameState,
  ITEMS,
  REPAIR_COST_PER_HP,
  SKY_EGGS,
  TRANSMISSIONS,
  UPGRADES,
  UPGRADE_CATEGORIES,
  bayUsed,
  maxHull,
  saleValue,
  tankCapacity,
} from '@core/index';
import { itemKeyLabel } from '@input/InputManager';
import { el } from './reactive';

export class ModalManager {
  private stack: HTMLElement[] = [];
  onOpenChange: ((open: boolean) => void) | null = null;
  /** When set and returning false, keyboard shortcuts are ignored (e.g. a screen is layered on top). */
  keyGuard: (() => boolean) | null = null;

  constructor(private layer: HTMLElement) {
    // Capture phase: must run BEFORE InputManager's window listener, and swallow the
    // event — closing a modal re-enables gameFocus synchronously, so the same keydown
    // would otherwise fall through and re-open the pause menu (Esc) or re-trigger the
    // building interact (Enter).
    window.addEventListener('keydown', (e) => this.onKey(e), true);
  }

  get isOpen(): boolean {
    return this.stack.length > 0;
  }

  /**
   * ESC dismisses (clicks the top dialog's [data-cancel] button, if any);
   * ENTER fires the obvious primary action then closes ("act then close").
   */
  private onKey(e: KeyboardEvent): void {
    if (!this.isOpen || (this.keyGuard && !this.keyGuard())) return;
    if (e.key !== 'Escape' && e.key !== 'Enter') return;
    e.preventDefault();
    e.stopImmediatePropagation(); // the modal owns this key; nothing downstream may see it
    const top = this.stack[this.stack.length - 1];
    if (e.key === 'Escape') {
      top.querySelector<HTMLElement>('[data-cancel]')?.click();
    } else {
      const primary = top.querySelector<HTMLButtonElement>('.btn.primary:not(.disabled)');
      if (!primary) return; // no obvious action (e.g. the outfitter) — do nothing
      primary.click();
      // If the primary didn't already close its own modal, close it now (act-then-close).
      if (this.stack[this.stack.length - 1] === top) this.close();
    }
  }

  open(content: HTMLElement): void {
    const wrap = el('div', { class: 'modal-wrap' }, content);
    this.layer.append(wrap);
    this.stack.push(wrap);
    this.onOpenChange?.(true);
  }

  close(): void {
    this.stack.pop()?.remove();
    if (!this.isOpen) this.onOpenChange?.(false);
  }

  closeAll(): void {
    while (this.isOpen) this.close();
  }
}

const dialog = (title: string, body: HTMLElement, footer: HTMLElement): HTMLElement =>
  el('div', { class: 'dialog' }, el('h2', { class: 'dialog-title', text: title }), body, footer);

const exitBtn = (m: ModalManager, label = t('uiExit')): HTMLElement =>
  el('button', { class: 'btn', 'data-cancel': 'true', onclick: () => m.close() }, label);

export function openBuilding(
  m: ModalManager,
  id: BuildingId,
  s: GameState,
  command: (c: Command) => void,
  onSave: () => void,
): void {
  switch (id) {
    case 'fuel':
      openFuel(m, s, command);
      break;
    case 'processor':
      openSell(m, s, command);
      break;
    case 'outfitter':
      openUpgrades(m, s, command);
      break;
    case 'itemShop':
      openItems(m, s, command);
      break;
    case 'saveStation':
      openSaveStation(m, onSave);
      break;
  }
}

function statusLine(s: GameState): HTMLElement {
  return el('div', {
    class: 'dialog-status',
    text: `$${Math.floor(s.pod.cash).toLocaleString('en-US')}  ·  ${t('hudFuel')} ${s.pod.fuel.toFixed(1)}/${tankCapacity(s.pod)}L  ·  ${t('hudHull')} ${s.pod.hp}/${maxHull(s.pod)}`,
  });
}

function openFuel(m: ModalManager, s: GameState, command: (c: Command) => void): void {
  const body = el(
    'div',
    { class: 'dialog-body' },
    el('p', { text: t('bldFuelBlurb') }),
    statusLine(s),
  );
  const buttons = el('div', { class: 'btn-row' });
  for (const liters of FUEL_BUY_BUTTONS) {
    buttons.append(
      el(
        'button',
        { class: 'btn', onclick: () => refresh(() => command({ c: 'refuel', liters })) },
        `+${liters}L ($${liters})`,
      ),
    );
  }
  buttons.append(
    el(
      'button',
      {
        class: 'btn primary',
        onclick: () => refresh(() => command({ c: 'refuel', liters: 'full' })),
      },
      t('uiFill'),
    ),
  );
  const dlg = dialog(t('bldFuel'), body, el('div', { class: 'btn-row' }, buttons, exitBtn(m)));
  const refresh = (fn: () => void) => {
    fn();
    body.replaceChildren(el('p', { text: t('bldFuelBlurb') }), statusLine(s));
  };
  m.open(dlg);
}

function openSell(m: ModalManager, s: GameState, command: (c: Command) => void): void {
  const body = el('div', { class: 'dialog-body' });
  const render = () => {
    const prevScroll = body.querySelector('.cargo-list')?.scrollTop ?? 0;
    const rows = el('div', { class: 'cargo-list' });
    let total = 0;
    s.pod.bayContents.forEach((n, i) => {
      if (n === 0) return;
      const value = n * saleValue(COLLECTIBLES[i].value, s.level);
      total += value;
      rows.append(
        el(
          'div',
          { class: 'cargo-row' },
          el('span', { text: `${n}× ${t(COLLECTIBLES[i].key)}` }),
          el('span', { text: `$${value.toLocaleString('en-US')}` }),
          el('button', {
            class: 'btn tiny',
            title: t('uiJettisonHint'),
            onclick: () => {
              command({ c: 'jettison', collectibleId: i });
              render();
            },
            text: '✕',
          }),
        ),
      );
    });
    body.replaceChildren(
      el('p', { text: t('bldProcessorBlurb') }),
      bayUsed(s.pod) === 0 ? el('p', { class: 'muted', text: '— hold is empty —' }) : rows,
      el('p', { class: 'total', text: `Total: $${total.toLocaleString('en-US')}` }),
      statusLine(s),
    );
    rows.scrollTop = prevScroll; // re-render must not yank the list back to the top
  };
  render();
  const sellBtn = el(
    'button',
    {
      class: 'btn primary',
      onclick: () => {
        command({ c: 'sellAllCargo' });
        render();
      },
    },
    t('uiSell'),
  );
  m.open(dialog(t('bldProcessor'), body, el('div', { class: 'btn-row' }, sellBtn, exitBtn(m))));
}

function openUpgrades(m: ModalManager, s: GameState, command: (c: Command) => void): void {
  const body = el('div', { class: 'dialog-body' });
  const render = () => {
    const prevScroll = body.querySelector('.upgrade-grid')?.scrollTop ?? 0;
    const grid = el('div', { class: 'upgrade-grid' });
    for (const cat of UPGRADE_CATEGORIES) {
      const tierIdx = s.pod.upgrades[cat];
      const tiers = UPGRADES[cat];
      const next = tiers[tierIdx + 1];
      const row = el(
        'div',
        { class: 'upgrade-row' },
        el('span', { class: 'upgrade-cat', text: cat.toUpperCase() }),
        el('span', { class: 'upgrade-cur', text: t(tiers[tierIdx].key) }),
        next
          ? el('button', {
              class: `btn ${s.pod.cash >= next.price ? '' : 'disabled'}`,
              onclick: () => {
                command({ c: 'buyUpgrade', category: cat });
                render();
              },
              text: `${t(next.key)} — $${next.price.toLocaleString('en-US')}`,
            })
          : el('span', { class: 'muted', text: 'MAX' }),
      );
      grid.append(row);
    }
    body.replaceChildren(el('p', { text: t('bldOutfitterBlurb') }), grid, statusLine(s));
    grid.scrollTop = prevScroll; // re-render must not yank the list back to the top
  };
  render();
  m.open(dialog(t('bldOutfitter'), body, el('div', { class: 'btn-row' }, exitBtn(m))));
}

function openItems(m: ModalManager, s: GameState, command: (c: Command) => void): void {
  const body = el('div', { class: 'dialog-body' });
  const render = () => {
    const prevScroll = body.querySelector('.item-list')?.scrollTop ?? 0;
    const list = el('div', { class: 'item-list' });
    for (const item of ITEMS.filter((i) => i.shopVisible)) {
      // Prices are flat (verbatim from the original) — bulk buttons are pure convenience.
      const buyBtn = (qty: number) =>
        el('button', {
          class: `btn ${qty > 1 ? 'tiny' : ''} ${s.pod.cash >= item.price * qty ? '' : 'disabled'}`,
          title: `$${(item.price * qty).toLocaleString('en-US')}`,
          onclick: () => {
            command({ c: 'buyItem', item: item.id, qty });
            render();
          },
          text: qty === 1 ? t('uiBuy') : `×${qty}`,
        });
      list.append(
        el(
          'div',
          { class: 'item-row' },
          el(
            'div',
            { class: 'item-info' },
            el('strong', {
              text: `${t(item.key)} [${itemKeyLabel(item.id)}] — $${item.price.toLocaleString('en-US')}`,
            }),
            el('small', { text: t(`${item.key}Desc`) }),
            el('small', { class: 'muted', text: `owned: ${s.pod.inventory[item.id] ?? 0}` }),
          ),
          el('div', { class: 'item-buy' }, buyBtn(1), buyBtn(5), buyBtn(10)),
        ),
      );
    }
    const missing = maxHull(s.pod) - s.pod.hp;
    const repairBtn = el('button', {
      class: `btn primary ${missing > 0 ? '' : 'disabled'}`,
      onclick: () => {
        command({ c: 'repair', hp: 'full' });
        render();
      },
      text: `${t('uiRepairFull')} ($${(missing * REPAIR_COST_PER_HP).toLocaleString('en-US')})`,
    });
    body.replaceChildren(el('p', { text: t('bldItemShopBlurb') }), list, repairBtn, statusLine(s));
    list.scrollTop = prevScroll; // re-render must not yank the list back to the top
  };
  render();
  m.open(dialog(t('bldItemShop'), body, el('div', { class: 'btn-row' }, exitBtn(m))));
}

function openSaveStation(m: ModalManager, onSave: () => void): void {
  const body = el('div', { class: 'dialog-body' }, el('p', { text: t('bldSaveBlurb') }));
  const save = el(
    'button',
    {
      class: 'btn primary',
      onclick: () => {
        onSave();
        m.close();
      },
    },
    t('uiSave'),
  );
  m.open(dialog(t('bldSaveStation'), body, el('div', { class: 'btn-row' }, save, exitBtn(m))));
}

export function openTransmission(
  m: ModalManager,
  id: string,
  onClose: () => void,
  onBlip?: () => void,
): void {
  const def = TRANSMISSIONS.find((x) => x.id === id) ?? SKY_EGGS.find((x) => x.id === id);
  if (!def) {
    onClose();
    return;
  }
  const speaker = t(def.speakerKey);
  const text = t(def.textKey);
  const body = el('div', { class: 'dialog-body tx-body' });
  const textNode = el('p', { class: 'tx-text' });
  body.append(
    el('div', { class: `tx-portrait p-${'portrait' in def ? def.portrait : 'static'}` }),
    textNode,
  );
  // typewriter — a soft blip every few glyphs, radio-chatter style
  let i = 0;
  let blipCount = 0;
  const iv = setInterval(() => {
    i += 2;
    textNode.textContent = text.slice(0, i);
    if (++blipCount % 3 === 0) onBlip?.();
    if (i >= text.length) clearInterval(iv);
  }, 16);
  const ok = el(
    'button',
    {
      class: 'btn primary',
      'data-cancel': 'true',
      onclick: () => {
        clearInterval(iv);
        m.close();
        onClose();
      },
    },
    t('uiConfirm'),
  );
  m.open(dialog(`▶ ${speaker}`, body, el('div', { class: 'btn-row' }, ok)));
  const bonus = 'bonus' in def ? def.bonus : 0;
  if (bonus > 0) textNode.dataset.bonus = `+$${bonus}`;
}

export function openPause(
  m: ModalManager,
  onResume: () => void,
  onQuit: () => void,
  onSettings: () => void,
  onHelp: () => void,
): void {
  const body = el('div', { class: 'dialog-body' }, el('p', { text: t('uiPaused') }));
  m.open(
    dialog(
      t('uiPaused'),
      body,
      el(
        'div',
        { class: 'btn-col' },
        el(
          'button',
          {
            class: 'btn primary',
            'data-cancel': 'true',
            onclick: () => {
              m.close();
              onResume();
            },
          },
          t('uiResume'),
        ),
        el('button', { class: 'btn', onclick: onHelp }, 'Controls & Guide'),
        el('button', { class: 'btn', onclick: onSettings }, t('settings')),
        el(
          'button',
          {
            class: 'btn danger',
            onclick: () => {
              m.closeAll();
              onQuit();
            },
          },
          t('uiQuit'),
        ),
      ),
    ),
  );
}

export interface GameOverStats {
  depthFt: number;
  cash: number;
  points: number;
  tilesDug: number;
}

export function openGameOver(
  m: ModalManager,
  cause: 'hull' | 'fuel',
  canLoad: boolean,
  stats: GameOverStats,
  onLoad: () => void,
  onTitle: () => void,
): void {
  const statRow = (label: string, value: string) =>
    el(
      'div',
      { class: 'go-stat' },
      el('span', { class: 'go-stat-label', text: label }),
      el('span', { class: 'go-stat-value', text: value }),
    );
  const body = el(
    'div',
    { class: 'dialog-body go-body' },
    el('div', { class: 'go-title', text: t('gameOverTitle') }),
    el('p', { class: 'go-cause', text: t(cause === 'hull' ? 'gameOverHull' : 'gameOverFuel') }),
    el(
      'div',
      { class: 'go-stats' },
      statRow(t('goDepth'), `${Math.min(0, Math.round(stats.depthFt)).toLocaleString('en-US')} ft`),
      statRow(t('goDug'), stats.tilesDug.toLocaleString('en-US')),
      statRow(t('goCash'), `$${Math.floor(stats.cash).toLocaleString('en-US')}`),
      statRow(t('goScore'), stats.points.toLocaleString('en-US')),
    ),
    el('p', { class: 'go-epitaph', text: t('goEpitaph') }),
  );
  m.open(
    el(
      'div',
      { class: 'dialog game-over' },
      body,
      el(
        'div',
        { class: 'btn-col' },
        canLoad
          ? el(
              'button',
              {
                class: 'btn primary',
                onclick: () => {
                  m.closeAll();
                  onLoad();
                },
              },
              t('loadLastSave'),
            )
          : null,
        el(
          'button',
          {
            class: 'btn',
            onclick: () => {
              m.closeAll();
              onTitle();
            },
          },
          t('backToTitle'),
        ),
      ),
    ),
  );
}

/** Building lookup for titles. */
export const buildingName = (id: BuildingId): string =>
  t(BUILDINGS.find((b) => b.id === id)?.key ?? id);
