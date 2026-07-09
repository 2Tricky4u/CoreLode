import { t } from '@content/strings';
/** HUD: fuel/hull/cargo bars, cash, altimeter (with arena/glitch rules), hotbar. */
import {
  ALTIMETER_ARENA_FT,
  ALTIMETER_ARENA_TEXT,
  ALTIMETER_GLITCH_FT,
  type GameState,
  ITEMS,
  type ItemId,
  bayCapacity,
  bayUsed,
  maxHull,
  podDepthFt,
  tankCapacity,
} from '@core/index';
import { el } from './reactive';

export class Hud {
  readonly node: HTMLElement;
  private fuelFill: HTMLElement;
  private hullFill: HTMLElement;
  private cargoFill: HTMLElement;
  private cashText: HTMLElement;
  private depthText: HTMLElement;
  private pointsText: HTMLElement;
  private itemButtons = new Map<ItemId, HTMLElement>();
  onUseItem: ((id: ItemId) => void) | null = null;

  constructor() {
    this.fuelFill = el('div', { class: 'bar-fill fuel' });
    this.hullFill = el('div', { class: 'bar-fill hull' });
    this.cargoFill = el('div', { class: 'bar-fill cargo' });
    this.cashText = el('span', { class: 'hud-cash', text: '$0' });
    this.depthText = el('span', { class: 'hud-depth', text: '0 ft.' });
    this.pointsText = el('span', { class: 'hud-points', text: '' });

    const bar = (label: string, fill: HTMLElement) =>
      el(
        'div',
        { class: 'hud-bar' },
        el('span', { class: 'bar-label', text: label }),
        el('div', { class: 'bar-track' }, fill),
      );

    const hotbar = el('div', { class: 'hotbar' });
    for (const item of ITEMS.filter((i) => i.shopVisible)) {
      const btn = el(
        'button',
        {
          class: 'hotbar-btn',
          title: `${t(item.key)} [${item.hotkey}]`,
          onclick: () => this.onUseItem?.(item.id),
        },
        el('span', { class: 'hotbar-key', text: item.hotkey }),
        el('span', { class: 'hotbar-count', text: '0' }),
      );
      this.itemButtons.set(item.id, btn);
      hotbar.append(btn);
    }

    this.node = el(
      'div',
      { class: 'hud' },
      el(
        'div',
        { class: 'hud-left' },
        bar(t('hudFuel'), this.fuelFill),
        bar(t('hudHull'), this.hullFill),
        bar(t('hudCargo'), this.cargoFill),
      ),
      el('div', { class: 'hud-mid' }, this.depthText, this.pointsText),
      el('div', { class: 'hud-right' }, this.cashText, hotbar),
    );
  }

  update(s: GameState): void {
    const p = s.pod;
    this.fuelFill.style.width = `${Math.max(0, Math.min(100, (p.fuel / tankCapacity(p)) * 100))}%`;
    this.fuelFill.classList.toggle('warn', p.fuel / tankCapacity(p) < 0.25);
    this.hullFill.style.width = `${Math.max(0, Math.min(100, (p.hp / maxHull(p)) * 100))}%`;
    this.hullFill.classList.toggle('warn', p.hp / maxHull(p) < 0.3);
    this.cargoFill.style.width = `${Math.min(100, (bayUsed(p) / bayCapacity(p)) * 100)}%`;
    this.cashText.textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
    this.pointsText.textContent = `${t('uiScore')} ${p.points.toLocaleString('en-US')}`;

    // Altimeter — authentic display rules.
    const depth = podDepthFt(p);
    let text: string;
    if (depth <= ALTIMETER_ARENA_FT) text = `${ALTIMETER_ARENA_TEXT} ft.`;
    else if (depth <= ALTIMETER_GLITCH_FT)
      text = `?${10000 + Math.floor(Math.random() * 90000)} ft.`;
    else text = `${Math.min(0, Math.round(depth))} ft.`;
    this.depthText.textContent = text;

    for (const [id, btn] of this.itemButtons) {
      const count = p.inventory[id] ?? 0;
      btn.querySelector('.hotbar-count')!.textContent = String(count);
      btn.classList.toggle('empty', count === 0);
    }
  }
}
