import { type GameState, TILE_PX } from '@core/index';
/** Boss + projectiles + laser telegraph rendering. */
import Phaser from 'phaser';

export class BossView {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private laser: Phaser.GameObjects.Graphics | null = null;
  private fireballs: Phaser.GameObjects.Sprite[] = [];
  private hpBar: Phaser.GameObjects.Graphics | null = null;
  private furnaceGlow: Phaser.GameObjects.Image | null = null;

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
  ) {}

  update(alpha: number): void {
    const b = this.state.boss;
    if (!b) {
      this.destroyAll();
      return;
    }
    if (!this.sprite) {
      this.sprite = this.scene.add.sprite(b.x, b.y, 'atlas', `boss${b.form}_a`);
      this.sprite.setOrigin(0.5, 1); // feet-anchored: he stands ON the arena floor
      this.sprite.setDepth(9);
      this.laser = this.scene.add.graphics().setDepth(8);
      this.hpBar = this.scene.add.graphics().setDepth(50).setScrollFactor(0);
    }
    // Sim anchor is one tile above the floor top; +TILE_PX puts the feet on it.
    const x = b.prevX + (b.x - b.prevX) * alpha;
    const y = b.prevY + (b.y - b.prevY) * alpha + TILE_PX;
    this.sprite.setTexture('atlas', `boss${b.form}_${b.phase === 'attack' ? 'b' : 'a'}`);
    this.sprite.setPosition(x, y);
    this.sprite.setFlipX(b.facing === 1);
    this.sprite.setAlpha(b.phase === 'transition' || b.phase === 'dead' ? 0.4 : 1);

    // Laser sweep visual — wide additive bloom under a hot core line.
    this.laser!.clear();
    if (b.currentAttack === 'laserSweep' && (b.phase === 'attack' || b.phase === 'telegraph')) {
      const len = 1200;
      const a = b.laserAngle;
      const ex = x + Math.cos(a) * len;
      const ey = y - 90 + Math.sin(a) * len;
      if (b.phase === 'attack') {
        this.laser!.setBlendMode(Phaser.BlendModes.ADD);
        this.laser!.lineStyle(16, 0xd95763, 0.16);
        this.laser!.lineBetween(x, y - 90, ex, ey);
        this.laser!.lineStyle(7, 0xd95763, 0.5);
        this.laser!.lineBetween(x, y - 90, ex, ey);
        this.laser!.lineStyle(2, 0xffffff, 1);
        this.laser!.lineBetween(x, y - 90, ex, ey);
      } else {
        this.laser!.setBlendMode(Phaser.BlendModes.NORMAL);
        this.laser!.lineStyle(2, 0x847e87, 0.7);
        this.laser!.lineBetween(x, y - 90, ex, ey);
      }
    }

    // Furnace-heart glow on form 2.
    if (b.form === 2) {
      if (!this.furnaceGlow) {
        this.furnaceGlow = this.scene.add
          .image(0, 0, 'atlas', 'glow32')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xffcc44)
          .setDepth(9);
      }
      this.furnaceGlow
        .setPosition(x - b.facing * 4, y - 88)
        .setAlpha(0.35 + 0.18 * Math.sin(this.scene.time.now / 220))
        .setScale(2.2);
    } else if (this.furnaceGlow) {
      this.furnaceGlow.destroy();
      this.furnaceGlow = null;
    }

    // Fireballs.
    const prs = this.state.projectiles;
    while (this.fireballs.length < prs.length) {
      this.fireballs.push(this.scene.add.sprite(0, 0, 'atlas', 'fireball').setDepth(9));
    }
    while (this.fireballs.length > prs.length) this.fireballs.pop()?.destroy();
    prs.forEach((pr, i) => {
      const fx = pr.prevX + (pr.x - pr.prevX) * alpha;
      const fy = pr.prevY + (pr.y - pr.prevY) * alpha;
      this.fireballs[i].setPosition(fx, fy);
    });

    // HP bar (fixed to camera) — bottom of the stage per the original (24, 349),
    // clear of the DOM HUD that owns the top edge. The camera zooms
    // scrollFactor(0) objects about the viewport centre, so counter-scale the
    // graphics by 1/zoom and offset its origin — the bar then draws in screen px.
    const cam = this.scene.cameras.main;
    const z = cam.zoom;
    this.hpBar!.setScale(1 / z).setPosition(
      (cam.width / 2) * (1 - 1 / z),
      (cam.height / 2) * (1 - 1 / z),
    );
    const barX = 24;
    const barY = cam.height - 51;
    const w = cam.width - 48;
    const maxHp = b.form === 1 ? 1000 * this.state.level : 2000 * this.state.level;
    this.hpBar!.clear();
    this.hpBar!.fillStyle(0x222034, 0.8).fillRect(barX, barY, w, 14);
    this.hpBar!.fillStyle(b.form === 1 ? 0xd95763 : 0xdf7126, 1).fillRect(
      barX + 2,
      barY + 2,
      Math.max(0, (w - 4) * (b.hp / maxHp)),
      10,
    );
  }

  destroyAll(): void {
    this.sprite?.destroy();
    this.sprite = null;
    this.laser?.destroy();
    this.laser = null;
    this.hpBar?.destroy();
    this.hpBar = null;
    this.furnaceGlow?.destroy();
    this.furnaceGlow = null;
    for (const f of this.fireballs) f.destroy();
    this.fireballs.length = 0;
  }
}
