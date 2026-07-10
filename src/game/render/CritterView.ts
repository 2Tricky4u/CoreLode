import type { Critter, GameState } from '@core/index';
/** Magmite rendering: pulsing molten motes tracking the sim's critter list.
 *  Placeholder art (tinted glow + dust core) until dedicated frames land. */
import Phaser from 'phaser';

export class CritterView {
  private sprites = new Map<Critter, Phaser.GameObjects.Container>();

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
  ) {}

  update(): void {
    const alive = new Set<Critter>(this.state.critters);
    for (const c of this.state.critters) {
      let node = this.sprites.get(c);
      if (!node) {
        const glow = this.scene.add
          .image(0, 0, 'atlas', 'glow32')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xd95763)
          .setAlpha(0.8);
        const core = this.scene.add.image(0, 0, 'atlas', 'dust2').setTint(0xdf7126).setScale(2);
        node = this.scene.add.container(c.x, c.y, [glow, core]).setDepth(9);
        this.sprites.set(c, node);
      }
      const pulse = 0.85 + 0.15 * Math.sin(this.scene.time.now / 110);
      node.setPosition(c.x, c.y).setScale(pulse);
    }
    for (const [key, node] of this.sprites) {
      if (!alive.has(key)) {
        node.destroy();
        this.sprites.delete(key);
      }
    }
  }
}
