import { t } from '@content/strings';
/** HUD: fuel/hull/cargo bars, cash, altimeter (with arena/glitch rules), hotbar. */
import {
  ALTIMETER_ARENA_FT,
  ALTIMETER_ARENA_TEXT,
  ALTIMETER_GLITCH_FT,
  COLLECTIBLES,
  type GameState,
  ITEMS,
  type ItemId,
  type Objective,
  PLAYER_TINTS,
  STRATA_KEYS,
  SURFACE_ROW,
  TRANSMISSIONS,
  Tile,
  WORLD_H,
  WORLD_W,
  bayCapacity,
  bayUsed,
  getTile,
  hasSurveyor,
  isArtifact,
  isBoulder,
  isLava,
  isMineral,
  maxHull,
  podAlive,
  podDepthFt,
  podTileX,
  podTileY,
  stratumIndexAt,
  tankCapacity,
} from '@core/index';
import { interactLabel, itemKeyLabel } from '@input/InputManager';
import { el } from './reactive';

/** Native minimap resolution (CSS upscales it, pixelated). */
const MAP_W = WORLD_W;
const MAP_H = 200;
/** Soil tint per depth band (mirrors GameScene BAND_TINTS). */
const MAP_BANDS = ['#d9a066', '#8f563b', '#663931', '#45283c', '#45283c', '#323c39'];

const cssTint = (tint: number): string => `#${tint.toString(16).padStart(6, '0')}`;

/** One compact teammate row: tint dot, hp/fuel micro-bars, depth or DOWN countdown. */
interface TeamRow {
  node: HTMLElement;
  hp: HTMLElement;
  fuel: HTMLElement;
  info: HTMLElement;
}

/** Human label for a contract/challenge objective. */
const objectiveLabel = (o: Objective): string => {
  switch (o.kind) {
    case 'reachDepthFt':
      return `Reach ${o.ft.toLocaleString('en-US')} ft`;
    case 'collectMineral':
      return `Collect ${o.count} ${t(COLLECTIBLES[o.collectibleId].key)}`;
    case 'haulMassInOneTrip':
      return `Haul ${o.mass} mass in one sale`;
    case 'earnCash':
      return `Earn $${o.amount.toLocaleString('en-US')}`;
    case 'destroyStones':
      return `Destroy ${o.count} boulders`;
    case 'collectNoDamage':
      return `Collect ${o.count} without a scratch`;
    case 'reachExit':
      return 'Reach the exit beacon';
    case 'sellMineral':
      return `Sell ${t(COLLECTIBLES[o.collectibleId].key)}`;
  }
};

export class Hud {
  readonly node: HTMLElement;
  /** "Press [E] to interact" — shown only while standing on a building. */
  readonly promptNode: HTMLElement;
  private promptText: HTMLElement;
  onInteract: (() => void) | null = null;
  private fuelFill: HTMLElement;
  private hullFill: HTMLElement;
  private cargoFill: HTMLElement;
  private heatFill: HTMLElement;
  private heatBar!: HTMLElement;
  private cashText: HTMLElement;
  private depthText: HTMLElement;
  private pointsText: HTMLElement;
  private itemButtons = new Map<ItemId, HTMLElement>();
  onUseItem: ((id: ItemId) => void) | null = null;
  /** Cargo-bar tap / I key — opens the in-field inventory. */
  onInventory: (() => void) | null = null;

  private timerNode: HTMLElement;
  private showTimer = false;
  private chainNode: HTMLElement;
  private contractsNode: HTMLElement;
  private contractsKey = '';
  private objectiveNode: HTMLElement;
  private objectiveKey = '';
  private showObjectives = false;
  private stratumNode: HTMLElement;
  private lastStratum = 0;
  private stratumTimer: ReturnType<typeof setTimeout> | null = null;
  private teamNode: HTMLElement;
  private teamRows: TeamRow[] = [];
  private droppedSeats: ReadonlySet<number> = new Set();
  private waitingNode: HTMLElement;
  private spectateNode: HTMLElement;
  private minimapNode: HTMLElement;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D | null;
  private showMinimap = false;
  private minimapFrame = 0;

  constructor() {
    this.fuelFill = el('div', { class: 'bar-fill fuel' });
    this.hullFill = el('div', { class: 'bar-fill hull' });
    this.cargoFill = el('div', { class: 'bar-fill cargo' });
    this.heatFill = el('div', { class: 'bar-fill heat' });
    this.cashText = el('span', { class: 'hud-cash', text: '$0' });
    this.depthText = el('span', { class: 'hud-depth', text: '0 ft.' });
    this.pointsText = el('span', { class: 'hud-points', text: '' });

    const bar = (label: string, fill: HTMLElement) => {
      const node = el(
        'div',
        { class: 'hud-bar' },
        el('span', { class: 'bar-label', text: label }),
        el('div', { class: 'bar-track' }, fill),
      );
      node.title = label; // text equivalent for assistive tech / hover
      return node;
    };

    const cargoBar = bar(t('hudCargo'), this.cargoFill);
    cargoBar.classList.add('hud-bar-cargo');
    cargoBar.title = `${t('invTitle')} [I]`;
    cargoBar.addEventListener('click', () => this.onInventory?.());

    // Expedition-only pressure gauge — hidden in story/challenge runs.
    this.heatBar = bar(t('hudHeat'), this.heatFill);
    this.heatBar.classList.add('hidden');

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
    this.chainNode = el('span', { class: 'hud-chain hidden', text: '' });
    this.contractsNode = el('div', { class: 'hud-contracts hidden' });
    this.objectiveNode = el('div', { class: 'hud-contracts hidden' });
    this.stratumNode = el('div', { class: 'stratum-banner' });

    this.teamNode = el('div', { class: 'hud-team hidden' });
    this.waitingNode = el('div', { class: 'hud-waiting hidden', text: '' });
    this.spectateNode = el('div', { class: 'hud-spectate hidden', text: '' });

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
      el('span', { class: 'prompt-key', text: interactLabel() }),
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
        this.heatBar,
      ),
      el(
        'div',
        { class: 'hud-mid' },
        this.depthText,
        this.pointsText,
        this.timerNode,
        this.chainNode,
      ),
      el('div', { class: 'hud-right' }, this.cashText, hotbar),
      this.teamNode,
      this.waitingNode,
      this.spectateNode,
      this.minimapNode,
      this.contractsNode,
      this.objectiveNode,
      this.stratumNode,
    );
  }

  /** Story-mode informational objectives (QoL, default off; purist-forced-off). */
  setObjectivesPanel(on: boolean): void {
    this.showObjectives = on;
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

  /** Re-label the hotbar keys after a control-scheme change or rebind. */
  refreshHotkeys(): void {
    for (const [id, btn] of this.itemButtons) {
      const label = itemKeyLabel(id);
      btn.querySelector('.hotbar-key')!.textContent = label;
      btn.title = btn.title.replace(/\[[^\]]*\]$/, `[${label}]`);
    }
    const key = this.promptNode.querySelector('.prompt-key');
    if (key) key.textContent = interactLabel();
  }

  /** Persistent spectator banner (expedition co-op: your pod is gone). */
  setSpectating(text: string | null): void {
    this.spectateNode.classList.toggle('hidden', text === null);
    if (text !== null) this.spectateNode.textContent = text;
  }

  /** Network-stall overlay: pass the message to show, or null to hide. */
  setWaiting(text: string | null): void {
    this.waitingNode.classList.toggle('hidden', text === null);
    if (text !== null) this.waitingNode.textContent = text;
  }

  /** Seats whose peer dropped — badged OFFLINE in the teammate list. */
  setDroppedSeats(seats: ReadonlySet<number>): void {
    this.droppedSeats = seats;
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

  update(s: GameState, localPlayer = 0): void {
    const p = s.pods[localPlayer] ?? s.pod;
    const coop = s.mode.kind === 'coop';
    this.fuelFill.style.width = `${Math.max(0, Math.min(100, (p.fuel / tankCapacity(p)) * 100))}%`;
    this.fuelFill.classList.toggle('warn', p.fuel / tankCapacity(p) < 0.25);
    this.hullFill.style.width = `${Math.max(0, Math.min(100, (p.hp / maxHull(p)) * 100))}%`;
    this.hullFill.classList.toggle('warn', p.hp / maxHull(p) < 0.3);
    const exp = s.mode.kind === 'expedition';
    this.heatBar.classList.toggle('hidden', !exp);
    if (exp) {
      this.heatFill.style.width = `${Math.max(0, Math.min(100, p.heat))}%`;
      this.heatFill.classList.toggle('warn', p.heat >= 70);
    }
    // Story objectives hint (informational only — derived from the story ledger).
    const showObj = this.showObjectives && s.mode.kind === 'story';
    this.objectiveNode.classList.toggle('hidden', !showObj);
    if (showObj) {
      const key = `${s.story.fired.length}:${s.world.slate ? 1 : 0}`;
      if (key !== this.objectiveKey) {
        this.objectiveKey = key;
        const next = TRANSMISSIONS.filter(
          (tx) => typeof tx.trigger === 'number' && !s.story.fired.includes(tx.id),
        ).sort((a, b) => (b.trigger as number) - (a.trigger as number))[0];
        const lines: string[] = [
          next
            ? `${t('objNext')} ${(next.trigger as number).toLocaleString('en-US')} ft`
            : t('objBottom'),
        ];
        if (s.world.slate && !p.blueprints.includes(s.world.slate.blueprint))
          lines.push(t('objRumor'));
        this.objectiveNode.replaceChildren(
          ...lines.map((text) => el('div', { class: 'hud-contract', text })),
        );
      }
    }

    this.contractsNode.classList.toggle('hidden', !exp || s.contracts.length === 0);
    if (exp && s.contracts.length > 0) {
      // Cheap dirty-check: rebuild the list only when done-flags change.
      const key = s.contracts.map((c) => (c.done ? '1' : '0')).join('');
      if (key !== this.contractsKey) {
        this.contractsKey = key;
        this.contractsNode.replaceChildren(
          ...s.contracts.map((c) =>
            el('div', {
              class: `hud-contract${c.done ? ' done' : ''}`,
              text: `${c.done ? '☑' : '☐'} ${objectiveLabel(c.objective)} · $${c.rewardCash.toLocaleString('en-US')}`,
            }),
          ),
        );
      }
    }
    const chain = p.chain;
    const chainVisible = exp && ((chain?.count ?? 0) >= 2 || (chain?.bankPct ?? 0) > 0);
    this.chainNode.classList.toggle('hidden', !chainVisible);
    if (chainVisible && chain) {
      const run = chain.count >= 2 ? `×${chain.count}` : '—';
      this.chainNode.textContent = `CHAIN ${run} · VAULT +${chain.bankPct}%`;
    }
    this.cargoFill.style.width = `${Math.min(100, (bayUsed(p) / bayCapacity(p)) * 100)}%`;
    // Co-op: the wallet is the whole crew's — always pod 0's cash field.
    const cash = Math.floor(s.pod.cash).toLocaleString('en-US');
    this.cashText.textContent = coop ? `$${cash} · ${t('hudShared')}` : `$${cash}`;
    this.updateTeam(s, localPlayer, coop);
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
    // The expedition surveyor module forces it on regardless of the QoL toggle.
    const mapOn = this.showMinimap || (exp && hasSurveyor(p));
    this.minimapNode.classList.toggle('hidden', !mapOn);
    if (mapOn && this.minimapFrame++ % 10 === 0) this.drawMinimap(s, localPlayer);
  }

  /**
   * Depth strip with fog of war: full detail (soil bands + minerals/hazards)
   * only where the pod has been; strata the pod has REACHED show as a faint
   * featureless silhouette (the band's shape unlocks, detail still needs
   * exploration); deeper strata stay pure fog. Gas draws as soil (fidelity).
   */
  /** Compact crew readout — everyone but the local player, in seat order. */
  private updateTeam(s: GameState, localPlayer: number, coop: boolean): void {
    this.teamNode.classList.toggle('hidden', !coop || s.pods.length < 2);
    if (!coop) return;
    const mates = s.pods.map((q, i) => ({ q, i })).filter(({ i }) => i !== localPlayer);
    while (this.teamRows.length < mates.length) {
      const seat = mates[this.teamRows.length].i;
      const hp = el('div', { class: 'team-fill hull' });
      const fuel = el('div', { class: 'team-fill fuel' });
      const info = el('span', { class: 'team-info', text: '' });
      const node = el(
        'div',
        { class: 'team-row' },
        el('span', {
          class: 'team-dot',
          style: `background:${cssTint(PLAYER_TINTS[seat] ?? 0xffffff)}`,
        }),
        el('span', { class: 'team-name', text: `P${seat + 1}` }),
        el(
          'div',
          { class: 'team-bars' },
          el('div', { class: 'team-track' }, hp),
          el('div', { class: 'team-track' }, fuel),
        ),
        info,
      );
      this.teamNode.append(node);
      this.teamRows.push({ node, hp, fuel, info });
    }
    mates.forEach(({ q, i }, r) => {
      const row = this.teamRows[r];
      if (!row) return;
      const down = !podAlive(q);
      const dropped = this.droppedSeats.has(i);
      row.node.classList.toggle('down', down);
      row.node.classList.toggle('dropped', dropped);
      row.hp.style.width = `${Math.max(0, Math.min(100, (q.hp / maxHull(q)) * 100))}%`;
      row.fuel.style.width = `${Math.max(0, Math.min(100, (q.fuel / tankCapacity(q)) * 100))}%`;
      row.info.textContent = dropped
        ? t('hudOffline')
        : down
          ? q.respawnAtTick < 0
            ? t('hudLost') // expedition: permanently out
            : `${t('hudDown')} ${Math.max(0, Math.ceil((q.respawnAtTick - s.tick) / 42))}s`
          : `${Math.min(0, Math.round(podDepthFt(q)))} ft`;
    });
  }

  private drawMinimap(s: GameState, localPlayer = 0): void {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    const reachedStratum = stratumIndexAt(s.story.maxDepthFt);
    for (let cy = 0; cy < MAP_H; cy++) {
      const y = Math.floor((cy / MAP_H) * WORLD_H);
      const band = Math.max(
        0,
        Math.min(5, Math.floor(((y - SURFACE_ROW) / (WORLD_H - SURFACE_ROW)) * 6)),
      );
      const bandReached = y <= SURFACE_ROW || band <= reachedStratum;
      for (let x = 0; x < WORLD_W; x++) {
        if (s.world.discovered[y * WORLD_W + x] !== 1) {
          // Undiscovered: reached strata get a dim uniform silhouette, the
          // rest stays fog (the dark background).
          if (bandReached && y > SURFACE_ROW) {
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = MAP_BANDS[band];
            ctx.fillRect(x, cy, 1, 1);
            ctx.globalAlpha = 1;
          }
          continue;
        }
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
    // Pod markers: teammates as tinted dots, the local pod white with a scanline.
    s.pods.forEach((q, i) => {
      if (i === localPlayer || !podAlive(q)) return;
      const qx = podTileX(q);
      const qy = Math.floor((podTileY(q) / WORLD_H) * MAP_H);
      ctx.fillStyle = cssTint(PLAYER_TINTS[i] ?? 0xffffff);
      ctx.fillRect(Math.max(0, Math.min(WORLD_W - 2, qx - 1)), Math.max(0, qy - 1), 2, 2);
    });
    const lp = s.pods[localPlayer] ?? s.pod;
    const px = podTileX(lp);
    const py = Math.floor((podTileY(lp) / WORLD_H) * MAP_H);
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
