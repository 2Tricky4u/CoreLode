import { t } from '@content/strings';
import {
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
import { ModalManager, openBuilding, openGameOver, openPause, openTransmission } from '@ui/modals';
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
  private lastManualSlot = 'manual:0';
  private hudTimer = 0;

  constructor() {
    this.touch = new TouchControls(this.input, 'right');
    this.ui.hudLayer.append(this.hud.node, this.touch.node);
    this.hud.node.style.display = 'none';
    this.touch.setVisible(false);
    this.hud.onUseItem = (id) => this.input.queueTouchItem(id);
    this.input.attach(window);
    this.input.onPause = () => this.togglePause();
    this.audio.attachUnlock();

    this.modals.onOpenChange = (open) => {
      this.input.gameFocus = !open && !this.screens.visible;
      if (this.host) (open ? this.host.pause : this.host.resume).call(this.host, 'modal');
      if (open) this.input.clearHeld();
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.host?.pause('hidden');
      else this.host?.resume('hidden');
    });
  }

  async start(): Promise<void> {
    this.settings = { ...defaultSettings(), ...((await storage.readSettings()) ?? {}) };
    void storage.requestPersistence();
    this.phaser = createPhaserGame('game');
    await new Promise<void>((res) => this.phaser.events.once('assets-ready', () => res()));
    this.ui.syncScale();
    this.showTitle();
  }

  private get fx(): SettingsValues {
    return effectiveSettings(this.settings);
  }

  // ---------- screens ----------
  private async showTitle(): Promise<void> {
    this.stopRun();
    const slots = await storage.listSaves();
    this.input.gameFocus = false;
    this.screens.show(
      titleScreen({
        canContinue: slots.length > 0,
        onNew: () => this.newStoryRun(),
        onContinue: () => void this.loadMostRecent(),
        onLoad: () => void this.showSaveSlots(),
        onChallenges: () => void this.showChallenges(),
        onSettings: () => this.showSettings(() => this.showTitle()),
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
    const touchMode = String(fx.touchControls);
    this.touch.setVisible(
      this.host !== null && (touchMode === 'on' || (touchMode === 'auto' && isTouchDevice())),
    );
  }

  // ---------- run lifecycle ----------
  private newStoryRun(): void {
    const seed = this.fx.seededRuns ? this.promptSeed() : entropySeed();
    this.beginRun(createRun({ seed, mode: { kind: 'story', goldium: true } }));
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
    this.stopRun();
    this.screens.clear();
    this.host = new GameHost(state, this.input);
    this.host.onEvent((e) => this.onSimEvent(e));
    this.input.gameFocus = true;
    this.hud.node.style.display = '';
    this.applySettings();

    const scene = this.phaser.scene.getScene('game') as GameScene;
    this.phaser.scene.stop('game');
    this.phaser.scene.start('game', {
      host: this.host,
      audio: this.audio,
      screenShake: Boolean(this.fx.screenShake),
      gasHint: Boolean(this.fx.gasShimmerHint),
      fxFull: this.fx.fxDensity !== 'reduced',
    });
    void scene;

    // HUD refresh loop (display-rate, cheap).
    const hudLoop = () => {
      if (!this.host) return;
      this.hud.update(this.host.state);
      this.hudTimer = requestAnimationFrame(hudLoop);
    };
    this.hudTimer = requestAnimationFrame(hudLoop);

    // Story intro fires on tick 1; kick the transmission check shortly after start.
    setTimeout(() => this.pumpPendingTransmission(), 100);
  }

  private stopRun(): void {
    if (this.hudTimer) cancelAnimationFrame(this.hudTimer);
    if (this.phaser?.scene?.isActive('game')) this.phaser.scene.stop('game');
    this.audio.stopLoops();
    this.modals.closeAll();
    this.host = null;
    this.hud.node.style.display = 'none';
    this.touch.setVisible(false);
  }

  // ---------- sim event handling ----------
  private onSimEvent(e: SimEvent): void {
    const host = this.host;
    if (!host) return;
    switch (e.t) {
      case 'enterBuilding':
        if (this.fx.autosaveOnSurface) void this.saveToSlot('auto:0', false); // QoL, default OFF
        this.openBuildingModal(e.id);
        break;
      case 'transmission':
        this.pumpPendingTransmission();
        break;
      case 'cargoFullLost':
        this.ui.toast(t('uiCargoFull'));
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
    openTransmission(this.modals, id, () => this.pumpPendingTransmission());
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
    );
  }

  private onGameOver(cause: 'hull' | 'fuel'): void {
    this.audio.stopLoops();
    void storage.listSaves().then((slots) => {
      const has = slots.some((s) => s.key.startsWith('manual') || s.key.startsWith('auto'));
      openGameOver(
        this.modals,
        cause,
        has,
        () => void this.loadMostRecent(),
        () => void this.showTitle(),
      );
    });
  }

  private onVictory(): void {
    const host = this.host;
    if (!host) return;
    this.audio.stopLoops();
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
    if (toast) this.ui.toast(t('uiSaved'));
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
