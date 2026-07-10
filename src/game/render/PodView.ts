import { type GameState, maxHull } from '@core/index';
/** Pod sprite — reads interpolated sim state; animation from pod mode/inputs. */
import type Phaser from 'phaser';

export class PodView {
  sprite!: Phaser.GameObjects.Sprite;
  private scuff!: Phaser.GameObjects.Image;
  private animTick = 0;
  private squashT = 0;

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
  ) {}

  create(): void {
    this.sprite = this.scene.add.sprite(this.state.pod.x, this.state.pod.y, 'atlas', 'pod_idle');
    // Frames are 56px tall but the body occupies rows 0-49 (the down-drill auger
    // hangs below) — anchor so the 50px body stays centred on the collision box.
    this.sprite.setOrigin(0.5, 25 / 56);
    this.sprite.setDepth(10);
    // Battered-hull decal — rides on top of every animation frame.
    this.scuff = this.scene.add
      .image(this.state.pod.x, this.state.pod.y, 'atlas', 'pod_scuff1')
      .setOrigin(0.5, 25 / 56)
      .setDepth(10.5)
      .setVisible(false);
  }

  update(alpha: number): void {
    const p = this.state.pod;
    const x = p.prevX + (p.x - p.prevX) * alpha;
    const y = p.prevY + (p.y - p.prevY) * alpha;
    this.sprite.setPosition(x, y);
    this.sprite.setFlipX(p.facing === -1);
    this.animTick++;
    const ph = Math.floor(this.animTick / 6) % 2;
    const spin = Math.floor(this.animTick / 2) % 4; // fast 4-phase auger rotation
    let frame = 'pod_idle';
    if (p.mode === 'dig') {
      frame = p.drilling?.dir === 'down' ? `pod_drill_down${spin}` : `pod_drill_side${spin}`;
    } else if (p.mode === 'air') {
      frame = `pod_fly${ph}`;
    } else if (Math.abs(p.xVel) > 0.5) {
      frame = `pod_fly${ph}`;
    }
    this.sprite.setFrame(frame);

    // Landing squash: brief vertical compression that eases back out.
    if (this.squashT > 0) {
      this.squashT = Math.max(0, this.squashT - 0.06);
      const k = this.squashT * 0.22;
      this.sprite.setScale(1 + k, 1 - k);
    } else if (this.sprite.scaleX !== 1) {
      this.sprite.setScale(1, 1);
    }

    // Battered-hull decal at hp thresholds (light under ⅔, heavy under ⅓).
    const ratio = p.hp / maxHull(p);
    const wear = ratio < 1 / 3 ? 'pod_scuff2' : ratio < 2 / 3 ? 'pod_scuff1' : null;
    this.scuff.setVisible(wear !== null);
    if (wear) {
      this.scuff
        .setFrame(wear)
        .setPosition(x, y)
        .setFlipX(p.facing === -1)
        .setScale(this.sprite.scaleX, this.sprite.scaleY);
    }
  }

  /** Kick the landing squash (0..1 impact strength). */
  squash(strength: number): void {
    this.squashT = Math.min(1, Math.max(this.squashT, strength));
  }

  flashHurt(): void {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.sprite.clearTint());
  }
}
