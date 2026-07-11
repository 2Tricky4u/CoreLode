import {
  ALTIMETER_ARENA_FT,
  BUILDINGS,
  COLLECTIBLES,
  DAY_LENGTH_TICKS,
  type GameState,
  PHYSICS,
  SURFACE_ROW,
  type SimEvent,
  TILE_PX,
  Tile,
  WORLD_H,
  WORLD_W,
  getTile,
  hasSurveyor,
  isArtifact,
  isBoulder,
  isMineral,
  podDepthFt,
  saleValue,
} from '@core/index';
/**
 * Composition root of the play field. v2 "juice" pass:
 * smooth canvas-texture darkness with a flickering pod light + arena pulse,
 * real particle emitters (debris/thrust/motes/embers), additive glows,
 * lava palette-cycling, damage vignette, collect popups, star field + day/night.
 */
import Phaser from 'phaser';
import type { SimHost } from '../GameHost';
import type { AudioBus } from '../audio/AudioBus';
import { BossView } from '../render/BossView';
import { CritterView } from '../render/CritterView';
import { FaunaLayer } from '../render/FaunaLayer';
import { PodView } from '../render/PodView';
import { TileRenderer } from '../render/TileRenderer';

/** Soil ramp base colors per band for debris tinting (mirrors tools/art palette). */
const BAND_TINTS = [0xd9a066, 0x8f563b, 0x663931, 0x45283c, 0x45283c, 0x323c39];
const bandAt = (rowY: number): number =>
  Math.max(0, Math.min(5, Math.floor(((rowY - SURFACE_ROW) / (WORLD_H - SURFACE_ROW)) * 6)));

const LIGHT_W = 275; // half-res light buffer, scaled ×2 over a 550×400 view
const LIGHT_H = 200;

/** Colour-blind mineral markers, indexed by tile id − 6 (Tile.MineralFirst); artifacts share ✦. */
const ORE_GLYPHS = ['Fe', 'Bz', 'Ag', 'Au', 'Pt', 'Es', 'Em', 'Ru', 'Di', 'Az', '✦', '✦', '✦', '✦'];

/** Live-tunable presentation options (mirrors the QoL settings that affect the play field). */
export interface FxOptions {
  screenShake: boolean;
  gasHint: boolean;
  fxFull: boolean;
  damageFlash: boolean;
  pixelPerfect: boolean;
  oreGlyphs: boolean;
  ambientLife: boolean;
}

export class GameScene extends Phaser.Scene {
  private host!: SimHost;
  private audio!: AudioBus;
  private tiles!: TileRenderer;
  /** The LOCAL player's view — camera target and anchor for full-fat FX. */
  private pod!: PodView;
  /** One view per pod (co-op); index-aligned with state.pods. */
  private podViews: PodView[] = [];
  private localIdx = 0;
  private boss!: BossView;
  private critterView!: CritterView;
  private fauna!: FaunaLayer;
  private ambientLife = true;
  private fxFull = true;

  private lightImg!: Phaser.GameObjects.Image;
  private skyImg!: Phaser.GameObjects.Image;
  private vignette!: Phaser.GameObjects.Image;
  private vignetteAlpha = 0;
  private headGlow!: Phaser.GameObjects.Image;
  private thrustGlow!: Phaser.GameObjects.Image;
  private stars!: Phaser.GameObjects.Group;

  private debrisE!: Phaser.GameObjects.Particles.ParticleEmitter;
  private thrustE!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeE!: Phaser.GameObjects.Particles.ParticleEmitter;
  private motesE!: Phaser.GameObjects.Particles.ParticleEmitter;
  private embersE!: Phaser.GameObjects.Particles.ParticleEmitter;

  private chargeSprites: Phaser.GameObjects.Sprite[] = [];
  private crackSprites: Phaser.GameObjects.Sprite[] = [];
  private digFxTimer = 0;
  /** Per-pod face of the block being drilled (held visually until dig end). */
  private digHoldTiles: number[] = [];
  private guardianSprite: Phaser.GameObjects.Sprite | null = null;
  private guardianHalo: Phaser.GameObjects.Image | null = null;
  private screenShake = true;
  private damageFlash = true;
  /** QoL gas-shimmer setting (the Seismic Scanner relic ORs on top per frame). */
  private gasHintOpt = false;
  private pixelPerfect = true;
  private oreGlyphs = false;
  /** Play the carrier-landing cinematic on the first frame (fresh story runs only). */
  private introPending = false;
  /** Viewport-culled colour-blind glyph pool for on-screen minerals. */
  private glyphs: Phaser.GameObjects.Text[] = [];
  /** Viewport-culled tunnel-corner softeners (fillets + chamfers). */
  private corners: Phaser.GameObjects.Image[] = [];
  private emberTimer = 0;
  private audioTimer = 0;

  constructor() {
    super('game');
  }

  init(data: {
    host: SimHost;
    audio: AudioBus;
    screenShake: boolean;
    gasHint: boolean;
    fxFull?: boolean;
    damageFlash?: boolean;
    pixelPerfect?: boolean;
    oreGlyphs?: boolean;
    ambientLife?: boolean;
    intro?: boolean;
    localPlayer?: number;
  }): void {
    this.host = data.host;
    this.localIdx = data.localPlayer ?? 0;
    this.audio = data.audio;
    this.screenShake = data.screenShake;
    this.fxFull = data.fxFull ?? true;
    this.damageFlash = data.damageFlash ?? true;
    this.pixelPerfect = data.pixelPerfect ?? true;
    this.oreGlyphs = data.oreGlyphs ?? false;
    this.ambientLife = data.ambientLife ?? true;
    this.introPending = data.intro ?? false;
  }

  /** Push live QoL/FX changes into the running scene (called by App.applySettings). */
  applyFx(opts: FxOptions): void {
    this.screenShake = opts.screenShake;
    this.fxFull = opts.fxFull;
    this.damageFlash = opts.damageFlash;
    this.oreGlyphs = opts.oreGlyphs;
    this.gasHintOpt = opts.gasHint;
    this.ambientLife = opts.ambientLife;
    if (this.fauna) this.fauna.enabled = opts.ambientLife && opts.fxFull;
    this.tiles?.setGasHint(opts.gasHint);
    this.setPixelPerfect(opts.pixelPerfect);
    if (!opts.oreGlyphs) for (const g of this.glyphs) g.setVisible(false);
  }

  private setPixelPerfect(on: boolean): void {
    this.pixelPerfect = on;
    this.cameras.main?.setRoundPixels(on);
    // The Phaser texture filter is fixed at boot; rounding responds live.
    if (this.game.canvas) this.game.canvas.style.imageRendering = on ? 'pixelated' : 'auto';
  }

  get state(): GameState {
    return this.host.state;
  }

  /** Dev tool: full terrain repaint after out-of-band world edits (teleports). */
  repaintWorld(): void {
    this.tiles.repaintAll();
  }

  private canvasTex(key: string, w: number, h: number): Phaser.Textures.CanvasTexture {
    if (this.textures.exists(key)) return this.textures.get(key) as Phaser.Textures.CanvasTexture;
    return this.textures.createCanvas(key, w, h)!;
  }

  create(data: { gasHint: boolean }): void {
    const s = this.state;
    this.glyphs = []; // scene shutdown destroyed the old pools; drop stale refs
    this.corners = [];

    // --- sky gradient (canvas strip, stretched full-screen, behind everything) ---
    const skyTex = this.canvasTex('skyTex', 1, 64);
    this.skyImg = this.add.image(0, 0, 'skyTex').setOrigin(0).setScrollFactor(0).setDepth(-12);
    this.skyImg.setDisplaySize(this.scale.width, this.scale.height);
    void skyTex;

    // --- star field (parallax, only visible up high) ---
    this.stars = this.add.group();
    for (let i = 0; i < 80; i++) {
      const star = this.add.image(
        Math.random() * WORLD_W * TILE_PX * 2 - WORLD_W * TILE_PX * 0.5,
        -(400 + Math.random() * 90_000),
        'atlas',
        'mote',
      );
      star.setScrollFactor(0.5).setDepth(-11).setBlendMode(Phaser.BlendModes.ADD);
      star.setAlpha(0.4 + Math.random() * 0.6);
      this.stars.add(star);
    }

    this.tiles = new TileRenderer(this, s);
    this.tiles.create();
    this.gasHintOpt = data.gasHint ?? false;
    this.tiles.setGasHint(this.gasHintOpt);
    this.time.addEvent({ delay: 166, loop: true, callback: () => this.tiles.cycle() });

    // Surface buildings.
    BUILDINGS.forEach((b, i) => {
      const x = ((b.colStart + b.colEnd + 1) / 2) * TILE_PX;
      const y = SURFACE_ROW * TILE_PX;
      this.add.sprite(x, y, 'atlas', `building${i}`).setOrigin(0.5, 1).setDepth(5);
    });

    this.podViews = s.pods.map((_, i) => new PodView(this, s, i));
    for (const v of this.podViews) v.create();
    this.pod = this.podViews[this.localIdx] ?? this.podViews[0];
    this.boss = new BossView(this, s);
    this.critterView = new CritterView(this, s);
    this.fauna = new FaunaLayer(this, s);
    this.fauna.enabled = this.ambientLife && this.fxFull;

    // Hole-bite overlays, one per pod (above terrain, below the pods).
    this.crackSprites = s.pods.map(() =>
      this.add.sprite(0, 0, 'atlas', 'bite_down0').setDepth(6).setVisible(false),
    );
    this.digHoldTiles = s.pods.map(() => Tile.Air);

    // --- glows ---
    this.headGlow = this.add
      .image(0, 0, 'atlas', 'glow64')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffe0a0)
      .setAlpha(0.22)
      .setScale(3.4)
      .setDepth(9);
    this.thrustGlow = this.add
      .image(0, 0, 'atlas', 'glow32')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffa030)
      .setAlpha(0)
      .setScale(1.6)
      .setDepth(11);

    // --- particles ---
    this.debrisE = this.add.particles(0, 0, 'atlas', {
      frame: ['dust0', 'dust1', 'dust2'],
      speed: { min: 50, max: 170 },
      angle: { min: 200, max: 340 },
      gravityY: 420,
      lifespan: { min: 260, max: 520 },
      scale: { start: 1.1, end: 0.4 },
      alpha: { start: 1, end: 0.2 },
      emitting: false,
    });
    this.debrisE.setDepth(14);
    this.thrustE = this.add.particles(0, 0, 'atlas', {
      frame: 'spark',
      speedY: { min: 90, max: 160 },
      speedX: { min: -25, max: 25 },
      lifespan: { min: 160, max: 300 },
      scale: { start: 1.3, end: 0.3 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe066, 0xff9030, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.thrustE.setDepth(11);
    this.smokeE = this.add.particles(0, 0, 'atlas', {
      frame: 'smoke',
      speedY: { min: 30, max: 70 },
      speedX: { min: -18, max: 18 },
      lifespan: 650,
      scale: { start: 0.6, end: 1.6 },
      alpha: { start: 0.4, end: 0 },
      emitting: false,
    });
    this.smokeE.setDepth(10);
    this.motesE = this.add.particles(0, 0, 'atlas', {
      frame: 'mote',
      speed: { min: 4, max: 14 },
      lifespan: 4200,
      scale: { start: 1, end: 0.5 },
      alpha: { start: 0, end: 0.55, ease: 'Sine.InOut' },
      blendMode: Phaser.BlendModes.ADD,
      tint: 0xc8b090,
      frequency: 240,
      emitZone: {
        type: 'random',
        source: {
          getRandomPoint: (p) => {
            p.x = -140 + Math.random() * 280;
            p.y = -100 + Math.random() * 200;
          },
        },
      },
      emitting: false,
    });
    this.motesE.setDepth(12);
    this.embersE = this.add.particles(0, 0, 'atlas', {
      frame: 'spark',
      speedY: { min: -70, max: -30 },
      speedX: { min: -12, max: 12 },
      lifespan: { min: 700, max: 1200 },
      scale: { start: 1, end: 0.2 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffdd44, 0xff8022],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.embersE.setDepth(14);

    // --- darkness/light buffer + damage vignette ---
    this.canvasTex('lightTex', LIGHT_W, LIGHT_H);
    this.lightImg = this.add
      .image(0, 0, 'lightTex')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(40)
      .setScale(this.scale.width / LIGHT_W, this.scale.height / LIGHT_H);
    this.buildVignette();

    const cam = this.cameras.main;
    cam.setBounds(0, -100_000 * 4, WORLD_W * TILE_PX, 100_000 * 4 + WORLD_H * TILE_PX);
    cam.startFollow(this.pod.sprite, false, 0.12, 0.12);
    cam.setBackgroundColor(0x140c1c);
    this.setPixelPerfect(this.pixelPerfect);

    this.host.onEvent((e) => this.onSimEvent(e));

    if (this.introPending) {
      this.introPending = false;
      this.playLanding();
    }
  }

  /**
   * Intro cinematic: the orbital carrier descends with the pod slung under its
   * winch, sets it down at the spawn point, and climbs away. The sim stays
   * paused ('intro') throughout, so the first-tick transmission (and every
   * other scripted event) fires only after the carrier has left.
   * Any key or click skips.
   */
  private playLanding(): void {
    const p = this.state.pod;
    this.host.pause('intro');
    this.pod.sprite.setVisible(false);

    const DROP = 480; // start this far above the pad (well off-screen)
    const HANG = 52; // px from carrier centre to the slung pod's centre
    const ship = this.add.image(0, 0, 'atlas', 'carrier');
    const mkGlow = (x: number) =>
      this.add
        .image(x, 16, 'atlas', 'glow32')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffa030)
        .setAlpha(0.45)
        .setScale(1.1);
    const glowL = mkGlow(-24);
    const glowR = mkGlow(20);
    const carried = this.add.image(0, HANG, 'atlas', 'pod_idle');
    const rig = this.add
      .container(p.x, p.y - HANG - DROP, [glowL, glowR, ship, carried])
      .setDepth(11);
    if (this.fxFull) {
      this.tweens.add({
        targets: [glowL, glowR],
        alpha: { from: 0.3, to: 0.6 },
        duration: 90,
        yoyo: true,
        repeat: -1,
      });
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.tweens.killTweensOf([rig, glowL, glowR]);
      rig.destroy(); // children go with it
      this.pod.sprite.setVisible(true);
      this.host.resume('intro');
      window.removeEventListener('keydown', skip, true);
      window.removeEventListener('pointerdown', skip, true);
    };
    // Capture phase + stopPropagation: the skip press must not leak into
    // InputManager (Esc would open the pause menu, arrows would pre-load keys).
    const skip = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      finish();
    };
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
    this.events.once('shutdown', finish);

    this.audio.play('thrustLoop', 0.5);
    this.tweens.add({
      targets: rig,
      y: p.y - HANG,
      duration: 1900,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (done) return;
        // Touchdown: release the pod, kick up dust, then climb away.
        carried.destroy();
        this.pod.sprite.setVisible(true);
        this.debrisE.setParticleTint(BAND_TINTS[0]);
        this.debrisE.explode(10, p.x, p.y + 22);
        this.audio.play('landThump', 0.7);
        if (this.screenShake) this.cameras.main.shake(120, 0.004);
        this.tweens.add({
          targets: rig,
          y: p.y - HANG - DROP,
          delay: 450,
          duration: 1100,
          ease: 'Cubic.easeIn',
          onStart: () => this.audio.play('thrustLoop', 0.5),
          onComplete: finish,
        });
      },
    });
  }

  private buildVignette(): void {
    const w = 138;
    const h = 100;
    const tex = this.canvasTex('vignetteTex', w, h);
    const ctx = tex.context;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.72);
    g.addColorStop(0, 'rgba(217,87,99,0)');
    g.addColorStop(1, 'rgba(217,87,99,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
    this.vignette = this.add
      .image(0, 0, 'vignetteTex')
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(45)
      .setAlpha(0)
      .setScale(this.scale.width / w, this.scale.height / h);
  }

  private onSimEvent(e: SimEvent): void {
    switch (e.t) {
      case 'tileCleared': {
        const wx = e.x * TILE_PX + 25;
        const wy = e.y * TILE_PX + 25;
        this.debrisE.setParticleTint(BAND_TINTS[bandAt(e.y)]);
        this.debrisE.explode(e.cause === 'blast' ? 14 : 8, wx, wy);
        this.tiles.paint(e.x, e.y);
        break;
      }
      case 'collected': {
        const def = COLLECTIBLES[e.collectibleId];
        this.popup(
          `+$${saleValue(def.value, this.state.level).toLocaleString('en-US')}`,
          0xfbf236,
          this.podOf(e.player),
        );
        break;
      }
      case 'cargoFullLost':
        this.popup('LOST!', 0xd95763, this.podOf(e.player));
        break;
      case 'quake':
        this.tiles.repaintRows(e.rows);
        if (this.screenShake) this.cameras.main.shake(700, 0.012);
        break;
      case 'explosion': {
        if (!this.anims.exists('boomA')) {
          this.anims.create({
            key: 'boomA',
            frames: [0, 1, 2, 3, 4].map((i) => ({ key: 'atlas', frame: `boom${i}` })),
            frameRate: 20,
          });
        }
        const boom = this.add.sprite(e.x, e.y, 'atlas', 'boom0').setDepth(20);
        boom.play('boomA');
        boom.once('animationcomplete', () => boom.destroy());
        const glow = this.add
          .image(e.x, e.y, 'atlas', 'glow64')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xffcc55)
          .setScale(e.radiusTiles > 1 ? 4 : 2.4)
          .setDepth(19);
        this.tweens.add({
          targets: glow,
          alpha: 0,
          scale: glow.scale * 1.8,
          duration: 420,
          onComplete: () => glow.destroy(),
        });
        this.embersE.explode(e.radiusTiles > 1 ? 22 : 12, e.x, e.y);
        if (this.screenShake) this.cameras.main.shake(320, e.radiusTiles > 1 ? 0.02 : 0.01);
        break;
      }
      case 'gasIgnite': {
        const puff = this.add
          .sprite(e.x * TILE_PX + 25, e.y * TILE_PX + 25, 'atlas', 'gasPuff')
          .setDepth(20);
        this.tweens.add({
          targets: puff,
          alpha: 0,
          scale: 2.4,
          duration: 650,
          onComplete: () => puff.destroy(),
        });
        break;
      }
      case 'damage':
        this.viewOf(e.player).flashHurt();
        if (this.isLocal(e.player)) {
          this.vignetteAlpha = Math.min(0.75, this.vignetteAlpha + e.amount / 24);
          if (this.screenShake && e.amount >= 5) this.cameras.main.shake(220, 0.009);
        }
        break;
      case 'landed': {
        const who = this.podOf(e.player);
        if (e.impactVel > 4) {
          this.debrisE.setParticleTint(BAND_TINTS[bandAt(Math.floor(who.y / TILE_PX))]);
          this.debrisE.explode(Math.min(16, Math.round(e.impactVel * 1.2)), who.x, who.y + 22);
          // Impact squash — feel proportional to the hit (PodView restores itself).
          this.viewOf(e.player).squash(Math.min(1, e.impactVel / 16));
        }
        if (e.damage > 0 && this.screenShake && this.isLocal(e.player))
          this.cameras.main.shake(90, 0.002 + e.damage * 0.0006);
        break;
      }
      case 'chain': {
        // Rank colors escalate with the chain (DB32 ramp).
        const c =
          e.count >= 20
            ? 0x5fcde4
            : e.count >= 12
              ? 0x76428a
              : e.count >= 8
                ? 0xd95763
                : e.count >= 5
                  ? 0xdf7126
                  : 0xfbf236;
        this.popup(`×${e.count} CHAIN`, c);
        if (e.count >= 8 && this.screenShake) this.cameras.main.shake(110, 0.003);
        break;
      }
      case 'chainBroken':
        if (!e.banked && e.count >= 3) this.popup('CHAIN LOST', 0xd95763);
        break;
      case 'critterKilled':
        if (this.fxFull) this.embersE.explode(10, e.x, e.y);
        break;
      case 'heatWarning':
        // Overheat feedback: ember burst, plus a warm flash at the critical tier.
        if (this.fxFull)
          this.embersE.explode(e.level === 2 ? 18 : 8, this.state.pod.x, this.state.pod.y);
        if (e.level === 2 && this.damageFlash)
          this.vignetteAlpha = Math.max(this.vignetteAlpha, 0.5);
        break;
      case 'teleport':
      case 'rescue': {
        const who = this.podOf(e.player);
        const beam = this.add
          .sprite(who.x, who.y, 'atlas', 'teleBeam')
          .setDepth(30)
          .setBlendMode(Phaser.BlendModes.ADD);
        if (e.t === 'rescue') beam.setTint(0xd95763); // distress-red tow beam
        this.tweens.add({
          targets: beam,
          alpha: 0,
          scaleY: 2,
          duration: 520,
          onComplete: () => beam.destroy(),
        });
        break;
      }
      case 'guardianSpawned':
        this.guardianSprite = this.add.sprite(0, 0, 'atlas', 'guardian').setDepth(11);
        this.guardianHalo = this.add
          .image(0, 0, 'atlas', 'glow32')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xfff0a0)
          .setAlpha(0.5)
          .setDepth(10);
        break;
      case 'bossActivated':
        this.audio.playMusic('boss');
        this.audio.setBossForm(e.form);
        break;
      case 'bossReset':
        this.audio.playMusic('mine');
        this.boss.destroyAll();
        break;
      case 'victory':
        this.boss.destroyAll();
        break;
      case 'podExploded': {
        const who = this.podOf(e.player);
        const boom = this.add.sprite(who.x, who.y, 'atlas', 'boom2').setDepth(30);
        this.tweens.add({
          targets: boom,
          scale: 3.4,
          alpha: 0,
          duration: 900,
          onComplete: () => boom.destroy(),
        });
        this.embersE.explode(30, who.x, who.y);
        this.viewOf(e.player).sprite.setVisible(false);
        break;
      }
      case 'podDown': {
        // Co-op knockout: a boom at the fallen pod; the wipe (podExploded) has its own FX.
        const who = this.podOf(e.player);
        const boom = this.add.sprite(who.x, who.y, 'atlas', 'boom2').setDepth(30);
        this.tweens.add({
          targets: boom,
          scale: 2.6,
          alpha: 0,
          duration: 700,
          onComplete: () => boom.destroy(),
        });
        this.embersE.explode(18, who.x, who.y);
        if (this.isLocal(e.player) && this.screenShake) this.cameras.main.shake(300, 0.012);
        break;
      }
      case 'podRespawned': {
        const who = this.podOf(e.player);
        const beam = this.add
          .sprite(who.x, who.y, 'atlas', 'teleBeam')
          .setDepth(30)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: beam,
          alpha: 0,
          scaleY: 2,
          duration: 520,
          onComplete: () => beam.destroy(),
        });
        break;
      }
    }
    this.audio.onEvent(e);
  }

  /** Pod a pod-attributed event refers to (solo events omit player). */
  private podOf(player?: number) {
    return this.state.pods[player ?? 0] ?? this.state.pod;
  }

  private viewOf(player?: number): PodView {
    return this.podViews[player ?? 0] ?? this.pod;
  }

  private isLocal(player?: number): boolean {
    return (player ?? 0) === this.localIdx;
  }

  private popup(text: string, color: number, at?: { x: number; y: number }): void {
    const a = at ?? this.podOf(this.localIdx);
    const t = this.add
      .text(a.x, a.y - 30, text, {
        fontFamily: 'VT323, Courier New, monospace',
        fontSize: '16px',
        color: `#${color.toString(16).padStart(6, '0')}`,
        stroke: '#140c1c',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: t,
      y: t.y - 28,
      alpha: 0,
      duration: 750,
      ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    });
  }

  override update(_time: number, dtMs: number): void {
    this.host.update(dtMs);
    const alpha = this.host.alpha;
    const s = this.state;
    const lp = s.pods[this.localIdx] ?? s.pod;

    for (const v of this.podViews) v.update(alpha);
    this.boss.update(alpha);
    this.critterView.update();
    this.fauna.update();
    // Seismic Scanner relic: the gas shimmer turns on for the rest of the run.
    this.tiles.setGasHint(
      this.gasHintOpt ||
        (this.state.mode.kind === 'expedition' && lp.relics.includes('seismicScanner')),
    );

    // Charges.
    while (this.chargeSprites.length < s.charges.length) {
      this.chargeSprites.push(this.add.sprite(0, 0, 'atlas', 'icon1').setDepth(9).setScale(0.8));
    }
    while (this.chargeSprites.length > s.charges.length) this.chargeSprites.pop()?.destroy();
    s.charges.forEach((c, i) => {
      this.chargeSprites[i].setPosition(c.x, c.y + 14);
      this.chargeSprites[i].setVisible(Math.floor(c.fuse / 5) % 2 === 0);
    });

    // Guardian.
    if (this.guardianSprite) {
      const gi = s.pods.findIndex((p) => p.guardian);
      if (gi < 0) {
        this.guardianSprite.destroy();
        this.guardianHalo?.destroy();
        this.guardianSprite = null;
        this.guardianHalo = null;
      } else {
        const gv = this.podViews[gi] ?? this.pod;
        const gx = gv.sprite.x - 40;
        const gy = gv.sprite.y - 30 + Math.sin(this.time.now / 300) * 4;
        this.guardianSprite.setPosition(gx, gy);
        this.guardianHalo
          ?.setPosition(gx, gy - 14)
          .setAlpha(0.35 + 0.2 * Math.sin(this.time.now / 200));
      }
    }

    // Thrust FX + audio loops.
    const thrusting = lp.mode === 'air' && lp.fuel > 0 && this.host.paused === false;
    const inputUp = thrusting && lp.yVel < 2; // heuristic: actively climbing/hovering
    this.thrustE.setPosition(this.pod.sprite.x, this.pod.sprite.y + 24);
    this.smokeE.setPosition(this.pod.sprite.x, this.pod.sprite.y + 26);
    if (inputUp && !this.thrustE.emitting) {
      this.thrustE.start();
      if (this.fxFull) this.smokeE.start();
    } else if (!inputUp && this.thrustE.emitting) {
      this.thrustE.stop();
      this.smokeE.stop();
    }
    this.thrustGlow.setPosition(this.pod.sprite.x, this.pod.sprite.y + 26);
    this.thrustGlow.setAlpha(inputUp ? 0.35 + (this.fxFull ? Math.random() * 0.15 : 0) : 0);
    this.audio.setLoops(lp.mode === 'dig', inputUp);

    // --- drilling feedback: hole being carved, straining loop pitch, chip spray ---
    // The sim clears the cell early (authentic 15 px break), but the block
    // must READ solid for the whole dig: hold its face in the renderer and
    // pace the bite notch across the full traversal, so the hole opens up
    // exactly when the drilling time ends — at any drill speed. In co-op,
    // every pod gets its own hold + bite notch.
    const holds: Array<{ x: number; y: number; tile: number }> = [];
    s.pods.forEach((q, i) => {
      const jb = q.drilling;
      const spr = this.crackSprites[i];
      if (!spr) return;
      if (jb) {
        if (!jb.broken) this.digHoldTiles[i] = getTile(s.world, jb.targetX, jb.targetY);
        const held = this.digHoldTiles[i];
        if (held !== Tile.Air) holds.push({ x: jb.targetX, y: jb.targetY, tile: held });
        const bite = Math.min(1, jb.traveledPx / PHYSICS.digDonePx);
        spr
          .setPosition((jb.targetX + 0.5) * TILE_PX, (jb.targetY + 0.5) * TILE_PX)
          .setFrame(
            `bite_${jb.dir === 'down' ? 'down' : 'side'}${Math.min(3, Math.floor(bite * 4))}`,
          )
          .setFlipX(jb.dir === 'left') // side frames enter from the left face
          .setVisible(true);
      } else {
        spr.setVisible(false);
      }
    });
    this.tiles.setHolds(holds);
    const job = lp.drilling;
    if (job) {
      // The auger strains upward in pitch across the block, resetting per dig.
      const prog = Math.min(1, job.traveledPx / PHYSICS.digDonePx);
      this.audio.setDrillPitch(0.8 + 0.45 * prog + Math.sin(this.time.now / 60) * 0.02);
      this.digFxTimer += dtMs;
      if (this.digFxTimer > 70) {
        this.digFxTimer = 0;
        const dx = job.dir === 'down' ? 0 : job.dir === 'left' ? -1 : 1;
        const dy = job.dir === 'down' ? 1 : 0;
        const tipX = this.pod.sprite.x + dx * 26;
        const tipY = this.pod.sprite.y + dy * 26;
        this.debrisE.setParticleTint(BAND_TINTS[bandAt(job.targetY)]);
        this.debrisE.explode(this.fxFull ? 2 : 1, tipX, tipY);
        const target = getTile(s.world, job.targetX, job.targetY);
        if (this.fxFull && (isMineral(target) || isArtifact(target)) && Math.random() < 0.6) {
          this.embersE.explode(1, tipX, tipY); // the gem glints as it's cut
        }
      }
    }

    // Pod headlight glow (brighter as it gets darker).
    const depth = podDepthFt(lp);
    const darkness = Math.max(0, Math.min(0.86, (-depth / 7400) * 0.95));
    this.headGlow.setPosition(this.pod.sprite.x, this.pod.sprite.y);
    this.headGlow.setAlpha(
      0.08 + darkness * 0.3 + (this.fxFull ? Math.sin(this.time.now / 90) * 0.015 : 0),
    );

    // Ambient motes deep down (emit zone is baked into the emitter config).
    if (this.fxFull && darkness > 0.3) {
      if (!this.motesE.emitting) this.motesE.start();
      this.motesE.setPosition(this.pod.sprite.x, this.pod.sprite.y);
    } else if (this.motesE.emitting) {
      this.motesE.stop();
    }

    // Lava embers near the camera.
    this.emberTimer += dtMs;
    if (this.fxFull && this.emberTimer > 420) {
      this.emberTimer = 0;
      const cells = this.tiles.lavaCellsNear(this.pod.sprite.x, this.pod.sprite.y, 320);
      for (const c of cells.slice(0, 5)) {
        this.embersE.explode(1, (c.x + 0.3 + Math.random() * 0.4) * TILE_PX, c.y * TILE_PX + 3);
      }
    }

    // --- audio: score follows depth, ambient bed follows the world ---
    this.audio.setMusicDepth(depth);
    // Low-fuel heartbeat under 2 L (the sim's fuelLow threshold), racing toward 0.
    this.audio.setFuelPulse(s.outcome === 'active' && lp.fuel < 2 ? 1 - lp.fuel / 2 : null);
    this.audioTimer += dtMs;
    if (this.audioTimer > 150) {
      this.audioTimer = 0;
      // Reuse the ember query: how close is visible lava?
      const near = this.tiles.lavaCellsNear(this.pod.sprite.x, this.pod.sprite.y, 260);
      const lavaNear = Math.min(1, near.length / 4);
      const driving = lp.mode === 'ground' && Math.abs(lp.xVel) > 0.6;
      this.audio.ambience.update(depth, lavaNear, driving);
    }

    // Damage vignette decay — the red flash is owned by the damageFlash toggle.
    if (this.vignetteAlpha > 0) {
      this.vignetteAlpha = Math.max(0, this.vignetteAlpha - dtMs / 700);
      this.vignette.setAlpha(this.damageFlash ? this.vignetteAlpha : 0);
    }

    this.updateCorners();
    this.updateGlyphs();
    this.drawSky(depth);
    this.drawLight(depth, darkness);
  }

  /**
   * Round the void like the original: dug space is a union of rounded
   * rectangles, so outer corners of air cells get the full concave wedge —
   * an air quadrant at a grid intersection is rounded iff BOTH its
   * edge-adjacent quadrants are solid (any non-air tile). Inner (reflex)
   * corners — a lone solid quadrant among air — get a small cornerSoft wedge
   * in the diagonal quadrant, easing the angle without floating chips.
   * Straight walls get sparse, deterministic soil lumps to break the lines.
   */
  private updateCorners(): void {
    const cam = this.cameras.main;
    const w = this.state.world;
    // Cells being drilled are visually held solid until each dig ends —
    // sample them as their held face so wedges/lumps don't bloom early.
    const heldAt = new Map<number, number>();
    this.state.pods.forEach((q, i) => {
      const jb = q.drilling;
      const ht = this.digHoldTiles[i];
      if (jb && ht !== undefined && ht !== Tile.Air)
        heldAt.set(jb.targetY * WORLD_W + jb.targetX, ht);
    });
    const tileAt = (x: number, y: number): number =>
      heldAt.get(y * WORLD_W + x) ?? getTile(w, x, y);
    const R = 14; // full wedge size
    const R2 = 7; // soft inner-corner wedge size
    const x0 = Math.max(1, Math.floor(cam.scrollX / TILE_PX));
    const x1 = Math.min(WORLD_W - 1, Math.ceil((cam.scrollX + cam.width) / TILE_PX) + 1);
    // Underground only — a reflex wedge at a surface hole must not float in the sky.
    const y0 = Math.max(SURFACE_ROW + 1, Math.floor(cam.scrollY / TILE_PX));
    const y1 = Math.min(WORLD_H - 1, Math.ceil((cam.scrollY + cam.height) / TILE_PX) + 1);
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) {
      const band = bandAt(cy);
      for (let cx = x0; cx <= x1; cx++) {
        // Quadrants around the grid corner point (cx,cy): bit i set = solid.
        // Boulders are tracked separately: undrillable stone must keep its
        // hard machined silhouette — no rounding, no concave smoothing.
        let solidMask = 0;
        let boulderMask = 0;
        let solidCount = 0;
        for (let i = 0; i < 4; i++) {
          const qt = tileAt(cx - 1 + (i & 1), cy - 1 + (i >> 1));
          if (qt !== Tile.Air) {
            solidMask |= 1 << i;
            solidCount++;
            if (isBoulder(qt)) boulderMask |= 1 << i;
          }
        }
        if (solidCount === 0 || solidCount === 4) continue;
        if (solidCount === 1) {
          // Lone solid corner (pillar/inner turn): round the square's OWN tip —
          // a cave-colored wedge over the tile corner cuts it round in place.
          if (solidMask & boulderMask) continue; // boulders stay square
          const j = [1, 2, 4, 8].indexOf(solidMask); // the solid quadrant itself
          const img = this.cornerAt(n++);
          img.setFrame('cornerCut');
          img.setPosition(cx * TILE_PX - (j & 1 ? 0 : R2), cy * TILE_PX - (j & 2 ? 0 : R2));
          img.setFlip(!(j & 1), !(j & 2)); // mass hugs the grid point, arc into the tile
          img.setVisible(true);
          continue;
        }
        for (let i = 0; i < 4; i++) {
          if (solidMask & (1 << i)) continue; // must be air
          if (!(solidMask & (1 << (i ^ 1))) || !(solidMask & (1 << (i ^ 2)))) continue;
          // The wedge visually extends the two solids flanking the air corner —
          // if either is a boulder, smoothing would soften its edge: skip.
          if (boulderMask & ((1 << (i ^ 1)) | (1 << (i ^ 2)))) continue;
          const img = this.cornerAt(n++);
          img.setFrame(`cornerRound_p${band}`);
          img.setPosition(cx * TILE_PX - (i & 1 ? 0 : R), cy * TILE_PX - (i & 2 ? 0 : R));
          img.setFlip(!(i & 1), !(i & 2)); // authored hugging TL; mirror into place
          img.setVisible(true);
        }
      }
    }

    // Wall roughness: low asymmetric soil lumps along straight tunnel edges,
    // chosen by a stable coordinate hash so they never flicker (underground
    // only). Small mounds dominate; long ridges / tiny pebbles / odd shapes
    // (v5+) appear rarely via the weighted pick table. Long ridges use tighter
    // end margins — overlapping a corner wedge is harmless (same soil texture).
    const LUMP_LEN = [12, 8, 14, 10, 16, 26, 30, 5, 4, 18, 14];
    const LUMP_PICK = [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 2, 4, 1, 3, 5, 6, 7, 8, 7, 8, 9, 10];
    const tx0 = Math.max(0, Math.floor(cam.scrollX / TILE_PX));
    const tx1 = Math.min(WORLD_W - 1, Math.ceil((cam.scrollX + cam.width) / TILE_PX));
    for (let ty = y0; ty <= y1; ty++) {
      const band = bandAt(ty);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tileAt(tx, ty) !== Tile.Air) continue;
        for (let side = 0; side < 4; side++) {
          const nx = tx + (side === 2 ? -1 : side === 3 ? 1 : 0);
          const ny = ty + (side === 0 ? -1 : side === 1 ? 1 : 0);
          const wall = tileAt(nx, ny);
          if (wall === Tile.Air) continue;
          if (isBoulder(wall)) continue; // soil lumps never grow on machined stone
          const h = ((tx * 73856093) ^ (ty * 19349663) ^ ((side + 1) * 83492791)) >>> 0;
          if (h % 100 >= 68) continue; // ~68% of wall faces get one lump
          const v = LUMP_PICK[h % LUMP_PICK.length];
          const len = LUMP_LEN[v];
          const m = len >= 20 ? 6 : 15; // long ridges get tighter end margins
          const off = m + ((h >> 4) % Math.max(1, TILE_PX - len - 2 * m));
          const img = this.cornerAt(n++);
          if (side < 2) {
            img.setFrame(`edgeLump${v}_p${band}`);
            img.setPosition(tx * TILE_PX + off, side === 0 ? ty * TILE_PX : (ty + 1) * TILE_PX - 5);
            img.setFlip(false, side === 1);
          } else {
            img.setFrame(`edgeLumpV${v}_p${band}`);
            img.setPosition(side === 2 ? tx * TILE_PX : (tx + 1) * TILE_PX - 5, ty * TILE_PX + off);
            img.setFlip(side === 3, false);
          }
          img.setVisible(true);
        }
      }
    }
    for (let i = n; i < this.corners.length; i++) this.corners[i].setVisible(false);
  }

  private cornerAt(i: number): Phaser.GameObjects.Image {
    let img = this.corners[i];
    if (!img) {
      img = this.add.image(0, 0, 'atlas', 'cornerRound_p0').setOrigin(0).setDepth(1);
      this.corners[i] = img;
    }
    return img;
  }

  /** Colour-blind ore glyphs: pooled labels over on-screen minerals only. */
  private updateGlyphs(): void {
    // The expedition surveyor module forces glyphs on (modules are fixed per run).
    const survey = this.state.mode.kind === 'expedition' && hasSurveyor(this.state.pod);
    if (!this.oreGlyphs && !survey) return; // pool is hidden by applyFx when toggled off
    const cam = this.cameras.main;
    const x0 = Math.max(0, Math.floor(cam.scrollX / TILE_PX));
    const x1 = Math.min(WORLD_W - 1, Math.ceil((cam.scrollX + cam.width) / TILE_PX));
    const y0 = Math.max(0, Math.floor(cam.scrollY / TILE_PX));
    const y1 = Math.min(WORLD_H - 1, Math.ceil((cam.scrollY + cam.height) / TILE_PX));
    let n = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = getTile(this.state.world, x, y);
        if (!isMineral(t) && !isArtifact(t)) continue;
        const g = this.glyphAt(n++);
        g.setText(ORE_GLYPHS[t - 6] ?? '✦');
        g.setPosition(x * TILE_PX + TILE_PX / 2, y * TILE_PX + TILE_PX / 2);
        g.setVisible(true);
      }
    }
    for (let i = n; i < this.glyphs.length; i++) this.glyphs[i].setVisible(false);
  }

  private glyphAt(i: number): Phaser.GameObjects.Text {
    let g = this.glyphs[i];
    if (!g) {
      g = this.add
        .text(0, 0, '', {
          fontFamily: 'VT323, Courier New, monospace',
          fontSize: '15px',
          color: '#140c1c',
          stroke: '#ffffff',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(8);
      this.glyphs[i] = g;
    }
    return g;
  }

  /** Sky gradient + day/night tint + stars fading in with altitude. */
  private drawSky(depth: number): void {
    const vis = depth > -300;
    this.skyImg.setVisible(vis);
    let starAlpha = 0;
    if (vis) {
      const alt = Math.max(0, depth);
      const space = Math.min(1, alt / 18_000); // toward space
      // day/night from the sim clock (deterministic)
      const day =
        0.5 +
        0.5 * Math.sin(((this.state.tick % DAY_LENGTH_TICKS) / DAY_LENGTH_TICKS) * Math.PI * 2);
      const tex = this.textures.get('skyTex') as Phaser.Textures.CanvasTexture;
      const ctx = tex.context;
      for (let i = 0; i < 64; i++) {
        const tRow = i / 64;
        const r = (26 + 100 * (1 - tRow) * day) * (1 - space);
        const g = (14 + 48 * (1 - tRow) * day) * (1 - space);
        const b = (30 + 36 * (1 - tRow) * day) * (1 - space) + 8;
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(0, i, 1, 1);
      }
      tex.refresh();
      starAlpha = Math.max(space, (1 - day) * 0.5);
    }
    this.stars.setAlpha(starAlpha);
    this.stars.setVisible(vis && starAlpha > 0.02);
  }

  /** Smooth darkness with a radial pod light; red pulse in the arena. */
  private drawLight(depth: number, darkness: number): void {
    const inArena = depth <= ALTIMETER_ARENA_FT;
    const tex = this.textures.get('lightTex') as Phaser.Textures.CanvasTexture;
    const ctx = tex.context;
    ctx.clearRect(0, 0, LIGHT_W, LIGHT_H);
    const dark = inArena ? 0.5 + 0.08 * Math.sin(this.time.now / 500) : darkness;
    if (dark <= 0.02) {
      tex.refresh();
      this.lightImg.setVisible(false);
      return;
    }
    this.lightImg.setVisible(true);
    ctx.fillStyle = inArena ? `rgba(38,6,6,${dark})` : `rgba(2,1,6,${dark})`;
    ctx.fillRect(0, 0, LIGHT_W, LIGHT_H);
    // Punch each pod's headlight out of the darkness (local pod gets the full beam).
    const cam = this.cameras.main;
    const flick = this.fxFull ? Math.sin(this.time.now / 70) * 1.2 : 0;
    ctx.globalCompositeOperation = 'destination-out';
    this.podViews.forEach((v, i) => {
      if (!v.sprite.visible) return;
      const px = ((v.sprite.x - cam.scrollX) / this.scale.width) * LIGHT_W;
      const py = ((v.sprite.y - cam.scrollY) / this.scale.height) * LIGHT_H;
      const radius = (i === this.localIdx ? 62 : 44) + flick + (1 - dark) * 24;
      if (px < -radius || px > LIGHT_W + radius || py < -radius || py > LIGHT_H + radius) return;
      const g = ctx.createRadialGradient(px, py, 6, px, py, radius);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    tex.refresh();
  }
}
