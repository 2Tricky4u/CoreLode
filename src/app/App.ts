import { t } from '@content/strings';
import {
  BLUEPRINTS,
  BUILDINGS,
  type BuildingId,
  CHALLENGES,
  EMPTY_INTENTS,
  type GameState,
  ITEMS,
  LOADOUTS,
  type LoadoutId,
  MODULES,
  MODULE_SLOTS,
  type ModuleId,
  PROTO_VERSION,
  RELICS,
  SAVE_VERSION,
  SURFACE_ROW,
  type SaveFile,
  type SettingsValues,
  type SimEvent,
  TILE_PX,
  Tile,
  UPGRADES,
  UPGRADE_CATEGORIES,
  WORLD_H,
  WORLD_W,
  coresEarned,
  createRun,
  dailyKey,
  dailySeed,
  decodeDailyResult,
  decodeMsg,
  decodeSave,
  defaultSettings,
  deserialize,
  effectiveSettings,
  encodeDailyResult,
  encodeMsg,
  encodeSave,
  getTile,
  maxHull,
  podDepthFt,
  podTileX,
  podTileY,
  serialize,
  setTile,
  tankCapacity,
} from '@core/index';
import { migrateAndValidate } from '@core/save/migrate';
import { GameHost, type SimHost } from '@game/GameHost';
import { LockstepHost } from '@game/LockstepHost';
import { AudioBus } from '@game/audio/AudioBus';
import { createPhaserGame } from '@game/phaserGame';
import type { GameScene } from '@game/scenes/GameScene';
import { InputManager } from '@input/InputManager';
import { BIND_ACTIONS, type BindAction } from '@input/bindings';
import { entropySeed, isTouchDevice } from '@platform/env';
import { copyToClipboard, downloadText, pickTextFile } from '@platform/exporter';
import { LocalChannel } from '@platform/net/LocalChannel';
import { RtcChannel } from '@platform/net/RtcChannel';
import { ChunkAssembler, type NetChannel, chunkSplit } from '@platform/net/channel';
import * as storage from '@platform/storage';
import { Hud } from '@ui/Hud';
import { TouchControls } from '@ui/TouchControls';
import { UiRoot } from '@ui/UiRoot';
import { coopScreen } from '@ui/coopScreen';
import { openDevPanel } from '@ui/devPanel';
import { showFatal } from '@ui/fatal';
import { helpScreen } from '@ui/help';
import {
  ModalManager,
  openBuilding,
  openChoice,
  openGameOver,
  openInventory,
  openMessage,
  openPause,
  openRelicChoice,
  openTransmission,
} from '@ui/modals';
import {
  ScreenHost,
  challengeScreen,
  endingScreen,
  expeditionScreen,
  saveSlotsScreen,
  settingsScreen,
  titleScreen,
} from '@ui/screens';
/**
 * Top-level orchestrator: title ↔ run ↔ ending flow, save/load, settings,
 * modal/pause coordination, NG+ loop, challenge records.
 */
import type Phaser from 'phaser';

export class App {
  private phaser!: Phaser.Game;
  private ui = new UiRoot();
  private hud = new Hud();
  private modals = new ModalManager(this.ui.modalLayer);
  private screens = new ScreenHost(this.ui.screenLayer);
  private input = new InputManager();
  private audio = new AudioBus();
  private touch: TouchControls;
  private host: SimHost | null = null;
  /** Live lockstep session (null in solo) — for stall/drop lifecycle UX. */
  private lockstep: LockstepHost | null = null;
  private coopDropped = new Set<number>();
  /** A loaded co-op SaveFile waiting in the host lobby for the crew to reconnect. */
  private coopPendingSave: SaveFile | null = null;
  private coopByeOnUnload = (): void => this.lockstep?.shutdown();
  private settings: SettingsValues = defaultSettings();
  private lifetime: storage.LifetimeRecords = storage.defaultLifetime();
  private binds: storage.StoredBinds = {};
  private lastManualSlot = 'manual:0';
  /** This client's seat in a co-op session (0 in solo and for the host). */
  private localPlayer = 0;
  /** Hidden dev mode: type DEV_SEQUENCE on the title screen to toggle. */
  private static readonly DEV_SEQUENCE = 'digdeep'; // ← change this to your own secret
  private devMode = false;
  private devGod = false;
  private devXray = false;
  private devBuffer = '';
  private hudTimer = 0;

  private saveLifetime(): void {
    void storage.writeLifetime(this.lifetime);
  }

  constructor() {
    this.touch = new TouchControls(this.input, 'right');
    this.ui.hudLayer.append(this.hud.node, this.hud.promptNode, this.touch.node);
    this.hud.node.style.display = 'none';
    this.hud.setPrompt(null);
    this.touch.setVisible(false);
    this.hud.onUseItem = (id) => this.input.queueTouchItem(id);
    this.hud.onInteract = () => this.input.queueInteract();
    this.input.attach(window);
    this.input.onPause = () => this.togglePause();
    this.input.onInventory = () => this.openInventoryModal();
    this.hud.onInventory = () => this.openInventoryModal();
    this.audio.attachUnlock();

    // Modal keyboard shortcuts (ESC/ENTER) are ignored while a screen is layered on top.
    this.modals.keyGuard = () => !this.screens.visible;

    this.modals.onOpenChange = (open) => {
      this.input.gameFocus = !open && !this.screens.visible;
      if (this.host) (open ? this.host.pause : this.host.resume).call(this.host, 'modal');
      if (open) this.input.clearHeld();
      // Co-op: leaving the pause menu lifts the synchronized pause for everyone.
      if (!open && this.host?.state.mode.kind === 'coop' && this.host.pausedBy.has('user'))
        this.host.resume('user');
      this.audio.duck(open); // music sits under shops/transmissions
    };

    // Every button click clicks.
    this.ui.root.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement | null;
      if (el?.closest('.btn, .hotbar-btn, .interact-prompt')) this.audio.play('uiClick', 0.5);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.host?.pause('hidden');
      else this.host?.resume('hidden');
      this.audio.setPaused(document.hidden);
    });

    // Hidden dev-mode unlock: type the secret sequence while on the menus
    // (no run active); once on, ` (backquote) opens the dev panel in a run.
    window.addEventListener('keydown', (e) => {
      if (this.devMode && e.code === 'Backquote') {
        if (this.host && !this.modals.isOpen) this.showDevPanel();
        return;
      }
      if (!this.screens.visible || this.host) return;
      const ch = e.key.length === 1 ? e.key.toLowerCase() : '';
      if (!ch) return;
      this.devBuffer = (this.devBuffer + ch).slice(-App.DEV_SEQUENCE.length);
      if (this.devBuffer !== App.DEV_SEQUENCE) return;
      this.devBuffer = '';
      this.devMode = !this.devMode;
      if (!this.devMode) {
        // No run is active here (the sequence only registers on the menus),
        // so clearing the flags is enough — the next run starts clean.
        this.devGod = false;
        this.devXray = false;
        this.applySettings();
      }
      this.ui.toast(this.devMode ? 'DEV MODE ON — press ` during a run' : 'Dev mode off', 3500);
    });
  }

  async start(): Promise<void> {
    // Boot Phaser FIRST so the canvas appears immediately — storage reads below
    // are time-bounded but must never gate the first paint.
    this.phaser = createPhaserGame('game');

    // Escape hatch: append ?reset (or ?safe) to the URL to wipe corrupt saved data on boot.
    const params = new URLSearchParams(location.search);
    if (params.has('reset') || params.has('safe')) {
      await storage.clearAllData();
      this.ui.toast('Saved data cleared.');
    }

    this.settings = { ...defaultSettings(), ...((await storage.readSettings()) ?? {}) };
    this.lifetime = await storage.readLifetime();
    this.binds = await storage.readBinds();
    this.input.setBinds(this.binds);
    void storage.requestPersistence();

    // Wait for assets, but never hang forever — fall through to the title after 10s.
    await new Promise<void>((res) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        res();
      };
      this.phaser.events.once('assets-ready', finish);
      setTimeout(finish, 10_000);
    });

    this.ui.syncScale();

    // Dev/test entry: same-machine co-op tabs (?coop=host|join&room=X&seat=N&players=M).
    if (params.has('coop')) {
      await this.startLocalCoop(params);
      return;
    }

    await this.showTitle();
  }

  private get fx(): SettingsValues {
    return effectiveSettings(this.settings);
  }

  // ---------- screens ----------
  private async showTitle(): Promise<void> {
    this.stopRun();
    this.audio.playMusic('title');
    const slots = await storage.listSaves();
    this.input.gameFocus = false;
    this.screens.show(
      titleScreen({
        canContinue: slots.length > 0,
        continueMeta:
          slots.length > 0 ? slots.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)) : null,
        lifetime: this.lifetime,
        onNew: () => this.newStoryRun(),
        onContinue: () => void this.loadMostRecent(),
        onExpedition: () => void this.showExpedition(),
        onCoop: () => this.showCoop(),
        onLoad: () => void this.showSaveSlots(),
        onChallenges: () => void this.showChallenges(),
        onSettings: () => this.showSettings(() => this.showTitle()),
        onHelp: () => this.screens.show(helpScreen(() => void this.showTitle())),
      }),
    );
  }

  private async showSaveSlots(): Promise<void> {
    const slots = await storage.listSaves();
    this.screens.show(
      saveSlotsScreen({
        slots,
        onLoad: (key) => void this.loadSlot(key),
        onDelete: async (key) => {
          await storage.deleteSave(key);
          void this.showSaveSlots();
        },
        onExport: async (key) => {
          const raw = await storage.readSave(key);
          if (!raw) return;
          const code = encodeSave(migrateAndValidate(raw));
          downloadText(`corelode-${key.replace(':', '-')}.txt`, code);
          if (await copyToClipboard(code)) this.ui.toast('Save code copied to clipboard');
        },
        onImport: async () => {
          const text = await pickTextFile();
          if (!text) return;
          try {
            const save = decodeSave(text);
            await storage.writeSave('manual:2', save);
            this.ui.toast('Imported into manual:2');
            void this.showSaveSlots();
          } catch (err) {
            this.ui.toast(`Import failed: ${(err as Error).message}`);
          }
        },
        onBack: () => this.showTitle(),
      }),
    );
  }

  private showSettings(back: () => void): void {
    this.screens.show(
      settingsScreen({
        values: this.settings,
        onChange: (id, v) => {
          this.settings[id] = v;
          void storage.writeSettings(this.settings);
          this.applySettings();
        },
        onBack: back,
        bindTable: this.input.bindTable,
        onRebind: (action, code) => {
          this.rebindKey(action, code);
          this.showSettings(back); // re-render with the new table
        },
        onResetBinds: () => {
          this.binds = {};
          void storage.writeBinds(this.binds);
          this.input.setBinds(this.binds);
          this.hud.refreshHotkeys();
          this.showSettings(back);
        },
      }),
    );
  }

  /** Assign a key to an action; a conflicting key is stolen from its old action. */
  private rebindKey(action: BindAction, code: string): void {
    for (const other of BIND_ACTIONS) {
      if (other === action) continue;
      const eff = this.input.bindTable[other];
      if (eff.includes(code) || eff.includes(`Shift+${code}`))
        this.binds[other] = eff.filter((c) => c !== code && c !== `Shift+${code}`);
    }
    this.binds[action] = [code];
    void storage.writeBinds(this.binds);
    this.input.setBinds(this.binds);
    this.hud.refreshHotkeys();
  }

  private async showChallenges(): Promise<void> {
    const records = await storage.readRecords();
    this.screens.show(
      challengeScreen({
        records,
        onPlay: (id) => this.newChallengeRun(id),
        onBack: () => this.showTitle(),
      }),
    );
  }

  private applySettings(): void {
    const fx = this.fx;
    this.audio.sfxVolume = Number(fx.sfxVol);
    this.audio.musicVolume = Number(fx.musicVol);
    this.audio.ambience.setEnabled(fx.fxDensity !== 'reduced');
    const touchMode = String(fx.touchControls);
    this.touch.setVisible(
      this.host !== null && (touchMode === 'on' || (touchMode === 'auto' && isTouchDevice())),
    );
    this.touch.setLayout(String(fx.touchLayout) === 'left' ? 'left' : 'right');
    const tSize = String(fx.touchSize);
    this.touch.setSize(tSize === 'small' || tSize === 'large' ? tSize : 'medium');
    this.input.setScheme(String(fx.controlScheme) === 'vim' ? 'vim' : 'classic');

    // HUD-side QoL (independent of the Phaser scene).
    this.hud.setSpeedrunTimer(Boolean(fx.speedrunTimer));
    this.hud.setMinimap(Boolean(fx.minimap) || this.devXray);
    this.hud.setObjectivesPanel(Boolean(fx.objectivesPanel));
    this.hud.refreshHotkeys(); // hotbar labels follow the key scheme

    // Push live FX into the running play field (if any).
    const scene = this.phaser?.scene?.isActive('game')
      ? (this.phaser.scene.getScene('game') as GameScene | null)
      : null;
    scene?.applyFx({
      screenShake: Boolean(fx.screenShake),
      gasHint: Boolean(fx.gasShimmerHint) || this.devXray,
      fxFull: fx.fxDensity !== 'reduced',
      damageFlash: Boolean(fx.damageFlash),
      pixelPerfect: Boolean(fx.pixelPerfect),
      oreGlyphs: Boolean(fx.oreGlyphs) || this.devXray,
      ambientLife: Boolean(fx.ambientLife),
    });
  }

  // ---------- run lifecycle ----------
  private newStoryRun(): void {
    const seed = this.fx.seededRuns ? this.promptSeed() : entropySeed();
    // Assists are frozen into the run at creation: mid-run settings flips never
    // change an in-flight run, and a save always replays identically.
    const assists = { fuelFailsafe: Boolean(this.fx.fuelFailsafe) };
    this.beginRun(createRun({ seed, mode: { kind: 'story', goldium: true, assists } }));
  }

  private promptSeed(): number {
    const raw = window.prompt('World seed (number):', String(Math.floor(Math.random() * 1e9)));
    const n = Number(raw);
    return Number.isFinite(n) ? n >>> 0 : entropySeed();
  }

  private newChallengeRun(id: string): void {
    this.beginRun(createRun({ mode: { kind: 'challenge', challengeId: id, goldium: true } }));
  }

  // ---------- expedition (roguelike) ----------
  private async showExpedition(): Promise<void> {
    const profile = await storage.readExpeditionProfile();
    const suspend = await storage.readSave('exp:0');
    const today = dailyKey(new Date());
    const daily = (await storage.readDaily())[today];
    this.screens.show(
      expeditionScreen({
        profile,
        hasSuspend: Boolean(suspend),
        dailyBest: daily
          ? `${Math.round(daily.bestDepthFt).toLocaleString('en-US')} ft · $${daily.bestCash.toLocaleString('en-US')} · ${daily.attempts}×`
          : null,
        onStart: () => void this.newExpeditionRun(false),
        onDaily: () => void this.newExpeditionRun(true),
        onCopyResult: () => void this.copyDailyResult(),
        onPasteResult: () => void this.compareDailyResult(),
        onResume: () => void this.resumeExpedition(),
        onBack: () => void this.showTitle(),
        onPickLoadout: (id) => void this.pickLoadout(id),
        onToggleModule: (id) => void this.toggleModule(id),
      }),
    );
  }

  private async newExpeditionRun(daily: boolean): Promise<void> {
    const profile = await storage.readExpeditionProfile();
    const dateKey = daily ? dailyKey(new Date()) : undefined;
    this.beginRun(
      createRun({
        // Daily: everyone digs the same UTC-dated earth on a standard rig.
        seed: dateKey ? dailySeed(dateKey) : entropySeed(),
        mode: {
          kind: 'expedition',
          goldium: true,
          expedition: {
            dateKey,
            loadoutId: daily ? 'standard' : profile.loadout,
            modules: daily ? [] : [...profile.slotted],
          },
        },
      }),
    );
  }

  /** Unlock (with cores) or select a starting rig. */
  private async pickLoadout(id: LoadoutId): Promise<void> {
    const profile = await storage.readExpeditionProfile();
    const def = LOADOUTS.find((l) => l.id === id);
    if (!def) return;
    if (!profile.unlocked.loadouts.includes(id)) {
      if (profile.cores < def.cost) {
        this.ui.toast(t('expNotEnoughCores'));
        return;
      }
      profile.cores -= def.cost;
      profile.unlocked.loadouts.push(id);
      this.audio.play('buy');
    }
    profile.loadout = id;
    await storage.writeExpeditionProfile(profile);
    void this.showExpedition();
  }

  /** Unlock (with cores), slot, or unslot a module — re-slotting is free. */
  private async toggleModule(id: ModuleId): Promise<void> {
    const profile = await storage.readExpeditionProfile();
    const def = MODULES.find((m) => m.id === id);
    if (!def) return;
    if (!profile.unlocked.modules.includes(id)) {
      if (profile.cores < def.cost) {
        this.ui.toast(t('expNotEnoughCores'));
        return;
      }
      profile.cores -= def.cost;
      profile.unlocked.modules.push(id);
      this.audio.play('buy');
      if (profile.slotted.length < MODULE_SLOTS) profile.slotted.push(id); // auto-slot
    } else if (profile.slotted.includes(id)) {
      profile.slotted = profile.slotted.filter((m) => m !== id);
    } else if (profile.slotted.length < MODULE_SLOTS) {
      profile.slotted.push(id);
    } else {
      this.ui.toast(`${MODULE_SLOTS} ${t('expSlots')} max — unslot one first`);
    }
    await storage.writeExpeditionProfile(profile);
    void this.showExpedition();
  }

  private async copyDailyResult(): Promise<void> {
    const today = dailyKey(new Date());
    const rec = (await storage.readDaily())[today];
    if (!rec) {
      this.ui.toast(t('expNoDaily'));
      return;
    }
    const code = encodeDailyResult({
      v: 1,
      date: today,
      depthFt: rec.bestDepthFt,
      cash: rec.bestCash,
      points: rec.bestPoints,
      ticks: rec.bestTicks,
      bestChain: rec.bestChain,
      outcome: rec.outcome,
    });
    if (await copyToClipboard(code)) this.ui.toast(t('expResultCopied'));
  }

  private async compareDailyResult(): Promise<void> {
    const text = window.prompt(t('expPasteResult'));
    if (!text) return;
    try {
      const theirs = decodeDailyResult(text);
      const mine = (await storage.readDaily())[theirs.date];
      const fmt = (d: number, c: number) =>
        `${Math.round(d).toLocaleString('en-US')} ft · $${c.toLocaleString('en-US')}`;
      const mineLine = mine ? fmt(mine.bestDepthFt, mine.bestCash) : '(no run that day)';
      this.ui.toast(
        `${theirs.date} — THEM ${fmt(theirs.depthFt, theirs.cash)} · YOU ${mineLine}`,
        7000,
      );
    } catch {
      this.ui.toast(t('expBadCode'));
    }
  }

  /** Single life: the suspend slot is consumed on resume (re-written at each building). */
  private async resumeExpedition(): Promise<void> {
    await this.loadSlot('exp:0');
    await storage.deleteSave('exp:0');
  }

  private suspendExpedition(): void {
    const host = this.host;
    if (!host || host.state.mode.kind !== 'expedition') return;
    void storage.writeSave('exp:0', serialize(host.state, Date.now()));
  }

  /** Bank cores, update the profile, and burn the suspend slot at run end. */
  private async settleExpedition(s: GameState, victory: boolean): Promise<number> {
    const contractsDone = s.contracts.filter((c) => c.done).length;
    const cores = coresEarned({ maxDepthFt: s.story.maxDepthFt, contractsDone, victory });
    const profile = await storage.readExpeditionProfile();
    profile.cores += cores;
    profile.runs++;
    if (victory) profile.wins++;
    profile.bestDepthFt = Math.min(profile.bestDepthFt, s.story.maxDepthFt);
    await storage.writeExpeditionProfile(profile);

    // Daily record: keep the single best RUN (by depth) so result codes stay
    // honest — one real run, never a franken-best across attempts.
    const dateKey = s.mode.expedition?.dateKey;
    if (dateKey) {
      const daily = await storage.readDaily();
      const prev = daily[dateKey];
      const deeper = !prev || s.story.maxDepthFt < prev.bestDepthFt;
      daily[dateKey] = {
        bestDepthFt: deeper ? s.story.maxDepthFt : prev.bestDepthFt,
        bestCash: deeper ? Math.floor(s.pod.cash) : prev.bestCash,
        bestTicks: deeper ? s.stats.ticks : prev.bestTicks,
        bestChain: deeper ? s.stats.bestChain : prev.bestChain,
        bestPoints: deeper ? s.pod.points : prev.bestPoints,
        attempts: (prev?.attempts ?? 0) + 1,
        outcome: deeper ? (victory ? 'victory' : 'destroyed') : prev.outcome,
      };
      await storage.writeDaily(daily);
    }

    await storage.deleteSave('exp:0');
    return cores;
  }

  private beginRun(state: GameState): void {
    const host = new GameHost(state, this.input);
    // Dev god mode tops up before every tick — race-free against big hits.
    host.beforeTick = () => {
      if (!this.devGod) return;
      state.pod.hp = maxHull(state.pod);
      state.pod.fuel = tankCapacity(state.pod);
    };
    this.attachHost(host, 0);
  }

  /** Start a networked co-op session on a prebuilt lockstep driver. */
  private beginCoopRun(host: SimHost, localPlayer: number): void {
    this.attachHost(host, localPlayer);
  }

  private coopSampler(): () => ReturnType<InputManager['sample']> {
    return () => (this.input.gameFocus ? this.input.sample() : EMPTY_INTENTS);
  }

  // ---------- co-op lobby (WebRTC paste-code handshake) ----------
  private coopSeats: Array<{ channel: RtcChannel; offerToken: string; connected: boolean }> = [];
  private coopView: 'menu' | 'host' | 'join' = 'menu';
  private coopStatus = '';
  private coopAnswerToken: string | null = null;

  private showCoop(): void {
    this.teardownCoopLobby();
    this.coopPendingSave = null;
    this.coopView = 'menu';
    this.coopStatus = '';
    this.renderCoop();
  }

  private teardownCoopLobby(): void {
    for (const seat of this.coopSeats) seat.channel.close();
    this.coopSeats = [];
    this.coopAnswerToken = null;
  }

  private renderCoop(): void {
    this.screens.show(
      coopScreen({
        view: this.coopView,
        status: this.coopStatus,
        seats: this.coopSeats.map((s, i) => ({
          status: s.connected ? 'connected' : 'waiting',
          offerToken: s.offerToken,
          label: `Player ${i + 2}`,
        })),
        canStart:
          this.coopSeats.length > 0 &&
          this.coopSeats.every((s) => s.connected) &&
          (!this.coopPendingSave || this.coopSeats.length === this.coopPendingPlayers() - 1),
        canAddSeat:
          this.coopSeats.length < (this.coopPendingSave ? this.coopPendingPlayers() - 1 : 5) &&
          this.coopSeats.every((s) => s.connected),
        answerToken: this.coopAnswerToken,
        onHost: () => {
          this.coopView = 'host';
          void this.addCoopSeat();
        },
        onJoin: () => {
          this.coopView = 'join';
          this.renderCoop();
        },
        onAddSeat: () => void this.addCoopSeat(),
        onAnswerPaste: (i, text) => void this.acceptCoopAnswer(i, text),
        onOfferPaste: (text) => void this.joinCoop(text),
        onCopy: (token) => void copyToClipboard(token).then((ok) => ok && this.ui.toast('Copied.')),
        onStart: () => this.startCoopSession(),
        onBack: () => {
          this.teardownCoopLobby();
          void this.showTitle();
        },
      }),
    );
  }

  private async addCoopSeat(): Promise<void> {
    this.coopStatus = 'Minting invite code…';
    this.renderCoop();
    try {
      const { channel, offerToken } = await RtcChannel.host();
      const seat = { channel, offerToken, connected: false };
      // Version handshake: the guest sends hi when its channel opens.
      channel.onMessage = (text) => {
        const msg = decodeMsg(text);
        if (msg?.m !== 'hi') return;
        if (msg.proto !== PROTO_VERSION || msg.saveV !== SAVE_VERSION) {
          this.ui.toast(t('coopVersionMismatch'), 6000);
          channel.close();
          this.coopSeats = this.coopSeats.filter((x) => x !== seat);
        } else {
          channel.send(encodeMsg({ m: 'hi', proto: PROTO_VERSION, saveV: SAVE_VERSION }));
          seat.connected = true;
        }
        this.renderCoop();
      };
      this.coopSeats.push(seat);
      this.coopStatus = '';
    } catch {
      this.coopStatus = 'WebRTC unavailable in this browser.';
    }
    this.renderCoop();
  }

  private async acceptCoopAnswer(i: number, text: string): Promise<void> {
    const seat = this.coopSeats[i];
    if (!seat) return;
    try {
      await seat.channel.acceptAnswer(text);
      this.coopStatus = 'Connecting…';
      this.renderCoop();
      await seat.channel.waitOpen(); // hi arrives via the handler set in addCoopSeat
      this.coopStatus = '';
    } catch {
      this.ui.toast(t('coopBadToken'));
    }
    this.renderCoop();
  }

  /** Crew size fixed by the pending save (0 when hosting a fresh world). */
  private coopPendingPlayers(): number {
    const mode = this.coopPendingSave?.mode;
    return mode?.kind === 'coop' ? (mode.players ?? 2) : 0;
  }

  private startCoopSession(): void {
    const channels = this.coopSeats.filter((s) => s.connected).map((s) => s.channel);
    if (channels.length === 0) return;
    const pending = this.coopPendingSave;
    if (pending && channels.length !== this.coopPendingPlayers() - 1) {
      this.ui.toast(t('coopNeedCrew'));
      return;
    }
    const players = pending ? this.coopPendingPlayers() : channels.length + 1;
    const seed = entropySeed();
    const mode = { kind: 'coop' as const, goldium: true, players };
    if (pending) {
      const parts = chunkSplit(encodeSave(pending));
      channels.forEach((ch, i) => {
        ch.send(encodeMsg({ m: 'join', player: i + 1, players }));
        ch.send(encodeMsg({ m: 'resume', chunks: parts.length }));
        parts.forEach((data, k) => ch.send(encodeMsg({ m: 'chunk', i: k, n: parts.length, data })));
      });
    } else {
      channels.forEach((ch, i) => {
        ch.send(encodeMsg({ m: 'join', player: i + 1, players }));
        ch.send(encodeMsg({ m: 'start', seed, mode, level: 1 }));
      });
    }
    const state = pending ? deserialize(pending) : createRun({ seed, mode });
    this.coopPendingSave = null;
    const host = new LockstepHost(state, {
      role: 'host',
      localPlayer: 0,
      players,
      channels,
      sampleInput: this.coopSampler(),
    });
    this.wireLockstep(host);
    this.coopSeats = []; // channels now belong to the session
    this.beginCoopRun(host, 0);
  }

  private async joinCoop(offerToken: string): Promise<void> {
    try {
      this.coopStatus = 'Connecting…';
      this.renderCoop();
      const { channel, answerToken } = await RtcChannel.join(offerToken);
      this.coopAnswerToken = answerToken;
      this.coopStatus = t('coopWaiting');
      void copyToClipboard(answerToken);
      this.renderCoop();
      await channel.waitOpen();
      channel.send(encodeMsg({ m: 'hi', proto: PROTO_VERSION, saveV: SAVE_VERSION }));
      await this.guestAwaitAndBegin(channel);
    } catch {
      this.coopStatus = '';
      this.coopAnswerToken = null;
      this.ui.toast(t('coopBadToken'));
      this.renderCoop();
    }
  }

  /** Guest bootstrap shared by RTC and local-tab transports: join, then start or resume. */
  private guestAwaitAndBegin(ch: NetChannel): Promise<void> {
    return new Promise((res) => {
      let joined: { player: number; players: number } | null = null;
      const parts = new ChunkAssembler();
      const begin = (state: GameState) => {
        if (!joined) return;
        const host = new LockstepHost(state, {
          role: 'guest',
          localPlayer: joined.player,
          players: joined.players,
          channels: [ch],
          sampleInput: this.coopSampler(),
        });
        this.wireLockstep(host);
        this.beginCoopRun(host, joined.player);
        res();
      };
      ch.onMessage = (text) => {
        const msg = decodeMsg(text);
        if (msg?.m === 'join') joined = { player: msg.player, players: msg.players };
        if (msg?.m === 'start' && joined) {
          begin(createRun({ seed: msg.seed, mode: msg.mode, level: msg.level }));
        } else if (msg?.m === 'resume') {
          parts.begin(msg.chunks);
        } else if (msg?.m === 'chunk') {
          const whole = parts.add(msg.i, msg.n, msg.data);
          if (whole !== null) begin(deserialize(decodeSave(whole)));
        }
      };
    });
  }

  private wireLockstep(host: LockstepHost): void {
    this.lockstep = host;
    this.coopDropped = new Set();
    this.hud.setDroppedSeats(this.coopDropped);
    // Leaving the page must not strand the peers on a silent stall.
    window.addEventListener('pagehide', this.coopByeOnUnload);
    host.onDesync = (player, mine, theirs) => {
      console.error(
        `[coop] desync: P${player + 1} hash ${theirs} vs host hash ${mine} @tick ${host.state.tick}`,
      );
      if (this.modals.isOpen) return; // one dialog at a time — the sentinel re-fires anyway
      openChoice(
        this.modals,
        t('coopDesyncTitle'),
        t('coopDesyncBody'),
        t('coopResync'),
        () => host.resync(),
        t('coopIgnore'),
      );
    };
    host.onResynced = () => {
      // The whole world may have shifted under the renderer — repaint it all.
      const scene = this.phaser?.scene?.getScene('game') as GameScene | null;
      if (this.phaser?.scene?.isActive('game')) scene?.repaintWorld();
      this.ui.toast(t('coopResynced'), 4000);
    };
    host.onDisconnect = (player) => {
      if (player === null) {
        // The host is gone — the session cannot continue on any guest.
        this.modals.closeAll();
        openMessage(
          this.modals,
          t('coopTitle'),
          t('coopHostGone'),
          t('backToTitle'),
          () => void this.showTitle(),
        );
      } else if (!this.coopDropped.has(player)) {
        // 'bye' and the transport close can both report the same drop — badge once.
        this.coopDropped.add(player);
        this.ui.toast(`P${player + 1} ${t('coopDroppedToast')}`, 5000);
      }
    };
  }

  /**
   * Same-machine co-op via BroadcastChannel tabs (dev/testing, zero WebRTC):
   *   host tab:  ?coop=host&room=dev&players=2
   *   guest tab: ?coop=join&room=dev&seat=1
   */
  private async startLocalCoop(params: URLSearchParams): Promise<void> {
    const room = params.get('room') ?? 'dev';
    if (params.get('coop') === 'host') {
      const players = Math.max(2, Math.min(6, Number(params.get('players') ?? 2)));
      const channels: NetChannel[] = [];
      for (let seat = 1; seat < players; seat++)
        channels.push(new LocalChannel(room, seat, 'host'));
      this.ui.toast(`Hosting local co-op '${room}' — waiting for ${players - 1} tab(s)…`, 8000);
      await new Promise<void>((res) => {
        let ready = 0;
        channels.forEach((ch, i) => {
          ch.onMessage = (text) => {
            const msg = decodeMsg(text);
            if (msg?.m !== 'hi') return;
            ch.send(encodeMsg({ m: 'hi', proto: PROTO_VERSION, saveV: SAVE_VERSION }));
            ch.send(encodeMsg({ m: 'join', player: i + 1, players }));
            if (++ready === players - 1) res();
          };
        });
      });
      const seed = entropySeed();
      const mode = { kind: 'coop' as const, goldium: true, players };
      for (const ch of channels) ch.send(encodeMsg({ m: 'start', seed, mode, level: 1 }));
      const state = createRun({ seed, mode });
      const host = new LockstepHost(state, {
        role: 'host',
        localPlayer: 0,
        players,
        channels,
        sampleInput: this.coopSampler(),
      });
      this.wireLockstep(host);
      this.beginCoopRun(host, 0);
    } else {
      const seat = Math.max(1, Math.min(5, Number(params.get('seat') ?? 1)));
      const ch = new LocalChannel(room, seat, 'guest');
      this.ui.toast(`Joining local co-op '${room}' as seat ${seat}…`, 8000);
      const begin = this.guestAwaitAndBegin(ch);
      ch.send(encodeMsg({ m: 'hi', proto: PROTO_VERSION, saveV: SAVE_VERSION }));
      await begin;
    }
  }

  private attachHost(host: SimHost, localPlayer: number): void {
    try {
      const state = host.state;
      this.stopRun();
      this.screens.clear();
      this.host = host;
      this.localPlayer = localPlayer;
      host.onEvent((e) => this.onSimEvent(e));
      if (state.tick === 0) {
        this.lifetime.totalRuns++;
        this.saveLifetime();
      }
      this.input.gameFocus = true;
      this.hud.node.style.display = '';
      this.applySettings();
      this.audio.playMusic('mine');

      this.phaser.scene.stop('game');
      this.phaser.scene.start('game', {
        host: this.host,
        audio: this.audio,
        screenShake: Boolean(this.fx.screenShake),
        gasHint: Boolean(this.fx.gasShimmerHint),
        fxFull: this.fx.fxDensity !== 'reduced',
        damageFlash: Boolean(this.fx.damageFlash),
        pixelPerfect: Boolean(this.fx.pixelPerfect),
        oreGlyphs: Boolean(this.fx.oreGlyphs),
        ambientLife: Boolean(this.fx.ambientLife),
        // Carrier-landing cinematic: fresh story runs only (not loads, not challenges).
        intro: state.tick === 0 && state.mode.kind === 'story',
        localPlayer,
      });

      // HUD refresh loop (display-rate, cheap).
      const hudLoop = () => {
        if (!this.host) return;
        this.hud.update(this.host.state, this.localPlayer);
        // Lockstep stall overlay: name who we're waiting on after half a second.
        const ls = this.lockstep;
        if (ls) {
          if (ls.stalledMs > 500) {
            const late = ls.latePlayers().filter((pl) => !this.coopDropped.has(pl));
            const who =
              late.length > 0 ? late.map((pl) => `P${pl + 1}`).join(', ') : t('coopHostName');
            this.hud.setWaiting(`${t('coopWaitingFor')} ${who}…`);
          } else {
            this.hud.setWaiting(null);
          }
        }
        this.hudTimer = requestAnimationFrame(hudLoop);
      };
      this.hudTimer = requestAnimationFrame(hudLoop);

      // Story intro fires on tick 1; kick the transmission check shortly after start.
      setTimeout(() => this.pumpPendingTransmission(), 100);
    } catch (err) {
      // A synchronous failure starting the run: don't leave a blank screen.
      showFatal('Could not start the run', (err as Error)?.stack ?? String(err));
    }
  }

  private stopRun(): void {
    if (this.hudTimer) cancelAnimationFrame(this.hudTimer);
    if (this.lockstep) {
      this.lockstep.shutdown();
      this.lockstep = null;
      window.removeEventListener('pagehide', this.coopByeOnUnload);
      this.coopDropped = new Set();
      this.hud.setDroppedSeats(this.coopDropped);
      this.hud.setWaiting(null);
    }
    if (this.phaser?.scene?.isActive('game')) this.phaser.scene.stop('game');
    this.audio.stopLoops();
    this.audio.stopMusic();
    this.modals.closeAll();
    this.host = null;
    this.hud.node.style.display = 'none';
    this.hud.setPrompt(null);
    this.touch.setVisible(false);
  }

  // ---------- sim event handling ----------
  private onSimEvent(e: SimEvent): void {
    const host = this.host;
    if (!host) return;
    // Pod-attributed events: prompts, menus and toasts belong to the LOCAL player.
    const local = ('player' in e ? (e.player ?? 0) : 0) === this.localPlayer;
    switch (e.t) {
      case 'buildingPrompt':
        if (!local) break;
        this.hud.setPrompt(e.id ? t(BUILDINGS.find((b) => b.id === e.id)?.key ?? e.id) : null);
        break;
      case 'enterBuilding':
        if (!local) break;
        if (this.modals.isOpen) break; // already inside a menu
        if (host.state.mode.kind === 'expedition') {
          // Single life: expeditions suspend (crash-safe) instead of saving slots.
          this.suspendExpedition();
          if (e.id === 'saveStation') {
            this.ui.toast(t('expSuspended'));
            break;
          }
        } else if (this.fx.autosaveOnSurface) {
          void this.saveToSlot('auto:0', false); // QoL, default OFF
        }
        this.openBuildingModal(e.id);
        break;
      case 'transmission':
        this.pumpPendingTransmission();
        break;
      case 'cargoFullLost':
        if (local) this.ui.toast(t('uiCargoFull'));
        break;
      case 'rescue':
        if (local) this.ui.toast(`${t('uiRescue')} (-$${e.cost.toLocaleString('en-US')})`);
        break;
      case 'podDown':
        this.ui.toast(
          `P${e.player + 1} ${t('coopDownToast')} -$${e.fee.toLocaleString('en-US')}`,
          3200,
        );
        break;
      case 'podRespawned':
        this.ui.toast(`P${e.player + 1} ${t('coopBackToast')}`);
        break;
      case 'transaction':
        if (e.kind === 'chainBonus')
          this.ui.toast(`${t('uiChainBonus')} +$${e.amount.toLocaleString('en-US')}`);
        // Lockstep: the command landed now — re-render the open shop dialog.
        this.modals.refreshTop?.();
        break;
      case 'contractDone':
        this.ui.toast(`${t('uiContractDone')} +$${e.rewardCash.toLocaleString('en-US')}`, 3200);
        break;
      case 'relicOffer':
        openRelicChoice(this.modals, e.choices, (id) => {
          host.command({ c: 'chooseRelic', id });
          const cap = id.charAt(0).toUpperCase() + id.slice(1);
          this.ui.toast(`${t('rlChosen')}: ${t(`rl${cap}`)}`, 3200);
        });
        break;
      case 'damage':
        // First-ever encounter with each hazard gets a one-line log entry (lifetime-once).
        if (local && !this.lifetime.hazardsSeen.includes(e.cause)) {
          this.lifetime.hazardsSeen.push(e.cause);
          this.saveLifetime();
          const key = `hazard${e.cause.charAt(0).toUpperCase()}${e.cause.slice(1)}`;
          this.ui.toast(t(key), 3800);
        }
        break;
      case 'bonusCash':
        this.ui.toast(`+$${e.amount.toLocaleString('en-US')}`);
        break;
      case 'blueprintFound':
        this.ui.toast(`${t('bpFound')}: ${t(`bp${e.id.charAt(0).toUpperCase()}${e.id.slice(1)}`)}`);
        break;
      case 'podExploded':
        this.onGameOver(e.cause);
        break;
      case 'victory':
        this.onVictory();
        break;
      case 'challengeResult':
        void this.onChallengeResult(e.win, e.elapsedTicks);
        break;
    }
  }

  private openBuildingModal(id: BuildingId): void {
    const host = this.host;
    if (!host) return;
    openBuilding(
      this.modals,
      id,
      host.state,
      (c) => host.command(c),
      () => void this.saveToSlot(this.lastManualSlot, true),
    );
  }

  private pumpPendingTransmission(): void {
    const host = this.host;
    if (!host) return;
    const id = host.state.story.pendingTransmission;
    if (!id) return;
    host.state.story.pendingTransmission = null;
    openTransmission(
      this.modals,
      id,
      () => this.pumpPendingTransmission(),
      () => this.audio.play('textBlip', 0.25),
    );
  }

  /** The in-field cargo inventory (I key / cargo-bar tap) — jettison anywhere. */
  private openInventoryModal(): void {
    const host = this.host;
    if (!host || this.screens.visible || this.modals.isOpen) return;
    if (host.state.boss && host.state.outcome === 'active') {
      this.ui.toast(t('uiNoInventoryArena')); // same rule as pausing: not in the arena
      return;
    }
    openInventory(this.modals, host.state, (c) => host.command(c));
  }

  private togglePause(): void {
    const host = this.host;
    if (!host || this.screens.visible) return;
    if (this.modals.isOpen) return; // Esc closes nothing implicitly; modals have buttons
    if (host.state.boss && host.state.outcome === 'active') {
      this.ui.toast(t('uiNoPauseArena')); // authentic: no pausing during the fight
      return;
    }
    // Co-op: the pause menu is a SYNCHRONIZED pause — everyone stops together
    // (LockstepHost ignores the ordinary 'modal' reason; 'user' is broadcast).
    if (host.state.mode.kind === 'coop') host.pause('user');
    openPause(
      this.modals,
      () => {},
      () => void this.showTitle(),
      () => this.showSettings(() => this.screens.clear()),
      () => this.screens.show(helpScreen(() => this.screens.clear())),
    );
  }

  // ---------- hidden dev panel ----------
  private showDevPanel(): void {
    const host = this.host;
    if (!host) return;
    const s = host.state;
    const scene = this.phaser?.scene?.isActive('game')
      ? (this.phaser.scene.getScene('game') as GameScene | null)
      : null;
    openDevPanel(this.modals, {
      info: () => {
        const p = s.pod;
        return (
          `seed ${s.seed} · ${s.mode.kind} · ${Math.round(podDepthFt(p))} ft · ` +
          `tile ${podTileX(p)},${podTileY(p)} · hp ${p.hp}/${maxHull(p)} · ` +
          `fuel ${p.fuel.toFixed(1)}/${tankCapacity(p)} · heat ${Math.round(p.heat)} · ×${host.timeScale}`
        );
      },
      give: (kind) => {
        const p = s.pod;
        switch (kind) {
          case 'cash':
            p.cash += 100_000;
            break;
          case 'points':
            p.points += 100_000;
            break;
          case 'refit':
            p.hp = maxHull(p);
            p.fuel = tankCapacity(p);
            p.heat = 0;
            break;
          case 'upgrades':
            for (const c of UPGRADE_CATEGORIES) p.upgrades[c] = UPGRADES[c].length - 1;
            p.hp = maxHull(p);
            break;
          case 'blueprints':
            for (const b of BLUEPRINTS) if (!p.blueprints.includes(b.id)) p.blueprints.push(b.id);
            break;
          case 'items':
            for (const it of ITEMS) p.inventory[it.id] = (p.inventory[it.id] ?? 0) + 10;
            break;
        }
      },
      toggleGod: () => {
        this.devGod = !this.devGod;
        return this.devGod;
      },
      isGod: () => this.devGod,
      cycleSpeed: () => {
        const seq = [1, 2, 4, 0.25];
        host.timeScale = seq[(seq.indexOf(host.timeScale) + 1) % seq.length] ?? 1;
        return host.timeScale;
      },
      teleportDepth: (ft) => {
        const p = s.pod;
        const ty = Math.max(1, Math.min(WORLD_H - 6, Math.round(SURFACE_ROW - 1 - ft / 12.5)));
        const tx = Math.max(2, Math.min(WORLD_W - 3, podTileX(p)));
        if (ty > SURFACE_ROW && getTile(s.world, tx, ty) !== Tile.Air)
          setTile(s.world, tx, ty, Tile.Air); // carve a pocket rather than embed the pod
        p.x = (tx + 0.5) * TILE_PX;
        p.y = ty * TILE_PX + TILE_PX / 2;
        p.prevX = p.x;
        p.prevY = p.y;
        p.xVel = 0;
        p.yVel = 0;
        p.mode = 'air';
        p.drilling = null;
        scene?.repaintWorld();
      },
      revealMap: () => s.world.discovered.fill(1),
      toggleXray: () => {
        this.devXray = !this.devXray;
        this.applySettings();
        return this.devXray;
      },
      isXray: () => this.devXray,
      quakeNow: () => {
        // Arm the scheduler: force the depth gate and fire on the next tick.
        s.story.maxDepthFt = Math.min(s.story.maxDepthFt, -1_001);
        s.story.nextQuakeTick = s.tick + 1;
      },
      setHeat: (v) => {
        s.pod.heat = v;
      },
      grantAllRelics: () => {
        for (const r of RELICS) if (!s.pod.relics.includes(r.id)) s.pod.relics.push(r.id);
      },
      clearRelics: () => {
        s.pod.relics.length = 0;
      },
      completeContracts: () => {
        for (const c of s.contracts) {
          if (c.done) continue;
          c.done = true;
          s.pod.cash += c.rewardCash;
        }
      },
      spawnCritter: () => {
        if (s.mode.kind === 'expedition')
          s.critters.push({ x: s.pod.x + 3 * TILE_PX, y: s.pod.y, moveCooldown: 21 });
      },
      weakenBoss: () => {
        if (s.boss) s.boss.hp = 1;
      },
      addCores: (n) => {
        void storage.readExpeditionProfile().then((prof) => {
          prof.cores += n;
          return storage.writeExpeditionProfile(prof);
        });
      },
    });
  }

  private onGameOver(cause: 'hull' | 'fuel'): void {
    const host = this.host;
    this.audio.stopLoops();
    this.audio.stopMusic(); // the mine bed must not play over the wreck
    // Let the explosion ring out, then the somber sting under the dialog.
    setTimeout(() => this.audio.play('gameOver'), 650);
    const stats = {
      depthFt: host?.state.story.maxDepthFt ?? 0,
      cash: host?.state.pod.cash ?? 0,
      points: host?.state.pod.points ?? 0,
      tilesDug: host?.state.stats.tilesDug ?? 0,
      ticks: host?.state.stats.ticks ?? 0,
      bestChain: host?.state.stats.bestChain ?? 0,
      rescues: host?.state.stats.rescues ?? 0,
    };
    const st = host?.state;
    if (st) {
      const lt = this.lifetime;
      lt.totalDeaths++;
      lt.deepestFt = Math.min(lt.deepestFt, st.story.maxDepthFt);
      lt.mostCash = Math.max(lt.mostCash, st.pod.cash);
      lt.bestChain = Math.max(lt.bestChain, st.stats.bestChain);
      lt.totalTilesDug += st.stats.tilesDug;
      this.saveLifetime();
      if (st.mode.kind === 'expedition')
        void this.settleExpedition(st, false).then((cores) => {
          if (cores > 0) this.ui.toast(`${t('expCoresEarned')}: +${cores} cores`, 3600);
        });
    }
    // Refine a hull death to the hazard that landed the killing blow (last second only).
    const last = host?.state.pod.lastDamage ?? null;
    const detail =
      cause === 'fuel'
        ? 'fuel'
        : last && host && last.atTick >= host.state.tick - 42
          ? last.cause
          : null;
    // One-time offer on the death screen: turn on the autosave QoL right here.
    const offerAutosave =
      !this.lifetime.flags.deathPromptShown &&
      !this.fx.autosaveOnSurface &&
      !this.settings.puristMode;
    if (offerAutosave) {
      this.lifetime.flags.deathPromptShown = true;
      this.saveLifetime();
    }
    void storage.listSaves().then((slots) => {
      const has = slots.some((s) => s.key.startsWith('manual') || s.key.startsWith('auto'));
      openGameOver(
        this.modals,
        cause,
        detail,
        has,
        stats,
        () => void this.loadMostRecent(),
        () => void this.showTitle(),
        offerAutosave
          ? {
              label: t('uiEnableAutosave'),
              onClick: () => {
                this.settings.autosaveOnSurface = true;
                void storage.writeSettings(this.settings);
                this.applySettings();
                this.ui.toast(t('uiAutosaveOn'));
              },
            }
          : null,
      );
    });
  }

  private onVictory(): void {
    const host = this.host;
    if (!host) return;
    const lt = this.lifetime;
    lt.deepestFt = Math.min(lt.deepestFt, host.state.story.maxDepthFt);
    lt.mostCash = Math.max(lt.mostCash, host.state.pod.cash);
    lt.bestChain = Math.max(lt.bestChain, host.state.stats.bestChain);
    lt.totalTilesDug += host.state.stats.tilesDug;
    this.saveLifetime();
    this.audio.stopLoops();
    this.audio.playMusic('ending');
    this.audio.ambience.silence();
    const isStory = host.state.mode.kind === 'story';
    const coresPromise: Promise<number | undefined> =
      host.state.mode.kind === 'expedition'
        ? this.settleExpedition(host.state, true)
        : Promise.resolve(undefined);
    // Show the epilogue after the final transmission modal closes.
    const check = setInterval(() => {
      if (this.modals.isOpen) return;
      clearInterval(check);
      const s = host.state;
      void coresPromise.then((coresBanked) =>
        this.screens.show(
          endingScreen({
            state: s,
            ngPlus: isStory,
            coresBanked,
            onNgPlus: () => {
              const next = createRun({
                seed: entropySeed(),
                level: s.level + 1,
                mode: s.mode,
                carry: {
                  cash: s.pod.cash,
                  upgrades: s.pod.upgrades,
                  blueprints: s.pod.blueprints,
                  inventory: s.pod.inventory,
                  points: s.pod.points,
                },
              });
              this.beginRun(next);
            },
            onTitle: () => void this.showTitle(),
          }),
        ),
      );
    }, 300);
  }

  private async onChallengeResult(win: boolean, elapsedTicks: number): Promise<void> {
    const host = this.host;
    if (!host) return;
    const id = host.state.mode.challengeId;
    if (win && id) {
      const records = await storage.readRecords();
      const rec = records[id] ?? { bestTicks: Number.MAX_SAFE_INTEGER, completions: 0 };
      rec.completions++;
      rec.bestTicks = Math.min(rec.bestTicks, elapsedTicks);
      records[id] = rec;
      await storage.writeRecords(records);
      const all = CHALLENGES.every((c) => (records[c.id]?.completions ?? 0) > 0);
      this.ui.toast(
        win ? `★ ${t(CHALLENGES.find((c) => c.id === id)?.key ?? id)} complete!` : 'Failed',
      );
      if (all) this.ui.toast(t('chReward'), 4000);
    } else {
      this.ui.toast('Challenge failed');
    }
    setTimeout(() => void this.showChallenges(), 1200);
  }

  // ---------- persistence ----------
  private async saveToSlot(slot: string, toast: boolean): Promise<void> {
    const host = this.host;
    if (!host) return;
    if (host.state.mode.kind === 'coop' && this.localPlayer !== 0) {
      this.ui.toast(t('coopHostSaves'));
      return;
    }
    await storage.writeSave(slot, serialize(host.state, Date.now()));
    this.lastManualSlot = slot;
    if (toast) {
      this.audio.play('save');
      this.ui.toast(t('uiSaved'));
      // One-time onboarding: after the first manual save ever, point at the autosave QoL.
      if (!this.lifetime.flags.savedOnce) {
        this.lifetime.flags.savedOnce = true;
        if (
          !this.lifetime.flags.autosavePromptShown &&
          !this.fx.autosaveOnSurface &&
          !this.settings.puristMode
        ) {
          this.lifetime.flags.autosavePromptShown = true;
          this.ui.toast(t('uiAutosaveTip'), 4200);
        }
        this.saveLifetime();
      }
    }
  }

  private async loadMostRecent(): Promise<void> {
    const slots = await storage.listSaves();
    if (slots.length === 0) return;
    const latest = slots.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
    await this.loadSlot(latest.key);
  }

  private async loadSlot(key: string): Promise<void> {
    try {
      let raw = await storage.readSave(key);
      let save: ReturnType<typeof migrateAndValidate>;
      try {
        save = migrateAndValidate(raw);
      } catch {
        raw = await storage.readSaveBackup(key);
        save = migrateAndValidate(raw); // fall back to the dual-write backup
      }
      this.lastManualSlot = key.startsWith('manual') ? key : this.lastManualSlot;
      if (save.mode.kind === 'coop') {
        // A crew world resumes through the host lobby — everyone reconnects first.
        this.coopPendingSave = save;
        this.teardownCoopLobby();
        this.coopView = 'host';
        this.coopStatus = `${t('coopResumeLobby')} — ${t('coopNeedCrew')} (×${this.coopPendingPlayers()})`;
        void this.addCoopSeat();
        return;
      }
      this.beginRun(deserialize(save));
    } catch (err) {
      this.ui.toast(`Load failed: ${(err as Error).message}`);
    }
  }
}
