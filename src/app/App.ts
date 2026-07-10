import { t } from '@content/strings';
import {
  BUILDINGS,
  type BuildingId,
  CHALLENGES,
  type GameState,
  type SettingsValues,
  type SimEvent,
  createRun,
  defaultSettings,
  deserialize,
  effectiveSettings,
  serialize,
} from '@core/index';
import { decodeSave, encodeSave } from '@core/save/codec';
import { migrateAndValidate } from '@core/save/migrate';
import { GameHost } from '@game/GameHost';
import { AudioBus } from '@game/audio/AudioBus';
import { createPhaserGame } from '@game/phaserGame';
import type { GameScene } from '@game/scenes/GameScene';
import { InputManager } from '@input/InputManager';
import { entropySeed, isTouchDevice } from '@platform/env';
import { copyToClipboard, downloadText, pickTextFile } from '@platform/exporter';
import * as storage from '@platform/storage';
import { Hud } from '@ui/Hud';
import { TouchControls } from '@ui/TouchControls';
import { UiRoot } from '@ui/UiRoot';
import { showFatal } from '@ui/fatal';
import { helpScreen } from '@ui/help';
import {
  ModalManager,
  openBuilding,
  openGameOver,
  openInventory,
  openPause,
  openTransmission,
} from '@ui/modals';
import {
  ScreenHost,
  challengeScreen,
  endingScreen,
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
  private host: GameHost | null = null;
  private settings: SettingsValues = defaultSettings();
  private lifetime: storage.LifetimeRecords = storage.defaultLifetime();
  private lastManualSlot = 'manual:0';
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
        lifetime: this.lifetime,
        onNew: () => this.newStoryRun(),
        onContinue: () => void this.loadMostRecent(),
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
      }),
    );
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
    this.input.setScheme(String(fx.controlScheme) === 'vim' ? 'vim' : 'classic');

    // HUD-side QoL (independent of the Phaser scene).
    this.hud.setSpeedrunTimer(Boolean(fx.speedrunTimer));
    this.hud.setMinimap(Boolean(fx.minimap));
    this.hud.refreshHotkeys(); // hotbar labels follow the key scheme

    // Push live FX into the running play field (if any).
    const scene = this.phaser?.scene?.isActive('game')
      ? (this.phaser.scene.getScene('game') as GameScene | null)
      : null;
    scene?.applyFx({
      screenShake: Boolean(fx.screenShake),
      gasHint: Boolean(fx.gasShimmerHint),
      fxFull: fx.fxDensity !== 'reduced',
      damageFlash: Boolean(fx.damageFlash),
      pixelPerfect: Boolean(fx.pixelPerfect),
      oreGlyphs: Boolean(fx.oreGlyphs),
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

  private beginRun(state: GameState): void {
    try {
      this.stopRun();
      this.screens.clear();
      this.host = new GameHost(state, this.input);
      this.host.onEvent((e) => this.onSimEvent(e));
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
        // Carrier-landing cinematic: fresh story runs only (not loads, not challenges).
        intro: state.tick === 0 && state.mode.kind === 'story',
      });

      // HUD refresh loop (display-rate, cheap).
      const hudLoop = () => {
        if (!this.host) return;
        this.hud.update(this.host.state);
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
    switch (e.t) {
      case 'buildingPrompt':
        this.hud.setPrompt(e.id ? t(BUILDINGS.find((b) => b.id === e.id)?.key ?? e.id) : null);
        break;
      case 'enterBuilding':
        if (this.modals.isOpen) break; // already inside a menu
        if (this.fx.autosaveOnSurface) void this.saveToSlot('auto:0', false); // QoL, default OFF
        this.openBuildingModal(e.id);
        break;
      case 'transmission':
        this.pumpPendingTransmission();
        break;
      case 'cargoFullLost':
        this.ui.toast(t('uiCargoFull'));
        break;
      case 'rescue':
        this.ui.toast(`${t('uiRescue')} (-$${e.cost.toLocaleString('en-US')})`);
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
    openPause(
      this.modals,
      () => {},
      () => void this.showTitle(),
      () => this.showSettings(() => this.screens.clear()),
      () => this.screens.show(helpScreen(() => this.screens.clear())),
    );
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
    }
    void storage.listSaves().then((slots) => {
      const has = slots.some((s) => s.key.startsWith('manual') || s.key.startsWith('auto'));
      openGameOver(
        this.modals,
        cause,
        has,
        stats,
        () => void this.loadMostRecent(),
        () => void this.showTitle(),
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
    // Show the epilogue after the final transmission modal closes.
    const check = setInterval(() => {
      if (this.modals.isOpen) return;
      clearInterval(check);
      const s = host.state;
      this.screens.show(
        endingScreen({
          state: s,
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
      this.beginRun(deserialize(save));
    } catch (err) {
      this.ui.toast(`Load failed: ${(err as Error).message}`);
    }
  }
}
