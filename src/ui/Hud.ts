import { t } from '@content/strings';
/** HUD: fuel/hull/cargo bars, cash, altimeter (with arena/glitch rules), hotbar. */
import {
  ALTIMETER_ARENA_FT,
  ALTIMETER_ARENA_TEXT,
  ALTIMETER_GLITCH_FT,
  type GameState,
  ITEMS,
  type ItemId,
  STRATA_KEYS,
  SURFACE_ROW,
  Tile,
  WORLD_H,
  WORLD_W,
  bayCapacity,
  bayUsed,
  getTile,
  isArtifact,
  isBoulder,
  isLava,
  isMineral,
  maxHull,
  podDepthFt,
  podTileX,
  podTileY,
  stratumIndexAt,
  tankCapacity,
} from '@core/index';
import { INTERACT_LABEL, itemKeyLabel } from '@input/InputManager';
import { el } from './reactive';

/** Native minimap resolution (CSS upscales it, pixelated). */
const MAP_W = WORLD_W;
const MAP_H = 200;
/** Soil tint per depth band (mirrors GameScene BAND_TINTS). */
const MAP_BANDS = ['#d9a066', '#8f563b', '#663931', '#45283c', '#45283c', '#323c39'];

export class Hud {
  readonly node: HTMLElement;
  /** "Press [E] to interact" — shown only while standing on a building. */
  readonly promptNode: HTMLElement;
  private promptText: HTMLElement;
  onInteract: (() => void) | null = null;
  private fuelFill: HTMLElement;
  private hullFill: HTMLElement;
  private cargoFill: HTMLElement;
  private cashText: HTMLElement;
  private depthText: HTMLElement;
  private pointsText: HTMLElement;
  private itemButtons = new Map<ItemId, HTMLElement>();
  onUseItem: ((id: ItemId) => void) | null = null;
  /** Cargo-bar tap / I key — opens the in-field inventory. */
  onInventory: (() => void) | null = null;

  private timerNode: HTMLElement;
  private showTimer = false;
  private stratumNode: HTMLElement;
  private lastStratum = 0;
  private stratumTimer: ReturnType<typeof setTimeout> | null = null;
  private minimapNode: HTMLElement;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D | null;
  private showMinimap = false;
  private minimapFrame = 0;

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

    const cargoBar = bar(t('hudCargo'), this.cargoFill);
    cargoBar.classList.add('hud-bar-cargo');
    cargoBar.title = `${t('invTitle')} [I]`;
    cargoBar.addEventListener('click', () => this.onInventory?.());

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

    this.timerNode = el('span', { class: 'hud-timer hidden', text: '00:00.00' });
    this.stratumNode = el('div', { class: 'stratum-banner' });

    this.minimapCanvas = el('canvas', { class: 'minimap-canvas' });
    this.minimapCanvas.width = MAP_W;
    this.minimapCanvas.height = MAP_H;
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.minimapNode = el('div', { class: 'hud-minimap hidden' }, this.minimapCanvas);

    this.promptText = el('span', { class: 'prompt-text', text: '' });
    this.promptNode = el(
      'button',
      {
        class: 'interact-prompt hidden',
        onclick: () => this.onInteract?.(),
      },
      el('span', { class: 'prompt-key', text: INTERACT_LABEL }),
      this.promptText,
    );

    this.node = el(
      'div',
      { class: 'hud' },
      el(
        'div',
        { class: 'hud-left' },
        bar(t('hudFuel'), this.fuelFill),
        bar(t('hudHull'), this.hullFill),
        cargoBar,
      ),
      el('div', { class: 'hud-mid' }, this.depthText, this.pointsText, this.timerNode),
      el('div', { class: 'hud-right' }, this.cashText, hotbar),
      this.minimapNode,
      this.stratumNode,
    );
  }

  /** Fade the band name in center-screen when the pod crosses into a new stratum. */
  private announceStratum(idx: number): void {
    this.stratumNode.textContent = t(STRATA_KEYS[idx]);
    this.stratumNode.classList.add('show');
    if (this.stratumTimer) clearTimeout(this.stratumTimer);
    this.stratumTimer = setTimeout(() => this.stratumNode.classList.remove('show'), 2600);
  }

  setSpeedrunTimer(on: boolean): void {
    this.showTimer = on;
    this.timerNode.classList.toggle('hidden', !on);
  }

  /** Re-label the hotbar keys after a control-scheme change. */
  refreshHotkeys(): void {
    for (const [id, btn] of this.itemButtons) {
      const label = itemKeyLabel(id);
      btn.querySelector('.hotbar-key')!.textContent = label;
      btn.title = btn.title.replace(/\[[^\]]*\]$/, `[${label}]`);
    }
  }

  setMinimap(on: boolean): void {
    this.showMinimap = on;
    this.minimapNode.classList.toggle('hidden', !on);
  }

  /** `null` hides the prompt; a building name shows "[E] Enter <name>". */
  setPrompt(buildingName: string | null): void {
    if (buildingName) {
      this.promptText.textContent = `Enter ${buildingName}`;
      this.promptNode.classList.remove('hidden');
    } else {
      this.promptNode.classList.add('hidden');
    }
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
      // Slipstream Engine schematic makes surface recall free — show ∞, never "empty".
      const free = id === 'priorityTransporter' && p.blueprints.includes('slipstreamEngine');
      btn.querySelector('.hotbar-count')!.textContent = free ? '∞' : String(count);
      btn.classList.toggle('empty', !free && count === 0);
    }

    const stratum = stratumIndexAt(depth);
    if (stratum !== this.lastStratum) {
      this.lastStratum = stratum;
      if (stratum > 0) this.announceStratum(stratum); // resurfacing to Topsoil stays quiet
    }

    if (this.showTimer) this.timerNode.textContent = formatTime(s.tick);
    // Minimap redraws at ~6 Hz — the world changes slowly, a full redraw each frame is wasteful.
    if (this.showMinimap && this.minimapFrame++ % 10 === 0) this.drawMinimap(s);
  }

  /** Depth strip: soil bands + minerals/hazards + the pod's position. Gas draws as soil (fidelity). */
  private drawMinimap(s: GameState): void {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    for (let cy = 0; cy < MAP_H; cy++) {
      const y = Math.floor((cy / MAP_H) * WORLD_H);
      const band = Math.max(
        0,
        Math.min(5, Math.floor(((y - SURFACE_ROW) / (WORLD_H - SURFACE_ROW)) * 6)),
      );
      for (let x = 0; x < WORLD_W; x++) {
        const t = getTile(s.world, x, y);
        if (t === Tile.Air) continue; // leave tunnels as the dark background
        let color: string;
        if (isMineral(t) || isArtifact(t)) color = '#fbf236';
        else if (isLava(t)) color = '#d95763';
        else if (isBoulder(t)) color = '#6c6c6c';
        else color = MAP_BANDS[band]; // dirt, gas, turf, barrier, bedrock — all soil-colored
        ctx.fillStyle = color;
        ctx.fillRect(x, cy, 1, 1);
      }
    }
    // Pod marker.
    const px = podTileX(s.pod);
    const py = Math.floor((podTileY(s.pod) / WORLD_H) * MAP_H);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, py, MAP_W, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.max(0, Math.min(WORLD_W - 2, px - 1)), Math.max(0, py - 1), 3, 3);
  }
}

/** Ticks (42 Hz) → mm:ss.cs. */
function formatTime(ticks: number): string {
  const totalCs = Math.floor((ticks / 42) * 100);
  const cs = totalCs % 100;
  const totalS = Math.floor(totalCs / 100);
  const ss = totalS % 60;
  const mm = Math.floor(totalS / 60);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${p2(mm)}:${p2(ss)}.${p2(cs)}`;
}
