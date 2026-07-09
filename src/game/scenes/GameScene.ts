import {
  ALTIMETER_ARENA_FT,
  BUILDINGS,
  type GameState,
  SURFACE_ROW,
  type SimEvent,
  TILE_PX,
  WORLD_H,
  WORLD_W,
  podDepthFt,
} from '@core/index';
/**
 * Composition root of the play field: tile layers, pod, boss, buildings,
 * charges, guardian, sky gradient, depth darkness, camera, particles, shake.
 * The boss arena is just world rows — no scene seam.
 */
import Phaser from 'phaser';
import type { GameHost } from '../GameHost';
import type { AudioBus } from '../audio/AudioBus';
import { BossView } from '../render/BossView';
import { PodView } from '../render/PodView';
import { TileRenderer } from '../render/TileRenderer';

export class GameScene extends Phaser.Scene {
  private host!: GameHost;
  private audio!: AudioBus;
  private tiles!: TileRenderer;
  private pod!: PodView;
  private boss!: BossView;
  private darkness!: Phaser.GameObjects.Graphics;
  private sky!: Phaser.GameObjects.Graphics;
  private chargeSprites: Phaser.GameObjects.Sprite[] = [];
  private guardianSprite: Phaser.GameObjects.Sprite | null = null;
  private screenShake = true;

  constructor() {
    super('game');
  }

  init(data: { host: GameHost; audio: AudioBus; screenShake: boolean; gasHint: boolean }): void {
    this.host = data.host;
    this.audio = data.audio;
    this.screenShake = data.screenShake;
  }

  get state(): GameState {
    return this.host.state;
  }

  create(data: { gasHint: boolean }): void {
    const s = this.state;
    // Sky backdrop (fixed to camera, tinted by altitude/day in update).
    this.sky = this.add.graphics().setDepth(-10).setScrollFactor(0);

    this.tiles = new TileRenderer(this, s);
    this.tiles.create();
    this.tiles.setGasHint(data.gasHint ?? false);

    // Surface buildings.
    BUILDINGS.forEach((b, i) => {
      const x = ((b.colStart + b.colEnd + 1) / 2) * TILE_PX;
      const y = SURFACE_ROW * TILE_PX;
      this.add.sprite(x, y, 'atlas', `building${i}`).setOrigin(0.5, 1).setDepth(5);
    });

    this.pod = new PodView(this, s);
    this.pod.create();
    this.boss = new BossView(this, s);

    this.darkness = this.add.graphics().setDepth(40).setScrollFactor(0);

    const cam = this.cameras.main;
    cam.setBounds(0, -100_000 * 4, WORLD_W * TILE_PX, 100_000 * 4 + WORLD_H * TILE_PX);
    cam.startFollow(this.pod.sprite, false, 0.12, 0.12);
    cam.setBackgroundColor(0x140c1c);

    this.host.onEvent((e) => this.onSimEvent(e));
  }

  private onSimEvent(e: SimEvent): void {
    switch (e.t) {
      case 'tileCleared':
        this.tiles.paint(e.x, e.y);
        this.puff(e.x * TILE_PX + 25, e.y * TILE_PX + 25, e.cause === 'blast' ? 8 : 4);
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
            frameRate: 18,
          });
        }
        const boom = this.add.sprite(e.x, e.y, 'atlas', 'boom0').setDepth(20);
        boom.play('boomA');
        boom.once('animationcomplete', () => boom.destroy());
        if (this.screenShake) this.cameras.main.shake(300, e.radiusTiles > 1 ? 0.02 : 0.01);
        break;
      }
      case 'gasIgnite': {
        const puff = this.add
          .sprite(e.x * TILE_PX + 25, e.y * TILE_PX + 25, 'atlas', 'gasPuff')
          .setDepth(20);
        this.tweens.add({
          targets: puff,
          alpha: 0,
          scale: 2.2,
          duration: 600,
          onComplete: () => puff.destroy(),
        });
        break;
      }
      case 'damage':
        this.pod.flashHurt();
        if (this.screenShake && e.amount >= 5) this.cameras.main.shake(200, 0.008);
        break;
      case 'teleport': {
        const beam = this.add
          .sprite(this.state.pod.x, this.state.pod.y, 'atlas', 'teleBeam')
          .setDepth(30);
        this.tweens.add({
          targets: beam,
          alpha: 0,
          duration: 500,
          onComplete: () => beam.destroy(),
        });
        break;
      }
      case 'guardianSpawned':
        this.guardianSprite = this.add.sprite(0, 0, 'atlas', 'guardian').setDepth(11);
        break;
      case 'bossReset':
      case 'victory':
        this.boss.destroyAll();
        break;
      case 'podExploded': {
        const boom = this.add
          .sprite(this.state.pod.x, this.state.pod.y, 'atlas', 'boom2')
          .setDepth(30);
        this.tweens.add({
          targets: boom,
          scale: 3,
          alpha: 0,
          duration: 900,
          onComplete: () => boom.destroy(),
        });
        this.pod.sprite.setVisible(false);
        break;
      }
    }
    this.audio.onEvent(e);
  }

  private puff(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const d = this.add.sprite(x, y, 'atlas', `dust${i % 3}`).setDepth(15);
      this.tweens.add({
        targets: d,
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 60 - 15,
        alpha: 0,
        duration: 380,
        onComplete: () => d.destroy(),
      });
    }
  }

  override update(_time: number, dtMs: number): void {
    this.host.update(dtMs);
    const alpha = this.host.alpha;
    const s = this.state;

    this.pod.update(alpha);
    this.boss.update(alpha);

    // Charges.
    while (this.chargeSprites.length < s.charges.length) {
      this.chargeSprites.push(this.add.sprite(0, 0, 'atlas', 'icon1').setDepth(9).setScale(0.8));
    }
    while (this.chargeSprites.length > s.charges.length) this.chargeSprites.pop()?.destroy();
    s.charges.forEach((c, i) => {
      this.chargeSprites[i].setPosition(c.x, c.y + 14);
      this.chargeSprites[i].setVisible(Math.floor(c.fuse / 5) % 2 === 0);
    });

    // Guardian hovers beside the pod.
    if (this.guardianSprite) {
      if (!s.pod.guardian) {
        this.guardianSprite.destroy();
        this.guardianSprite = null;
      } else {
        this.guardianSprite.setPosition(
          this.pod.sprite.x - 40,
          this.pod.sprite.y - 30 + Math.sin(this.time.now / 300) * 4,
        );
      }
    }

    // Audio loops from state.
    this.audio.setLoops(s.pod.mode === 'dig', s.pod.mode === 'air' && s.pod.fuel > 0);

    this.drawSkyAndDarkness();
  }

  private drawSkyAndDarkness(): void {
    const cam = this.cameras.main;
    const depth = podDepthFt(this.state.pod);
    // Sky: only meaningful above/near the surface.
    this.sky.clear();
    if (depth > -300) {
      const alt = Math.max(0, depth);
      const fade = Math.min(1, alt / 20_000); // toward space
      const r = Math.floor(0x8f * (1 - fade) * 0.6 + 10);
      const g = Math.floor(0x56 * (1 - fade) * 0.6 + 8);
      const b = Math.floor(0x3b * (1 - fade) * 0.7 + 18);
      this.sky.fillStyle(Phaser.Display.Color.GetColor(r, g, b), 1);
      this.sky.fillRect(0, 0, cam.width, cam.height);
    }
    // Depth darkness with a light hole around the pod.
    this.darkness.clear();
    const inArena = depth <= ALTIMETER_ARENA_FT;
    let dark = Math.max(0, Math.min(0.82, (-depth / 7400) * 0.9));
    if (inArena) dark = 0.35; // hell glows
    if (dark > 0.02) {
      const px = this.pod.sprite.x - cam.scrollX;
      const py = this.pod.sprite.y - cam.scrollY;
      const step = 26;
      for (let gy = 0; gy < cam.height; gy += step) {
        for (let gx = 0; gx < cam.width; gx += step) {
          const d = Math.hypot(gx + step / 2 - px, gy + step / 2 - py);
          const a = Math.max(0, Math.min(1, (d - 120) / 260)) * dark;
          if (a > 0.03) {
            this.darkness.fillStyle(inArena ? 0x300a0a : 0x000000, a);
            this.darkness.fillRect(gx, gy, step, step);
          }
        }
      }
    }
  }
}
