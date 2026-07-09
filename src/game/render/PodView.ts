import type { GameState } from '@core/index';
/** Pod sprite — reads interpolated sim state; animation from pod mode/inputs. */
import type Phaser from 'phaser';

export class PodView {
  sprite!: Phaser.GameObjects.Sprite;
  private animTick = 0;

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
  ) {}

  create(): void {
    this.sprite = this.scene.add.sprite(this.state.pod.x, this.state.pod.y, 'atlas', 'pod_idle');
    this.sprite.setDepth(10);
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
  }

  flashHurt(): void {
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.sprite.clearTint());
  }
}
