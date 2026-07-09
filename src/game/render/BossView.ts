import { type GameState, TILE_PX } from '@core/index';
/** Boss + projectiles + laser telegraph rendering. */
import type Phaser from 'phaser';

export class BossView {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private laser: Phaser.GameObjects.Graphics | null = null;
  private fireballs: Phaser.GameObjects.Sprite[] = [];
  private hpBar: Phaser.GameObjects.Graphics | null = null;

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
      this.sprite.setOrigin(0.5, 0.93);
      this.sprite.setDepth(9);
      this.laser = this.scene.add.graphics().setDepth(8);
      this.hpBar = this.scene.add.graphics().setDepth(50).setScrollFactor(0);
    }
    const x = b.prevX + (b.x - b.prevX) * alpha;
    const y = b.prevY + (b.y - b.prevY) * alpha + TILE_PX / 2;
    this.sprite.setTexture('atlas', `boss${b.form}_${b.phase === 'attack' ? 'b' : 'a'}`);
    this.sprite.setPosition(x, y);
    this.sprite.setFlipX(b.facing === 1);
    this.sprite.setAlpha(b.phase === 'transition' || b.phase === 'dead' ? 0.4 : 1);

    // Laser sweep visual.
    this.laser!.clear();
    if (b.currentAttack === 'laserSweep' && (b.phase === 'attack' || b.phase === 'telegraph')) {
      const len = 1200;
      const a = b.laserAngle;
      const color = b.phase === 'attack' ? 0xd95763 : 0x847e87;
      this.laser!.lineStyle(b.phase === 'attack' ? 5 : 2, color, 0.9);
      this.laser!.lineBetween(x, y - 90, x + Math.cos(a) * len, y - 90 + Math.sin(a) * len);
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

    // HP bar (fixed to camera).
    const cam = this.scene.cameras.main;
    const w = cam.width * 0.6;
    const maxHp = b.form === 1 ? 1000 * this.state.level : 2000 * this.state.level;
    this.hpBar!.clear();
    this.hpBar!.fillStyle(0x222034, 0.8).fillRect(cam.width * 0.2, 16, w, 14);
    this.hpBar!.fillStyle(b.form === 1 ? 0xd95763 : 0xdf7126, 1).fillRect(
      cam.width * 0.2 + 2,
      18,
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
    for (const f of this.fireballs) f.destroy();
    this.fireballs.length = 0;
  }
}
